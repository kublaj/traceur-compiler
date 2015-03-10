// Copyright 2015 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  GetAccessor,
  PropertyMethodAssignment,
  SetAccessor,
} from '../syntax/trees/ParseTrees.js';
import {ExplodeExpressionTransformer} from './ExplodeExpressionTransformer.js';
import {ParseTreeTransformer} from './ParseTreeTransformer.js';
import {TempVarTransformer} from './TempVarTransformer.js';
import {
  EQUAL,
  MINUS_MINUS,
  PLUS_PLUS
} from '../syntax/TokenType.js';
import {
  MEMBER_EXPRESSION,
  MEMBER_LOOKUP_EXPRESSION,
  SUPER_EXPRESSION,
} from '../syntax/trees/ParseTreeType.js';
import {
  createArgumentList,
  createAssignmentExpression,
  createCommaExpression,
  createIdentifierExpression,
  createIdentifierToken,
  createParenExpression,
  createStringLiteral,
  createThisExpression,
} from './ParseTreeFactory.js';
import {parseExpression} from './PlaceholderParser.js';


class ExplodeSuperExpression extends ExplodeExpressionTransformer {
  transformArrowFunctionExpression(tree) {
    return tree;
  }
  transformClassExpression(tree) {
    return tree;
  }
  transformFunctionBody(tree) {
    return tree;
  }
}

function hasSuperMemberExpression(tree) {
  if (tree.type !== MEMBER_EXPRESSION &&
      tree.type !== MEMBER_LOOKUP_EXPRESSION) {
    return false;
  }
  return tree.operand.type === SUPER_EXPRESSION;
}

function getName(tree) {
  if (tree.type === MEMBER_LOOKUP_EXPRESSION) {
    return tree.memberExpression;
  }
  return createStringLiteral(tree.memberName.value);
}

export class NewSuperTransformer extends TempVarTransformer {
  /**
   * @param {UniqueIdentifierGenerator} identifierGenerator
   */
  constructor(identifierGenerator) {
    super(identifierGenerator);
    this.innerSuperTransformer_ =
        new InnerSuperTransformer(identifierGenerator, this);
  }

  transformObjectLiteralExpression(tree) {
    let innerTransformer = this.innerSuperTransformer_;
    let entry = innerTransformer.pushObjectLiteral(tree);
    let transformed = super.transformObjectLiteralExpression(tree);
    innerTransformer.pop();

    if (entry.hasPrototype) {
      return createParenExpression(
          createAssignmentExpression(
              createIdentifierExpression(entry.prototypeName), transformed));
    }

    return transformed;
  }

  transformGetAccessor(tree) {
    let innerTransformer = this.innerSuperTransformer_;
    innerTransformer.pushProperty(tree);
    let body = innerTransformer.transformAny(tree.body);
    innerTransformer.pop();
    if (tree.body === body) {
      return tree;
    }
    
    return new GetAccessor(tree.location, tree.isStatic, tree.name,
                           tree.typeAnnotation, tree.annotations, body);
  }

  transformSetAccessor(tree) {
    let innerTransformer = this.innerSuperTransformer_;
    innerTransformer.pushProperty(tree);
    let body = innerTransformer.transformAny(tree.body);
    let parameterList = innerTransformer.transformAny(tree.parameterList);
    innerTransformer.pop();
    if (tree.body === body && tree.parameterList === parameterList) {
      return tree;
    }
    
    return new SetAccessor(tree.location, tree.isStatic, tree.name,
        parameterList, tree.annotations, body);
  }

  transformPropertyMethodAssignment(tree) {
    let innerTransformer = this.innerSuperTransformer_;
    innerTransformer.pushProperty(tree);
    let body = innerTransformer.transformAny(tree.body);
    let parameterList = innerTransformer.transformAny(tree.parameterList);
    innerTransformer.pop();
    if (tree.body === body && tree.parameterList === parameterList) {
      return tree;
    }
    
    return new PropertyMethodAssignment(tree.location, tree.isStatic,
        tree.functionKind, tree.name, parameterList, tree.typeAnnotation,
        tree.annotations, body, tree.debugName);
  }
}

class Entry {
  constructor() {
    this.hasPrototype = false;
    this.hasStatic = false;
    this.prototypeName = null;
    this.staticName = null;
  }
}

class InnerSuperTransformer extends TempVarTransformer {
  constructor(identifierGenerator, outerTransformer) {
    super(identifierGenerator);
    this.outerTransformer_ = outerTransformer;
    this.stack_ = [];
  }

  pushObjectLiteral(tree) {
    let entry = new Entry();
    this.stack_.push(entry);
    return entry;
  }

  pushClassLiteral(tree) {
    let entry = new Entry();
    this.stack_.push(entry);
    return entry;
  }

  pop() {
    this.stack_.pop();
  }

  pushProperty(tree) {
    this.stack_.push(tree.isStatic);
  }

  getProtoName() {
    let isStatic = this.stack_[this.stack_.length - 1];
    let entry = this.stack_[this.stack_.length - 2];
    if (isStatic) {
      entry.hasStatic = true;
      if (!entry.staticName) {
        entry.staticName =
            createIdentifierToken(this.outerTransformer_.addTempVar());
      }
      return createIdentifierExpression(entry.staticName);
    }

    entry.hasPrototype = true;
    if (!entry.prototypeName) {
      entry.prototypeName =
          createIdentifierToken(this.outerTransformer_.addTempVar());
    }
    return createIdentifierExpression(entry.prototypeName);
  }

  transformMemberShared_(operand) {
    let name = getName(operand);
    return parseExpression
        `$traceurRuntime.superGet(this, ${this.getProtoName()}, ${name})`;
  }

  transformMemberExpression(tree) {
    if (tree.operand.type === SUPER_EXPRESSION) {
      return this.transformMemberShared_(tree);
    }
    return super.transformMemberExpression(tree);
  }

  transformMemberLookupExpression(tree) {
    if (tree.operand.type === SUPER_EXPRESSION) {
      return this.transformMemberShared_(tree);
    }
    return super.transformMemberLookupExpression(tree);
  }

  transformCallExpression(tree) {
    // // TODO(arv): This does not yet handle computed properties.
    // // [expr]() { super(); }
    // if (tree.operand.type === SUPER_EXPRESSION) {
    //   // We have: super(args)
    //   this.superCount_++;
    //   return this.createSuperCall_(tree);
    // }

    if (hasSuperMemberExpression(tree.operand)) {
      let operand = this.transformMemberShared_(tree.operand);
      let args =
          createArgumentList([createThisExpression(), ...tree.args.args]);
      return parseExpression `${operand}.call(${args})`;
    }
    return super.transformCallExpression(tree);
  }

  transformBinaryExpression(tree) {
    if (tree.operator.isAssignmentOperator() &&
        hasSuperMemberExpression(tree.left)) {
      if (tree.operator.type !== EQUAL) {
        let exploded = new ExplodeSuperExpression(this).
            transformAny(tree);
        return this.transformAny(createParenExpression(exploded));
      }

      let name = getName(tree.left);

      let right = this.transformAny(tree.right);
      return parseExpression
          `$traceurRuntime.superSet(this, ${this.getProtoName()}, ${name},
                                    ${right})`;
    }

    return super.transformBinaryExpression(tree);
  }

  transformUnaryExpression(tree) {
    let transformed = this.transformIncrementDecrement_(tree);
    if (transformed) {
      return transformed;
    }
    return super.transformUnaryExpression(tree);
  }

  transformPostfixExpression(tree) {
    let transformed = this.transformIncrementDecrement_(tree);
    if (transformed) {
      return transformed;
    }
    return super.transformPostfixExpression(tree);
  }

  transformIncrementDecrement_(tree) {
    let operator = tree.operator;
    let operand = tree.operand;
    if ((operator.type === PLUS_PLUS || operator.type === MINUS_MINUS) &&
        hasSuperMemberExpression(operand)) {
      let exploded = new ExplodeSuperExpression(this).
          transformAny(tree);
      if (exploded !== tree) {
        exploded = createParenExpression(exploded);
      }
      return this.transformAny(exploded);
    }

    return null;
  }
}
