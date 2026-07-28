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
 * Basic syntax validation for the repo's plain-Node build/deploy scripts (which
 * Mocha doesn't cover). Pure Node so it runs cross-platform — vm.Script only
 * parses, never executes, so browser globals like window/document don't matter.
 *
 * testapp/harness and testapp/tests are no longer checked here: they're ES
 * modules now (import/export, which vm.Script can't parse as a plain script
 * anyway) and are compiled — and so syntax/resolution-checked, more strongly
 * than this ever did — by `webpack --config-name testapp`.
 *
 *   node scripts/validate-testapp.js   (also: npm run validate:testapp)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['scripts'];

let checked = 0;
let failures = 0;

// Recurse so MVC subfolders (model/, view/, controller/) are covered too.
function walk(abs) {
    let entries;
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch (e) {
        return; // directory absent — skip
    }
    entries.forEach((entry) => {
        const full = path.join(abs, entry.name);
        if (entry.isDirectory()) {
            walk(full);
        } else if (entry.name.endsWith('.js')) {
            checked++;
            try {
                new vm.Script(fs.readFileSync(full, 'utf8'), { filename: full });
            } catch (e) {
                failures++;
                console.error('Syntax error in ' + path.relative(ROOT, full) + ': ' + e.message);
            }
        }
    });
}

DIRS.forEach((dir) => walk(path.join(ROOT, dir)));

if (failures) {
    console.error(failures + ' file(s) failed validation.');
    process.exit(1);
}
console.log('Validated ' + checked + ' file(s) — OK.');
