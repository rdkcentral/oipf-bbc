/**
 * Global test setup for mocha. Polyfills the browser globals that the source
 * code under test references at module-load or call time.
 */
const { WebSocket } = require('mock-socket');

// websockets.js uses `new WebSocket(url)` and the WebSocket.CLOSING/CLOSED constants.
global.WebSocket = WebSocket;
