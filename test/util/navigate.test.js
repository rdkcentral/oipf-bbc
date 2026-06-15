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
 * Unit tests for lib/util/navigate.js — Firebolt-backed helpers.
 *
 * Scope: exitToApp, which calls Firebolt Actions.start with a launch intent and
 * a handlerAppId.
 *
 * Both util/websockets and constants/target_urls are stubbed so the test
 * controls the wire and the URL.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const FIREBOLT_URL = 'ws://test-firebolt/jsonrpc';

function loadNavigate({ sendImpl } = {}) {
    const sendCalls = [];
    const send = args => {
        sendCalls.push(args);
        return sendImpl ? sendImpl(args) : Promise.resolve(null);
    };

    delete require.cache[require.resolve('util/navigate')];
    const navigate = proxyquire('util/navigate', {
        'util/websockets': { send },
        'constants/target_urls': { __esModule: true, default: { Firebolt: FIREBOLT_URL } },
        'datamodel/oipfError': {
            __esModule: true,
            default: class OipfError extends Error {
                constructor(code, message, extra) {
                    super(message);
                    this.code = code;
                    this.extra = extra;
                    this.name = 'OipfError';
                }
            }
        }
    });

    return { navigate, sendCalls };
}

describe('util/navigate — exitToApp', () => {
    it('calls Firebolt Actions.start with a launch intent and the handlerAppId', async () => {
        const { navigate, sendCalls } = loadNavigate();

        await navigate.exitToApp('uk.co.bbc.iplayer');

        expect(sendCalls).to.have.length(1);
        expect(sendCalls[0].target).to.equal(FIREBOLT_URL);
        expect(sendCalls[0].method).to.equal('Actions.start');
        expect(sendCalls[0].params.handlerAppId).to.equal('uk.co.bbc.iplayer');
        expect(JSON.parse(sendCalls[0].params.intent)).to.deep.equal({
            action: 'launch',
            context: { source: 'oipf-bbc' }
        });
    });

    it('passes additional parameters through as the third argument', async () => {
        const { navigate, sendCalls } = loadNavigate();

        await navigate.exitToApp('uk.co.bbc.iplayer', { foo: 'bar' });

        // NOTE: argument name is a placeholder pending platform confirmation.
        expect(sendCalls[0].params.additionalParameters).to.deep.equal({ foo: 'bar' });
    });

    it('rejects with an OipfError when the Firebolt call fails', async () => {
        const { navigate } = loadNavigate({
            sendImpl: () => Promise.reject(new Error('firebolt unreachable'))
        });

        let caught;
        try {
            await navigate.exitToApp('uk.co.bbc.iplayer');
        } catch (e) {
            caught = e;
        }

        expect(caught).to.be.an('error');
        expect(caught.code).to.equal(603);
    });
});
