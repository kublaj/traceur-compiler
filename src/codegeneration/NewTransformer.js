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

var NEW_CODE = `
    function(func, argumentsList) {
      var creator = $traceurRuntime.getCreator(func);
      var obj;
      if (creator === void 0)
        obj = Object.create(func.prototype);
      else
        obj = creator.call(func)
      var result = func.apply(obj, argumentsList);
      return result && Object(result) === result ? result : obj;
    }`;

/**
 * Desugars new to allow @@create class side methods.
 *
 *  new expr(params)
 *
 *  =>
 *
 *  $__construct(expr, [params])
 */
export class NewTransformer extends ParseTreeTransformer {
  /**
   * @param {RuntimeInliner} runtimeInliner
   */
  constructor(runtimeInliner) {
    this.runtimeInliner_ = runtimeInliner;
  }

  get new_() {
    return this.runtimeInliner_.get('new', NEW_CODE);
  }

  transformNewExpression(tree) {
    var operand = this.transformAny(tree.operand);
    var args = this.transformAny(tree.args);
    var array = !args ?
        createEmptyArrayLiteralExpression() :
        createArrayLiteralExpression(args.args);

    return parseExpression `${this.new_}(${operand}, ${array})`;
  }

  static transformTree(runtimeInliner, tree) {
    return new NewTransformer(runtimeInliner).transformAny(tree);
  }
};
