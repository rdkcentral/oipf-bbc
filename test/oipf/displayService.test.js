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
 * Unit tests for lib/oipf/displayService.js
 *
 * Focus: the module owns a single DisplayInfo object whose fields are
 * populated lazily from util/display at init() time. The interesting bits are:
 *   - defaults are present before init()
 *   - Firebolt `Display.size` → physicalWidth / physicalHeight
 *   - Firebolt `Display.videoResolutions` tokens are expanded into
 *     width / height / framerate via the `<height>p<framerate>` pattern
 *   - Firebolt `Display.colorimetry` tokens are mapped from `bt709`/`bt2020`
 *     to the underscored `bt_709`/`bt_2020` form BBC consumers expect
 *   - failures from any of the three host calls are swallowed silently
 *     (BBC surface has no runtime error channel — partial population is OK)
 *   - getPrimaryDisplay returns the same reference across calls
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const flush = () => new Promise(resolve => setImmediate(resolve));

function loadService(displayOverrides = {}) {
    const display = Object.assign({
        getDisplaySize: () => Promise.resolve({ width: 0, height: 0 }),
        getDisplayVideoResolutions: () => Promise.resolve([]),
        getDisplayColorimetry: () => Promise.resolve([])
    }, displayOverrides);

    delete require.cache[require.resolve('oipf/displayService')];
    return proxyquire('oipf/displayService', {
        'util/display': display
    });
}

describe('oipf/displayService', () => {
    describe('defaults (before init)', () => {
        it('exposes a zeroed DisplayInfo with no video modes', () => {
            const svc = loadService();

            expect(svc.getPrimaryDisplay()).to.deep.equal({
                physicalWidth: 0,
                physicalHeight: 0,
                videoModes: []
            });
        });
    });

    describe('init — populates from host', () => {
        it('writes physicalWidth / physicalHeight from Display.size (cm)', async () => {
            const svc = loadService({
                getDisplaySize: () => Promise.resolve({ width: 123, height: 71 })
            });

            svc.init();
            await flush();

            const info = svc.getPrimaryDisplay();
            expect(info.physicalWidth).to.equal(123);
            expect(info.physicalHeight).to.equal(71);
        });

        it('expands progressive videoResolutions tokens to {width, height, framerate}', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['720p50', '1080p60', '2160p50']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            svc.init();
            await flush();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(3);
            expect(modes[0]).to.include({ width: 1280, height: 720, framerate: 50 });
            expect(modes[1]).to.include({ width: 1920, height: 1080, framerate: 60 });
            expect(modes[2]).to.include({ width: 3840, height: 2160, framerate: 50 });
        });

        it('accepts interlaced tokens and emits the same {width, height, framerate} shape', async () => {
            //BBC's DisplayInfo surface does not expose a scan-type flag — interlaced
            //entries are parsed (so we don't throw and abort the whole modes branch)
            //but produce a VideoMode indistinguishable from the progressive form.
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080i50', '1080i60']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(2);
            expect(modes[0]).to.include({ width: 1920, height: 1080, framerate: 50 });
            expect(modes[1]).to.include({ width: 1920, height: 1080, framerate: 60 });
            //no `interlaced` key — the public VideoMode shape stays per the BBC spec
            expect(modes[0]).to.not.have.property('interlaced');
            expect(modes[1]).to.not.have.property('interlaced');
        });

        it('handles a mixed progressive + interlaced list without dropping entries', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['720p50', '1080i50', '1080p60']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(3);
            expect(modes.map(m => ({ w: m.width, h: m.height, f: m.framerate }))).to.deep.equal([
                { w: 1280, h: 720, f: 50 },
                { w: 1920, h: 1080, f: 50 },
                { w: 1920, h: 1080, f: 60 }
            ]);
        });

        it('expands the additional CEA-861 heights (1440p, 4320p) from the table', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1440p60', '4320p60']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes[0]).to.include({ width: 2560, height: 1440, framerate: 60 });
            expect(modes[1]).to.include({ width: 7680, height: 4320, framerate: 60 });
        });

        it('maps SD heights (480/576) to their standard 720-wide dimensions', async () => {
            //480/576 are not 16:9 — CEA-861 defines both as 720 wide. They must be
            //represented rather than dropped by the 16:9 derivation.
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['480p60', '480i60', '576p50', '576i50']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(4);
            expect(modes[0]).to.include({ width: 720, height: 480, framerate: 60 });
            expect(modes[1]).to.include({ width: 720, height: 480, framerate: 60 });
            expect(modes[2]).to.include({ width: 720, height: 576, framerate: 50 });
            expect(modes[3]).to.include({ width: 720, height: 576, framerate: 50 });
        });

        it('keeps HD/UHD modes when the host also reports SD modes', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['480p60', '720p50', '1080p60', '2160p50']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes.map(m => ({ w: m.width, h: m.height, f: m.framerate }))).to.deep.equal([
                { w: 720, h: 480, f: 60 },
                { w: 1280, h: 720, f: 50 },
                { w: 1920, h: 1080, f: 60 },
                { w: 3840, h: 2160, f: 50 }
            ]);
        });

        it('falls back to a 16:9 derivation for heights not in the table', async () => {
            //540p is a real 16:9 resolution (qHD) that isn't in our lookup table.
            //width = 540 * 16 / 9 = 960. The formula should pick this up.
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['540p30']),
                getDisplayColorimetry: () => Promise.resolve([])
            });

            await svc.init();

            const [mode] = svc.getPrimaryDisplay().videoModes;
            expect(mode).to.include({ width: 960, height: 540, framerate: 30 });
        });

        it('maps Firebolt colorimetry (bt709/bt2020) to BBC form (bt_709/bt_2020)', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080p60']),
                getDisplayColorimetry: () => Promise.resolve(['bt709', 'bt2020'])
            });

            svc.init();
            await flush();

            const [mode] = svc.getPrimaryDisplay().videoModes;
            expect(mode.colorimetry).to.deep.equal(['bt_709', 'bt_2020']);
        });

        it('gives each videoMode its own colorimetry array (no shared reference)', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['720p50', '1080p60']),
                getDisplayColorimetry: () => Promise.resolve(['bt709'])
            });

            svc.init();
            await flush();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes[0].colorimetry).to.not.equal(modes[1].colorimetry); //distinct arrays
            modes[0].colorimetry.push('mutated');
            expect(modes[1].colorimetry).to.deep.equal(['bt_709']); //other entry unaffected
        });

        it('returns an empty videoModes list when the host reports no resolutions', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve([]),
                getDisplayColorimetry: () => Promise.resolve(['bt709'])
            });

            svc.init();
            await flush();

            expect(svc.getPrimaryDisplay().videoModes).to.deep.equal([]);
        });
    });

    describe('init — failures and bad entries are tolerated', () => {
        it('does not throw or reject when Display.size fails', async () => {
            const svc = loadService({
                getDisplaySize: () => Promise.reject(new Error('host down'))
            });

            await svc.init(); //must not reject

            //size left at defaults, videoModes still populated (empty here)
            const info = svc.getPrimaryDisplay();
            expect(info.physicalWidth).to.equal(0);
            expect(info.physicalHeight).to.equal(0);
        });

        it('does not throw when videoResolutions or colorimetry fails', async () => {
            const svc = loadService({
                getDisplaySize: () => Promise.resolve({ width: 97, height: 56 }),
                getDisplayVideoResolutions: () => Promise.reject(new Error('host down'))
            });

            await svc.init();

            //size still populated despite the modes branch failing
            const info = svc.getPrimaryDisplay();
            expect(info.physicalWidth).to.equal(97);
            expect(info.physicalHeight).to.equal(56);
            expect(info.videoModes).to.deep.equal([]);
        });

        it('skips a token with no `<h>[p|i]<r>` shape but keeps the valid ones', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080p60', 'garbage']),
                getDisplayColorimetry: () => Promise.resolve(['bt709'])
            });

            await svc.init();

            //one bad token is dropped individually — the valid 1080p60 survives
            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(1);
            expect(modes[0]).to.include({ width: 1920, height: 1080, framerate: 60 });
        });

        it('skips a token with an unknown scan-type character', async () => {
            //only `p` (progressive) and `i` (interlaced) are valid scan markers.
            //Anything else (here, `x`) is dropped rather than silently treated as progressive.
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080p60', '1080x60']),
                getDisplayColorimetry: () => Promise.resolve(['bt709'])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(1);
            expect(modes[0]).to.include({ width: 1920, height: 1080, framerate: 60 });
        });

        it('skips a token whose height has no derivable width', async () => {
            //101 isn't SD and isn't a multiple of 9, so the 16:9 formula yields 179.5… — not an integer.
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080p60', '101p60']),
                getDisplayColorimetry: () => Promise.resolve(['bt709'])
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(1);
            expect(modes[0]).to.include({ width: 1920, height: 1080, framerate: 60 });
        });

        it('skips unrecognised colorimetry values but still populates the video modes', async () => {
            const svc = loadService({
                getDisplayVideoResolutions: () => Promise.resolve(['1080p60']),
                getDisplayColorimetry: () => Promise.resolve(['xvYCC601']) //legacy EDID form, not Firebolt
            });

            await svc.init();

            const modes = svc.getPrimaryDisplay().videoModes;
            expect(modes).to.have.length(1);
            expect(modes[0]).to.include({ width: 1920, height: 1080, framerate: 60 });
            expect(modes[0].colorimetry).to.deep.equal([]); //unknown colorimetry dropped, not fatal
        });
    });

    describe('getPrimaryDisplay — reference stability', () => {
        it('returns the same object across calls so consumers see later updates', async () => {
            const svc = loadService({
                getDisplaySize: () => Promise.resolve({ width: 145, height: 83 })
            });

            const before = svc.getPrimaryDisplay();
            svc.init();
            await flush();
            const after = svc.getPrimaryDisplay();

            expect(after).to.equal(before); //same reference
            expect(before.physicalWidth).to.equal(145); //mutated in place
        });
    });
});
