// Copyright 2012 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {ParseTreeVisitor} from '../syntax/ParseTreeVisitor';

class BlacklistBindingNamesVisitor extends ParseTreeVisitor {
  constructor(names) {
    this.names = names;
  }

  visitBindingIdentifier(tree) {
    var name = tree.identifierToken.value;
    this.names[name] = true;
  }
}

export class UniqueIdentifierGenerator {
  constructor(tree = undefined) {
    this.identifierIndex = 0;
    this.blacklistedNames = Object.create(null);
  }

  /**
   * @return {string}
   */
  generateUniqueIdentifier() {
    while (true) {
      var name = `$__${this.identifierIndex++}`;
      if (!this.blacklistedNames[name])
        return name;
    }
  }

  blacklistBindingNames(tree) {
    var visitor = new BlacklistBindingNamesVisitor(this.blacklistedNames);
    visitor.visitAny(tree);
  }
}
