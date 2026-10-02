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
 * Unit tests for lib/util/firebolt.js.
 *
 * Focus:
 *   - getFirebolt() resolves via window.FireboltServiceManager.get()
 *   - the resulting client is cached, so a second call doesn't call get() again
 *   - a rejection clears the cache so the next call retries instead of being
 *     stuck with a permanently rejected promise
 *   - a missing/malformed FireboltServiceManager global rejects with
 *     OipfError 205
 */

const { expect } = require('chai');

class FakeOipfError extends Error {
    constructor(code, message, extra) {
        super(message);
        this.code = code;
        this.extra = extra;
        this.name = 'OipfError';
    }
}

const proxyquire = require('proxyquire').noCallThru();

function loadFirebolt() {
    delete require.cache[require.resolve('util/firebolt')];
    return proxyquire('util/firebolt', {
        'datamodel/oipfError': { __esModule: true, default: FakeOipfError }
    });
}

describe('util/firebolt', () => {
    const originalManager = global.window.FireboltServiceManager;

    afterEach(() => {
        global.window.FireboltServiceManager = originalManager;
    });

    it('resolves with the client returned by FireboltServiceManager.get()', async () => {
        const client = { Device: {} };
        global.window.FireboltServiceManager = { get: () => Promise.resolve(client) };

        const firebolt = loadFirebolt();
        const result = await firebolt.getFirebolt();

        expect(result).to.equal(client);
    });

    it('caches the client — a second call does not invoke get() again', async () => {
        let getCalls = 0;
        global.window.FireboltServiceManager = {
            get: () => {
                getCalls++;
                return Promise.resolve({});
            }
        };

        const firebolt = loadFirebolt();
        await firebolt.getFirebolt();
        await firebolt.getFirebolt();

        expect(getCalls).to.equal(1);
    });

    it('rejects with OipfError 205 when FireboltServiceManager is not defined', async () => {
        delete global.window.FireboltServiceManager;

        const firebolt = loadFirebolt();
        let caught;
        try {
            await firebolt.getFirebolt();
        } catch (err) {
            caught = err;
        }

        expect(caught).to.be.instanceOf(FakeOipfError);
        expect(caught.code).to.equal(205);
    });

    it('clears the cache on rejection so the next call retries', async () => {
        let getCalls = 0;
        global.window.FireboltServiceManager = {
            get: () => {
                getCalls++;
                return getCalls === 1 ? Promise.reject(new Error('first attempt failed')) : Promise.resolve({ ok: true });
            }
        };

        const firebolt = loadFirebolt();

        let firstError;
        try {
            await firebolt.getFirebolt();
        } catch (err) {
            firstError = err;
        }
        expect(firstError).to.be.an('error');

        const result = await firebolt.getFirebolt();

        expect(getCalls).to.equal(2);
        expect(result).to.deep.equal({ ok: true });
    });
});
