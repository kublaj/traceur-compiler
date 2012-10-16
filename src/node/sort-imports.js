// Copyright 2012 Google Inc.
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

var fs = require('fs');

var filenames = process.argv.slice(2);

filenames.forEach(function(filename) {
  var text = fs.readFileSync(filename, 'utf8');

  var imports = {};
  var marker = '__INSERT_HERE__'
  var first = true;
  text = text.replace(/import ((?:\w+)|(?:\{[^}]+\})) from ([^;\n]+);*\n/gm, function(_, name, path) {
    if (!(path in imports))
      imports[path] = [];
    if (name[0] === '{') {
      name = name.replace(/^\{\s*|\s*\}$/gm, '');
      [].push.apply(imports[path], name.split(/\s*,\s*/m));
    } else {
      imports[path].push(name);
    }
    imports[path].sort();
    if (first) {
      first = false;
      return marker;
    }
    return '';
  });

  var importedNames = Object.keys(imports);
  importedNames.sort(function(p1, p2) {
    return imports[p1][0].localeCompare(imports[p2][0]);
  });
  var importText = importedNames.map(function(path) {
    var result = 'import ';
    var names = imports[path]
    if (names.length === 1) {
      if (/:/.test(names[0]))
        result += '{' + names[0] + '}';
      else
        result += names[0];
    } else {
      result += '{\n' +
          names.map(function(name) {
            return '  ' + name;
          }).join(',\n') +
          '\n}';
    }
    return result + ' from ' + path + ';';
  }).join('\n');

  text = text.replace(/\s*__INSERT_HERE__\s*/gm, '\n\n' + importText + '\n\n')

  fs.writeFileSync(filename, text, 'utf8');
});
