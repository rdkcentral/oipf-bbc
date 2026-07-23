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
 * Packaging step for the test app, run AFTER `webpack --mode=production
 * --config-name testapp` (see the build:testapp / build:testapp:dev npm scripts)
 * has already produced testapp/dist/{index.html, testapp.bundle.js, testapp.css}
 * — and, for the self-contained :dev variant, testapp/dist/stb/ too (that copy is
 * a webpack build step now, a CopyWebpackPlugin entry gated on `--env withLib` in
 * webpack.config.js, not this script's job). This script only tarballs the result
 * for the bolt package pipeline (build-bolt-package.sh).
 *
 *   node scripts/build-testapp.js   (also: npm run build:testapp / build:testapp:dev)
 */
const fs = require('fs');
const path = require('path');
const tar = require('tar');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'testapp/dist');
const TARBALL = path.join(OUT, 'testapp.tar.gz');
// The deployable app files, packed flat into the tarball (no library, no folder).
const APP_FILES = ['index.html', 'testapp.bundle.js', 'testapp.css'];

function kb(bytes) {
    return (bytes / 1024).toFixed(1) + ' kB';
}

async function main() {
    APP_FILES.forEach((file) => {
        if (!fs.existsSync(path.join(OUT, file))) {
            throw new Error(
                'Missing ' + file + ' in testapp/dist/ — run `webpack --mode=production ' +
                '--config-name testapp` first (npm run build:testapp:webpack).'
            );
        }
    });

    // Tarball inside dist/, containing just the app files flat (no library, no
    // top-level folder). portable + fixed mtime keep rebuilds reproducible.
    await tar.create(
        { gzip: true, file: TARBALL, cwd: OUT, portable: true, mtime: new Date(0) },
        APP_FILES
    );

    console.log('Packaged testapp/dist/:');
    APP_FILES.forEach((file) => {
        console.log('  ' + file + '  ' + kb(fs.statSync(path.join(OUT, file)).size));
    });
    console.log('  testapp.tar.gz     ' + kb(fs.statSync(TARBALL).size) + ' (' + APP_FILES.join(', ') + ')');
}

main().catch(function (e) {
    console.error('build-testapp failed:', e);
    process.exit(1);
});
