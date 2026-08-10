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
 * Unit tests for lib/util/display.js
 *
 * Focus: the new Firebolt-backed helpers (and the rewritten getDisplayInfo)
 * that talk to Firebolt over JSON-RPC via util/websockets.
 *   - each helper sends the right `method` to the Firebolt target
 *   - the response is returned to the caller unmodified for size/resolutions
 *     /colorimetry; getDisplayInfo decodes the base64 EDID string into a
 *     Uint8Array and wraps it into an object
 *   - rejections from the websocket layer are rewrapped as OipfError with the
 *     code documented in the module header
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const FIREBOLT_TARGET = 'ws://localhost:9998/jsonrpc';

class FakeOipfError extends Error {
    constructor(code, message, extra) {
        super(message);
        this.code = code;
        this.extra = extra;
        this.name = 'OipfError';
    }
}

function loadDisplay({ sendResult, sendError } = {}) {
    const sendCalls = [];
    const send = params => {
        sendCalls.push(params);
        if (sendError) return Promise.reject(sendError);
        return Promise.resolve(sendResult);
    };

    delete require.cache[require.resolve('util/display')];
    const display = proxyquire('util/display', {
        'util/websockets': { send },
        'util/websockets-legacy': { send: () => Promise.reject(new Error('legacy send not expected in these tests')) },
        'datamodel/oipfError': FakeOipfError,
        'constants/target_urls': { __esModule: true, default: { Firebolt: FIREBOLT_TARGET } }
    });

    return { display, sendCalls };
}

describe('util/display — Firebolt helpers', () => {
    describe('getDisplaySize', () => {
        it('calls Display.size on the Firebolt target and returns the payload', async () => {
            const { display, sendCalls } = loadDisplay({ sendResult: { width: 123, height: 71 } });

            const result = await display.getDisplaySize();

            expect(sendCalls).to.deep.equal([{ target: FIREBOLT_TARGET, method: 'Display.size' }]);
            expect(result).to.deep.equal({ width: 123, height: 71 });
        });

        it('rewraps a websocket rejection as OipfError 406', async () => {
            const cause = new Error('host down');
            cause.printable = 'host down (printable)';
            const { display } = loadDisplay({ sendError: cause });

            try {
                await display.getDisplaySize();
                expect.fail('expected getDisplaySize to reject');
            } catch (err) {
                expect(err).to.be.instanceOf(FakeOipfError);
                expect(err.code).to.equal(406);
                expect(err.extra).to.equal('host down (printable)');
            }
        });
    });

    describe('getDisplayVideoResolutions', () => {
        it('calls Display.videoResolutions and returns the array verbatim', async () => {
            const { display, sendCalls } = loadDisplay({
                sendResult: ['720p50', '1080p60', '2160p60']
            });

            const result = await display.getDisplayVideoResolutions();

            expect(sendCalls).to.deep.equal([{ target: FIREBOLT_TARGET, method: 'Display.videoResolutions' }]);
            expect(result).to.deep.equal(['720p50', '1080p60', '2160p60']);
        });

        it('rewraps a websocket rejection as OipfError 407', async () => {
            const { display } = loadDisplay({ sendError: new Error('host down') });

            try {
                await display.getDisplayVideoResolutions();
                expect.fail('expected getDisplayVideoResolutions to reject');
            } catch (err) {
                expect(err.code).to.equal(407);
            }
        });
    });

    describe('getDisplayColorimetry', () => {
        it('calls Display.colorimetry and returns the array verbatim', async () => {
            const { display, sendCalls } = loadDisplay({
                sendResult: ['bt709', 'bt2020']
            });

            const result = await display.getDisplayColorimetry();

            expect(sendCalls).to.deep.equal([{ target: FIREBOLT_TARGET, method: 'Display.colorimetry' }]);
            expect(result).to.deep.equal(['bt709', 'bt2020']);
        });

        it('rewraps a websocket rejection as OipfError 408', async () => {
            const { display } = loadDisplay({ sendError: new Error('host down') });

            try {
                await display.getDisplayColorimetry();
                expect.fail('expected getDisplayColorimetry to reject');
            } catch (err) {
                expect(err.code).to.equal(408);
            }
        });
    });

    describe('getDisplayInfo', () => {
        it('calls Display.edid and decodes the base64 string into { edid: Uint8Array }', async () => {
            const { display, sendCalls } = loadDisplay({ sendResult: 'AP8AVGVzdA==' });

            const result = await display.getDisplayInfo();

            expect(sendCalls).to.deep.equal([{ target: FIREBOLT_TARGET, method: 'Display.edid' }]);
            expect(result).to.deep.equal({ edid: new Uint8Array([0, 255, 0, 84, 101, 115, 116]) });
        });

        it('passes through an empty Uint8Array when no display is connected', async () => {
            const { display } = loadDisplay({ sendResult: '' });

            const result = await display.getDisplayInfo();

            expect(result).to.deep.equal({ edid: new Uint8Array(0) });
        });

        it('rewraps a websocket rejection as OipfError 401', async () => {
            const { display } = loadDisplay({ sendError: new Error('host down') });

            try {
                await display.getDisplayInfo();
                expect.fail('expected getDisplayInfo to reject');
            } catch (err) {
                expect(err.code).to.equal(401);
            }
        });
    });
});
