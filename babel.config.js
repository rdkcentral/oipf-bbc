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

/**
 * Babel config used by @babel/register when running mocha tests.
 * Webpack does NOT use Babel — it consumes the ESM source as-is — so this
 * config is test-only. It compiles ESM to CommonJS so Node + Mocha can load
 * the source under test. Module path resolution (the webpack-style root
 * imports like `util/foo`) is handled via NODE_PATH in the test script.
 */
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }]
    ]
};
