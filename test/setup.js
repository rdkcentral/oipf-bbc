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
 * Global test setup for mocha. Polyfills the browser globals that the source
 * code under test references at module-load or call time.
 */
const { WebSocket } = require('mock-socket');

// websockets.js uses `new WebSocket(url)` and the WebSocket.CLOSING/CLOSED constants.
global.WebSocket = WebSocket;

// websockets.js resolves the live Firebolt URL from window.__firebolt.endpoint
// at connection time. Provide a default global; individual tests can override
// window.__firebolt.endpoint to point at their mock server.
global.window = global.window || {};
global.window.__firebolt = { endpoint: 'ws://127.0.0.1:9998/jsonrpc' };
