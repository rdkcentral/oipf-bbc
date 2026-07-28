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
 * Unit tests for lib/oipf/configurationContext.js
 *
 * Focus: the module owns a single configuration object whose fields are
 * populated lazily from util/device at init() time. The interesting bits are:
 *   - default values are present before init()
 *   - host values are mapped/forwarded to the ISO codes the consumers expect
 *     (3166-1 alpha-3 for country; 639-2/B is already alpha-3 so passed through)
 *   - missing / unmapped / wrong-type host values leave defaults intact
 *   - rejected host promises don't escape (init never throws)
 *   - getConfiguration returns the same reference across calls (consumers
 *     hand it out by reference and rely on later mutations being visible)
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const flush = () => new Promise(resolve => setImmediate(resolve));

function loadContext(deviceOverrides = {}) {
    const device = Object.assign({
        getCountry: () => Promise.resolve(''),
        getPreferredAudioLanguages: () => Promise.resolve([]),
        getClosedCaptionsSettings: () => Promise.resolve({ enabled: false, preferredLanguages: [] }),
        getAudioDescription: () => Promise.resolve(false)
    }, deviceOverrides);

    delete require.cache[require.resolve('oipf/configurationContext')];
    return proxyquire('oipf/configurationContext', {
        'util/device': device
    });
}

describe('oipf/configurationContext', () => {
    describe('defaults (before init)', () => {
        it('exposes British English defaults with subtitles off', () => {
            const ctx = loadContext();

            expect(ctx.getConfiguration()).to.deep.equal({
                preferredAudioLanguage: 'eng',
                preferredSubtitleLanguage: 'eng',
                countryId: 'GBR',
                subtitlesEnabled: false,
                audioDescriptionEnabled: false
            });
        });
    });

    describe('init — populates from Firebolt', () => {
        it('maps Firebolt country (ISO 3166-1 alpha-2) to alpha-3', async () => {
            const ctx = loadContext({
                getCountry: () => Promise.resolve('BE')
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().countryId).to.equal('BEL');
        });

        it('takes the first preferred audio language (ISO 639-2/B is already alpha-3)', async () => {
            const ctx = loadContext({
                getPreferredAudioLanguages: () => Promise.resolve(['eng', 'fra'])
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().preferredAudioLanguage).to.equal('eng');
        });

        it('takes the first preferred subtitle language from closedCaptionsSettings', async () => {
            const ctx = loadContext({
                getClosedCaptionsSettings: () => Promise.resolve({
                    enabled: false,
                    preferredLanguages: ['eng']
                })
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().preferredSubtitleLanguage).to.equal('eng');
        });

        it('updates subtitlesEnabled from the closedCaptionsSettings.enabled boolean', async () => {
            const ctx = loadContext({
                getClosedCaptionsSettings: () => Promise.resolve({
                    enabled: true,
                    preferredLanguages: []
                })
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().subtitlesEnabled).to.equal(true);
        });

        it('updates audioDescriptionEnabled from the Firebolt boolean', async () => {
            const ctx = loadContext({
                getAudioDescription: () => Promise.resolve(true)
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().audioDescriptionEnabled).to.equal(true);
        });
    });

    describe('init — defaults preserved when Firebolt data is missing or wrong-shaped', () => {
        it('keeps default countryId when Firebolt returns ""', async () => {
            const ctx = loadContext({
                getCountry: () => Promise.resolve('')
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().countryId).to.equal('GBR');
        });

        it('keeps default countryId when Firebolt returns an unmapped country', async () => {
            const ctx = loadContext({
                getCountry: () => Promise.resolve('US')
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().countryId).to.equal('GBR');
        });

        it('keeps default audio language when Firebolt returns []', async () => {
            const ctx = loadContext({
                getPreferredAudioLanguages: () => Promise.resolve([])
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().preferredAudioLanguage).to.equal('eng');
        });

        it('keeps default subtitlesEnabled when Firebolt returns a non-boolean', async () => {
            const ctx = loadContext({
                getClosedCaptionsSettings: () => Promise.resolve({
                    enabled: 'yes please',
                    preferredLanguages: []
                })
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().subtitlesEnabled).to.equal(false);
        });

        it('keeps default audioDescriptionEnabled when Firebolt returns a non-boolean', async () => {
            const ctx = loadContext({
                getAudioDescription: () => Promise.resolve('yes please') //wrong type
            });

            ctx.init();
            await flush();

            expect(ctx.getConfiguration().audioDescriptionEnabled).to.equal(false);
        });
    });

    describe('init — rejection handling', () => {
        it('swallows rejected Firebolt promises (no unhandled rejection escapes)', async () => {
            const ctx = loadContext({
                getCountry: () => Promise.reject(new Error('host down')),
                getPreferredAudioLanguages: () => Promise.reject(new Error('host down')),
                getClosedCaptionsSettings: () => Promise.reject(new Error('host down')),
                getAudioDescription: () => Promise.reject(new Error('host down'))
            });

            ctx.init();
            await flush();

            //defaults intact
            expect(ctx.getConfiguration()).to.deep.equal({
                preferredAudioLanguage: 'eng',
                preferredSubtitleLanguage: 'eng',
                countryId: 'GBR',
                subtitlesEnabled: false,
                audioDescriptionEnabled: false
            });
        });
    });

    describe('getConfiguration — reference stability', () => {
        it('returns the same object across calls so consumers see later updates', async () => {
            const ctx = loadContext({
                getPreferredAudioLanguages: () => Promise.resolve(['fra'])
            });

            const before = ctx.getConfiguration();
            ctx.init();
            await flush();
            const after = ctx.getConfiguration();

            expect(after).to.equal(before); //same reference
            expect(before.preferredAudioLanguage).to.equal('fra'); //and mutated in place
        });
    });
});
