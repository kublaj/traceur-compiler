// Copyright 2013 Google Inc.
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

import {ParseTreeTransformer} from './ParseTreeTransformer.js';
import {
  createArrayLiteralExpression,
  createEmptyArrayLiteralExpression
} from './ParseTreeFactory.js';
import {parseExpression} from './PlaceholderParser.js';

/**
 * Desugars new to allow @@create class side methods.
 *
 *  new expr(params)
 *
 *  =>
 *
 *  $traceurRuntime.new(expr, [params])
 */
export class NewTransformer extends ParseTreeTransformer {
  transformNewExpression(tree) {
    var operand = this.transformAny(tree.operand);
    var args = this.transformAny(tree.args);
    var array = !args ?
        createEmptyArrayLiteralExpression() :
        createArrayLiteralExpression(args.args);

    return parseExpression `$traceurRuntime.new(${operand}, ${array})`;
  }
};
