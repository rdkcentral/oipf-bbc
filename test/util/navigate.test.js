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
 * Scope: exitToApp, which calls Firebolt Actions.start on the native
 * Firebolt client with a launch intent and a handlerAppId.
 *
 * util/firebolt is stubbed so the test controls what Actions.start sees and
 * returns.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

function loadNavigate({ startImpl } = {}) {
    const startCalls = [];
    const start = params => {
        startCalls.push(params);
        return startImpl ? startImpl(params) : Promise.resolve(null);
    };

    delete require.cache[require.resolve('util/navigate')];
    const navigate = proxyquire('util/navigate', {
        'util/firebolt': {
            getFirebolt: () => Promise.resolve({ Actions: { start } })
        },
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

    return { navigate, startCalls };
}

describe('util/navigate — exitToApp', () => {
    it('calls Firebolt Actions.start with a launch intent object and the handlerAppId', async () => {
        const { navigate, startCalls } = loadNavigate();

        await navigate.exitToApp('uk.co.bbc.iplayer');

        expect(startCalls).to.have.length(1);
        expect(startCalls[0].handlerAppId).to.equal('uk.co.bbc.iplayer');
        // intent must be a plain object per the generated StartParams contract.
        expect(startCalls[0].intent).to.deep.equal({
            action: 'launch',
            context: { source: 'oipf-bbc' }
        });
    });

    it('places params in intent.data when provided', async () => {
        const { navigate, startCalls } = loadNavigate();

        await navigate.exitToApp('uk.co.bbc.iplayer', { foo: 'bar' });

        expect(startCalls[0].intent).to.deep.equal({
            action: 'launch',
            context: { source: 'oipf-bbc' },
            data: { foo: 'bar' }
        });
    });

    it('omits intent.data when no params are given', async () => {
        const { navigate, startCalls } = loadNavigate();

        await navigate.exitToApp('uk.co.bbc.iplayer');

        expect(startCalls[0].intent).to.not.have.property('data');
    });

    it('rejects with an OipfError when the Firebolt call fails', async () => {
        const { navigate } = loadNavigate({
            startImpl: () => Promise.reject(new Error('firebolt unreachable'))
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
