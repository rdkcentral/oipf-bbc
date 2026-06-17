/*
 * Copyright (c) 2026 Infosys
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Basic syntax validation for the test app's JS (which the Webpack build and
 * Mocha tests don't cover). Pure Node so it runs cross-platform — vm.Script only
 * parses, never executes, so browser globals like window/document don't matter.
 *
 *   node scripts/validate-testapp.js   (also: npm run validate:testapp)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['testapp/harness', 'testapp/tests', 'scripts'];

let checked = 0;
let failures = 0;

DIRS.forEach((dir) => {
    const abs = path.join(ROOT, dir);
    let entries;
    try {
        entries = fs.readdirSync(abs);
    } catch (e) {
        return; // directory absent — skip
    }
    entries
        .filter((name) => name.endsWith('.js'))
        .forEach((name) => {
            const file = path.join(abs, name);
            checked++;
            try {
                new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
            } catch (e) {
                failures++;
                console.error('Syntax error in ' + path.relative(ROOT, file) + ': ' + e.message);
            }
        });
});

if (failures) {
    console.error(failures + ' file(s) failed validation.');
    process.exit(1);
}
console.log('Validated ' + checked + ' file(s) — OK.');
