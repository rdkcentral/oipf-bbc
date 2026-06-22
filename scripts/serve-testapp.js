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
 * Tiny static file server for the integration test app. Serves the repo root so
 * testapp/index.html can reach the built library at ../dist/stb/oipf-bbc.js.
 *
 *   node scripts/serve-testapp.js          # serves on PORT or 8137
 *   open http://localhost:8137/testapp/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// realpath so the served-root comparison is consistent with realpath'd request
// paths below (e.g. on macOS where /tmp resolves to /private/tmp).
const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const PORT = process.env.PORT || 8137;

const TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json'
};

http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) {
        urlPath += 'index.html';
    }
    // Allow-list the request path before it touches the filesystem: only safe URL
    // characters, and no ".." segment. This is the primary guard (the realpath +
    // root-boundary check below is defence-in-depth) and rejects path traversal
    // outright rather than relying on normalisation.
    if (!/^\/[\w./-]*$/.test(urlPath) || /(^|\/)\.\.(\/|$)/.test(urlPath)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
        return;
    }
    // Resolve the real on-disk path: collapses ".." AND follows symlinks, so a
    // symlink inside ROOT pointing outside it can't escape (a textual check would
    // miss that). realpathSync throws for a missing file → treat as 404. urlPath is
    // made relative ('.' + ...) so an absolute-looking request doesn't bypass ROOT.
    let filePath;
    try {
        filePath = fs.realpathSync(path.resolve(ROOT, '.' + urlPath));
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
    }
    // Require an exact match or a separator boundary so sibling directories that
    // merely share ROOT's name as a prefix (e.g. oipf-bbc-secret) can't be served.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Plain text and no reflected path — don't let the request value be
            // sniffed as HTML (reflected-XSS).
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log('Serving ' + ROOT + ' on http://localhost:' + PORT + '/testapp/');
});
