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
 * Optional build for the test app: concatenates + minifies its JS into one
 * bundle, minifies the CSS, and emits a self-contained testapp/dist/ folder.
 *
 * The source testapp/ remains fully runnable WITHOUT this build (index.html loads
 * the individual modules directly) — this just produces a smaller, single-request
 * artifact for deployment. The script order is read from index.html so the bundle
 * can never drift from the dev load order.
 *
 *   node scripts/build-testapp.js   (also: npm run build:testapp)
 */
const fs = require('fs');
const path = require('path');
const tar = require('tar');
const { minify } = require('terser');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'testapp');
const OUT = path.join(APP, 'dist');
const TARBALL = path.join(OUT, 'testapp.tar.gz');
// The deployable app files, packed flat into the tarball (no library, no folder).
const APP_FILES = ['index.html', 'testapp.bundle.js', 'testapp.css'];
const LICENSE = '/* Copyright (c) 2026 Infosys. Licensed under the Apache License, Version 2.0. */\n';

function kb(text) {
    return (Buffer.byteLength(text) / 1024).toFixed(1) + ' kB';
}

// Conservative CSS minify: drop comments, collapse whitespace, trim around
// punctuation. Safe for this stylesheet (no url()/content: edge cases).
function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,>])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();
}

async function main() {
    const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

    // 1. Script load order — straight from index.html (the single source of truth
    //    for dev load order, so the bundle can't drift from it). The regex tolerates
    //    other attributes and either quote style. The testapp uses only external
    //    <script src> modules; an inline script isn't bundled and would surface
    //    immediately at runtime / via `npm run validate:testapp`.
    const srcs = [];
    const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi;
    let m;
    while ((m = re.exec(html))) {
        srcs.push(m[1]);
    }
    if (!srcs.length) {
        throw new Error('No <script src> tags found in testapp/index.html');
    }

    // 2. Concatenate (leading ; between files guards against ASI surprises).
    const concatenated = srcs
        .map(function (src) {
            return '// ' + src + '\n' + fs.readFileSync(path.join(APP, src), 'utf8');
        })
        .join('\n;\n');

    // 3. Minify JS.
    const result = await minify(concatenated, {
        compress: true,
        mangle: true,
        format: { comments: false }
    });
    if (result.error) {
        throw result.error;
    }

    // Fresh output dir.
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });

    const bundle = LICENSE + result.code + '\n';
    fs.writeFileSync(path.join(OUT, 'testapp.bundle.js'), bundle);

    // 4. Minify CSS.
    const css = LICENSE + minifyCss(fs.readFileSync(path.join(APP, 'harness/harness.css'), 'utf8')) + '\n';
    fs.writeFileSync(path.join(OUT, 'testapp.css'), css);

    // 5. Generated index.html: one bundle script, minified CSS, same markup.
    const builtHtml = html
        .replace(/[ \t]*<script src="[^"]+"><\/script>\n/g, '')
        .replace('</body>', '        <script src="testapp.bundle.js"></script>\n    </body>')
        .replace('href="harness/harness.css"', 'href="testapp.css"');
    fs.writeFileSync(path.join(OUT, 'index.html'), builtHtml);

    // 6. Copy the library so the artifact is self-contained (loader's relative
    //    ../dist/stb path resolves to OUT/stb here). Optional — auto mode doesn't
    //    need it (the platform injects the library).
    const libJs = path.join(ROOT, 'dist/stb/oipf-bbc.js');
    const libCss = path.join(ROOT, 'dist/stb/oipf-bbc.css');
    if (fs.existsSync(libJs)) {
        fs.mkdirSync(path.join(OUT, 'stb'), { recursive: true });
        fs.copyFileSync(libJs, path.join(OUT, 'stb/oipf-bbc.js'));
        if (fs.existsSync(libCss)) {
            fs.copyFileSync(libCss, path.join(OUT, 'stb/oipf-bbc.css'));
        }
    } else {
        console.warn('Note: dist/stb/oipf-bbc.js not found — run `npm run build` for a fully ' +
            'self-contained artifact, or deploy where the platform injects the library (auto mode).');
    }

    // 7. Tarball inside dist/, containing just the app files flat (no library, no
    //    top-level folder). portable + fixed mtime keep rebuilds reproducible.
    await tar.create(
        { gzip: true, file: TARBALL, cwd: OUT, portable: true, mtime: new Date(0) },
        APP_FILES
    );

    console.log('Built testapp/dist/ from ' + srcs.length + ' sources:');
    console.log('  testapp.bundle.js  ' + kb(bundle));
    console.log('  testapp.css        ' + kb(css));
    console.log('  testapp.tar.gz     ' + kb(fs.readFileSync(TARBALL)) + ' (' + APP_FILES.join(', ') + ')');
}

main().catch(function (e) {
    console.error('build-testapp failed:', e);
    process.exit(1);
});
