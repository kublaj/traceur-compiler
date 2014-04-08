// Copyright 2014 Traceur Authors.
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

import {ParseTreeTransformer} from '../codegeneration/ParseTreeTransformer';
import {MemberExpression} from '../syntax/trees/ParseTrees';
import {
  BINARY_OPERATOR,
  UNARY_EXPRESSION
} from '../syntax/trees/ParseTreeType';
import {createParenExpression} from '../codegeneration/ParseTreeFactory';

export class ParenTransformer extends ParseTreeTransformer {
  transformMemberExpression(tree) {
    var transformed = super(tree);
    switch (transformed.operand.type) {
      case BINARY_OPERATOR:
      case UNARY_EXPRESSION:
        var operand = createParenExpression(transformed.operand);
        return new MemberExpression(transformed.location, operand,
            transformed.memberName);
      default:
        return transformed;
    }
  }
  
  transformUnaryEpxression(tree) {
    var transformed = super(tree);
  }
}

function getPrecedence(tree) {
  switch (tree.type) {
    case PAREN_EXPRESSION:
      return 0;
    
    case MEMBER_EXPRESSION:
    case MEMBER_LOOKUP_EXPRESSION:
      return 1;
    
    case CALL_EXPRESSION:
    case NEW_EXPRESSION:
      return 2;
      
    case POST_FIX_EXPRESSION:
      return 3;
      
    case UNARY_EXPRESSION:
      return 4;
      
    case COMMA_EXPRESSION:
      return 18;
      
    case BINARY_OPERATOR:
      return getBinaryPrecendence(tree);
  }
  
  return -1;
}

function getBinaryPrecendence(tree) {
  
  
}