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
 * Unit tests for lib/util/websockets.js
 *
 * Focus: the JSON-RPC 2.0 wire contract — outgoing requests have the right
 * shape, responses are correlated by id, errors are surfaced as OipfError,
 * and server-push notifications fan out to registered callbacks.
 *
 * We use proxyquire to replace datamodel/oipfError with a plain class so we
 * can assert on it.
 */

const { expect } = require('chai');
const { Server } = require('mock-socket');
const proxyquire = require('proxyquire').noCallThru();

const TEST_TARGET = 'ws://localhost:18765/test';

class FakeOipfError extends Error {
    constructor(code, message, extra) {
        super(message);
        this.code = code;
        this.extra = extra;
        this.name = 'OipfError';
    }
}

/**
 * Load a fresh copy of the websockets module so module-level state
 * (websocketPool, websocketEventSubscriptions, uniqueId) doesn't leak between tests.
 */
// Captures the config listener websockets.js registers at load, so a test can
// drive `requestTimeoutMillis` down to a few ms instead of waiting the 10s default.
let capturedConfigListener = null;

function loadWebsockets() {
    capturedConfigListener = null;
    // Bust the require cache for the module under test so each test starts clean.
    delete require.cache[require.resolve('util/websockets')];
    return proxyquire('util/websockets', {
        'datamodel/oipfError': FakeOipfError,
        'util/config': {
            addConfigListener: (key, cb) => {
                if (key === 'websockets') capturedConfigListener = cb;
            }
        }
    });
}

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

describe('util/websockets', () => {
    let server;
    let received;
    let respond;
    let websockets;

    beforeEach(() => {
        received = [];
        respond = null;
        server = new Server(TEST_TARGET);
        server.on('connection', socket => {
            socket.on('message', raw => {
                const msg = JSON.parse(raw);
                received.push(msg);
                if (respond) respond(socket, msg);
            });
        });
    });

    afterEach(done => {
        server.stop(done);
    });

    describe('send — request shape', () => {
        beforeEach(() => { websockets = loadWebsockets(); });

        it('builds a JSON-RPC 2.0 request with jsonrpc, id, method and params', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            const result = await websockets.send({
                target: TEST_TARGET,
                method: 'Foo.bar',
                params: { a: 1 }
            });

            expect(result).to.equal('ok');
            expect(received).to.have.length(1);
            expect(received[0]).to.include({ jsonrpc: '2.0', method: 'Foo.bar' });
            expect(received[0].params).to.deep.equal({ a: 1 });
            expect(received[0].id).to.be.a('number');
        });

        it('omits the params field when none are provided', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: null }));

            await websockets.send({ target: TEST_TARGET, method: 'Foo.ping' });

            expect(received[0]).to.not.have.property('params');
        });

        it('assigns a unique, increasing id to each request', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: msg.id }));

            const a = await websockets.send({ target: TEST_TARGET, method: 'Foo.a' });
            const b = await websockets.send({ target: TEST_TARGET, method: 'Foo.b' });

            expect(b).to.equal(a + 1);
        });
    });

    describe('send — response handling', () => {
        beforeEach(() => { websockets = loadWebsockets(); });

        it('resolves the matching request with the JSON-RPC result field', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { greeting: 'hi' } }));

            const result = await websockets.send({ target: TEST_TARGET, method: 'Foo.bar' });

            expect(result).to.deep.equal({ greeting: 'hi' });
        });

        it('rejects the matching request with an OipfError when the server returns error', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({
                    jsonrpc: '2.0',
                    id: msg.id,
                    error: { code: 42, message: 'boom' }
                }));

            let caught;
            try {
                await websockets.send({ target: TEST_TARGET, method: 'Foo.bar' });
            } catch (err) {
                caught = err;
            }

            expect(caught).to.be.instanceOf(FakeOipfError);
            expect(caught.code).to.equal(42);
            expect(caught.message).to.equal('boom');
        });

        it('correlates responses by id when they arrive out of order', async () => {
            // Hold responses, then send them in reverse order.
            const pending = [];
            respond = (socket, msg) => pending.push({ socket, id: msg.id, method: msg.method });

            const a = websockets.send({ target: TEST_TARGET, method: 'Foo.a' });
            const b = websockets.send({ target: TEST_TARGET, method: 'Foo.b' });

            // Let both messages arrive at the server.
            await flush();
            expect(pending).to.have.length(2);

            // Respond to B first, then A.
            pending[1].socket.send(JSON.stringify({ jsonrpc: '2.0', id: pending[1].id, result: 'B' }));
            pending[0].socket.send(JSON.stringify({ jsonrpc: '2.0', id: pending[0].id, result: 'A' }));

            expect(await a).to.equal('A');
            expect(await b).to.equal('B');
        });

        it('ignores responses whose jsonrpc version is not 2.0', async () => {
            respond = (socket, msg) => {
                socket.send(JSON.stringify({ jsonrpc: '1.0', id: msg.id, result: 'bad' }));
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'good' }));
            };

            const result = await websockets.send({ target: TEST_TARGET, method: 'Foo.a' });

            expect(result).to.equal('good');
        });

        it('ignores responses that are not valid JSON', async () => {
            respond = (socket, msg) => {
                socket.send('this is not json');
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'fine' }));
            };

            const result = await websockets.send({ target: TEST_TARGET, method: 'Foo.a' });

            expect(result).to.equal('fine');
        });
    });

    describe('send — request timeout', () => {
        beforeEach(() => { websockets = loadWebsockets(); });

        it('rejects with OipfError(204) when no response arrives before the timeout', async () => {
            capturedConfigListener({ requestTimeoutMillis: 5 }); //shrink the 10s default
            respond = null; //server receives the request but never replies

            let caught;
            try {
                await websockets.send({ target: TEST_TARGET, method: 'Foo.silent' });
            } catch (err) {
                caught = err;
            }

            expect(caught).to.be.instanceOf(FakeOipfError);
            expect(caught.code).to.equal(204);
            //the timed-out request must be removed so a late reply can't double-settle it
            expect(received).to.have.length(1);
        });

        it('does not reject a request that gets its response before the timeout', async () => {
            capturedConfigListener({ requestTimeoutMillis: 50 });
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            const result = await websockets.send({ target: TEST_TARGET, method: 'Foo.fast' });
            expect(result).to.equal('ok');

            //wait past the timeout window — the cleared timer must not fire / throw
            await new Promise(resolve => setTimeout(resolve, 70));
        });
    });

    describe('registerEvent', () => {
        beforeEach(() => { websockets = loadWebsockets(); });

        it('sends a single JSON-RPC subscribe with params.listen=true for the first subscriber', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', () => {});
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', () => {});

            const subscribes = received.filter(m => m.method === 'Foo.onChange');
            expect(subscribes).to.have.length(1);
            expect(subscribes[0]).to.include({ jsonrpc: '2.0', method: 'Foo.onChange' });
            expect(subscribes[0].params).to.deep.equal({ listen: true });
        });

        it('dispatches server-push notifications to every registered callback', async () => {
            let serverSocket;
            server.on('connection', socket => { serverSocket = socket; });
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            const a = [];
            const b = [];
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', p => a.push(p));
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', p => b.push(p));

            serverSocket.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'Foo.onChange',
                params: { v: 1 }
            }));
            await flush();

            expect(a).to.deep.equal([{ v: 1 }]);
            expect(b).to.deep.equal([{ v: 1 }]);
        });

        it('ignores server-push notifications for unknown methods', async () => {
            let serverSocket;
            server.on('connection', socket => { serverSocket = socket; });
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            const received1 = [];
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', p => received1.push(p));

            serverSocket.send(JSON.stringify({
                jsonrpc: '2.0',
                method: 'Foo.somethingElse',
                params: { v: 99 }
            }));
            await flush();

            expect(received1).to.deep.equal([]);
        });
    });

    describe('unregisterEvent', () => {
        beforeEach(() => { websockets = loadWebsockets(); });

        it('sends unsubscribe (listen=false) only when the last callback is removed', async () => {
            respond = (socket, msg) =>
                socket.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: 'ok' }));

            const cbA = () => {};
            const cbB = () => {};
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', cbA);
            await websockets.registerEvent(TEST_TARGET, 'Foo.onChange', cbB);

            websockets.unregisterEvent('Foo.onChange', cbA);
            await flush();
            let unsubs = received.filter(m => m.method === 'Foo.onChange' && m.params.listen === false);
            expect(unsubs, 'unsubscribe should NOT fire while other callbacks remain').to.have.length(0);

            websockets.unregisterEvent('Foo.onChange', cbB);
            await flush();
            unsubs = received.filter(m => m.method === 'Foo.onChange' && m.params.listen === false);
            expect(unsubs, 'unsubscribe should fire once the last callback is gone').to.have.length(1);
        });

        it('is a no-op for an unknown method', () => {
            expect(() => websockets.unregisterEvent('Foo.never', () => {})).to.not.throw();
        });
    });
});
