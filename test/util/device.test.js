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
 * Unit tests for the Firebolt-backed helpers in lib/util/device.js:
 *   getCountry, getPreferredAudioLanguages, getClosedCaptionsSettings,
 *   getAudioDescription.
 *
 * Each helper calls a method on the native Firebolt client (via
 * util/firebolt's getFirebolt()). We verify:
 *   - the right module/method is called
 *   - the result is forwarded to the caller
 *   - a rejection from the Firebolt client is rewrapped as OipfError with the
 *     documented code
 *
 * The helpers only exercise util/firebolt, so that's the only collaborator
 * stubbed.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

class FakeOipfError extends Error {
    constructor(code, message, extra) {
        super(message);
        this.code = code;
        this.extra = extra;
        this.name = 'OipfError';
    }
}

function loadDevice({ firebolt, firebolticError } = {}) {
    delete require.cache[require.resolve('util/device')];
    const device = proxyquire('util/device', {
        'util/firebolt': {
            getFirebolt: () => (firebolticError ? Promise.reject(firebolticError) : Promise.resolve(firebolt))
        },
        'datamodel/oipfError': { __esModule: true, default: FakeOipfError }
    });

    return { device };
}

describe('util/device — Firebolt-backed helpers', () => {
    describe('getCountry', () => {
        it('calls Localization.country on the Firebolt client', async () => {
            const calls = [];
            const { device } = loadDevice({
                firebolt: { Localization: { country: () => { calls.push(true); return Promise.resolve('GB'); } } }
            });

            await device.getCountry();

            expect(calls).to.have.length(1);
        });

        it('forwards the Firebolt result unchanged (preserves case)', async () => {
            const { device } = loadDevice({
                firebolt: { Localization: { country: () => Promise.resolve('GB') } }
            });

            const result = await device.getCountry();

            expect(result).to.equal('GB');
        });

        it('forwards "" when the setting is not initialized', async () => {
            const { device } = loadDevice({
                firebolt: { Localization: { country: () => Promise.resolve('') } }
            });

            const result = await device.getCountry();

            expect(result).to.equal('');
        });

        it('wraps a Firebolt rejection in OipfError(311)', async () => {
            const { device } = loadDevice({ firebolticError: new Error('socket down') });

            let caught;
            try {
                await device.getCountry();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.constructor.name).to.equal('FakeOipfError');
            expect(caught.code).to.equal(311);
        });
    });

    describe('getPreferredAudioLanguages', () => {
        it('calls Localization.preferredAudioLanguages and forwards the array result', async () => {
            const { device } = loadDevice({
                firebolt: { Localization: { preferredAudioLanguages: () => Promise.resolve(['eng', 'fra']) } }
            });

            const result = await device.getPreferredAudioLanguages();

            expect(result).to.deep.equal(['eng', 'fra']);
        });

        it('wraps a Firebolt rejection in OipfError(303)', async () => {
            const { device } = loadDevice({ firebolticError: new Error('boom') });

            let caught;
            try {
                await device.getPreferredAudioLanguages();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.code).to.equal(303);
        });
    });

    describe('getClosedCaptionsSettings', () => {
        it('calls Accessibility.closedCaptionsSettings and forwards the settings object by reference', async () => {
            const settings = { enabled: true, preferredLanguages: ['eng'] };
            const { device } = loadDevice({
                firebolt: { Accessibility: { closedCaptionsSettings: () => Promise.resolve(settings) } }
            });

            const result = await device.getClosedCaptionsSettings();

            expect(result).to.equal(settings);
        });

        it('wraps a Firebolt rejection in OipfError(304)', async () => {
            const { device } = loadDevice({ firebolticError: new Error('boom') });

            let caught;
            try {
                await device.getClosedCaptionsSettings();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.code).to.equal(304);
        });
    });

    describe('getAudioDescription', () => {
        it('calls Accessibility.audioDescription and forwards the boolean result', async () => {
            const { device } = loadDevice({
                firebolt: { Accessibility: { audioDescription: () => Promise.resolve(true) } }
            });

            const result = await device.getAudioDescription();

            expect(result).to.equal(true);
        });

        it('wraps a Firebolt rejection in OipfError(318)', async () => {
            const { device } = loadDevice({ firebolticError: new Error('boom') });

            let caught;
            try {
                await device.getAudioDescription();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.code).to.equal(318);
        });
    });

    describe('overall', () => {
        it('each helper returns a Promise and resolves', async () => {
            const { device } = loadDevice({
                firebolt: {
                    Localization: {
                        country: () => Promise.resolve(null),
                        preferredAudioLanguages: () => Promise.resolve(null)
                    },
                    Accessibility: {
                        closedCaptionsSettings: () => Promise.resolve(null),
                        audioDescription: () => Promise.resolve(null)
                    }
                }
            });

            const a = device.getCountry();
            const b = device.getPreferredAudioLanguages();
            const c = device.getClosedCaptionsSettings();
            const d = device.getAudioDescription();

            expect(a).to.be.an.instanceOf(Promise);
            expect(b).to.be.an.instanceOf(Promise);
            expect(c).to.be.an.instanceOf(Promise);
            expect(d).to.be.an.instanceOf(Promise);

            await Promise.all([a, b, c, d]);
        });
    });
});
