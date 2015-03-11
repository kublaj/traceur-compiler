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

function getName(tree) {
  if (tree.type === MEMBER_LOOKUP_EXPRESSION) {
    return tree.memberExpression;
  }
  return createStringLiteral(tree.memberName.value);
}

function hasSuperMemberExpression(tree) {
  if (tree.type !== MEMBER_EXPRESSION &&
      tree.type !== MEMBER_LOOKUP_EXPRESSION) {
    return false;
  }
  return tree.operand.type === SUPER_EXPRESSION;
}

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

class Entry {
  constructor() {
    this.hasPrototype = false;
    this.hasStatic = false;
    this.prototypeName = null;
    this.staticName = null;
  }
}

export class InnerSuperTransformer extends TempVarTransformer {
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
    let i = this.stack_.length;
    if (i % 2 !== 0) {
      // We are in an extends or a computed name expression.
      i--;
    }
    let isStatic = this.stack_[i - 1];
    let entry = this.stack_[i - 2];
    if (isStatic) {
      entry.hasStatic = true;
      if (!entry.staticName) {
        entry.staticName =
            createIdentifierExpression(this.outerTransformer_.addTempVar());
      }
      return entry.staticName;
    }

    entry.hasPrototype = true;
    if (!entry.prototypeName) {
      entry.prototypeName =
          createIdentifierExpression(this.outerTransformer_.addTempVar());
    }
    return entry.prototypeName;
  }

  getConstructorName() {
    let entry = this.stack_[this.stack_.length - 2];
    return entry.staticName;
  }

  transformClassDeclaration(tree) {
    return this.outerTransformer_.transformClassDeclaration(tree);
  }

  transformClassExpression(tree) {
    return this.outerTransformer_.transformClassExpression(tree);
  }

  transformObjectLiteralExpression(tree) {
    return this.outerTransformer_.transformObjectLiteralExpression(tree);
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
    function createArgs() {
      return createArgumentList([createThisExpression(), ...tree.args.args]);
    }

    if (tree.operand.type === SUPER_EXPRESSION) {
      // We have: super(args)
      return parseExpression `$traceurRuntime.superConstructor(
          ${this.getConstructorName()}).call(${createArgs()})`;
    }

    if (hasSuperMemberExpression(tree.operand)) {
      let operand = this.transformMemberShared_(tree.operand);
      return parseExpression `${operand}.call(${createArgs()})`;
    }
    return super.transformCallExpression(tree);
  }

  createSuperCall_(tree) {
    let args = createArgumentList([createThisExpression(), ...tree.args.args]);
    return parseExpression
        `$traceurRuntime.superConstructor(${this.internalName_}).call(${args})`;
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
