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
import {InnerSuperTransformer} from './InnerSuperTransformer.js';
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
          createAssignmentExpression(entry.prototypeName, transformed));
    }

    return transformed;
  }

  transformClassDeclaration(tree) {
    let innerTransformer = this.innerSuperTransformer_;
    let entry = innerTransformer.pushClassLiteral(tree);
    entry.prototypeName = parseExpression `${tree.name.identifierToken}.
        ${createIdentifierToken('prototype')}`;
    entry.staticName = tree.name.identifierToken;
    let transformed = super.transformClassDeclaration(tree);
    innerTransformer.pop();
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
