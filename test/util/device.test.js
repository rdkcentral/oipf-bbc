/**
 * Unit tests for the Firebolt-backed helpers in lib/util/device.js:
 *   getCountry, getPreferredAudioLanguages, getClosedCaptionsSettings,
 *   getAudioDescription.
 *
 * Each helper wraps util/websockets.send with a fixed Firebolt target URL
 * and a Firebolt JSON-RPC method name. We verify:
 *   - the target URL comes from TARGET_URLS.Firebolt
 *   - the method names match the Firebolt 8.0 spec
 *   - the send() result is forwarded to the caller
 *   - send() rejections are rewrapped as OipfError with the documented code
 *
 * The helpers only exercise util/websockets and constants/target_urls, so
 * those are the only collaborators stubbed.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const FIREBOLT_URL = 'ws://test-firebolt/jsonrpc';

function loadDevice({ sendImpl } = {}) {
    const calls = [];
    const fireboltSend = args => {
        calls.push(args);
        return sendImpl ? sendImpl(args) : Promise.resolve(null);
    };

    delete require.cache[require.resolve('util/device')];
    const device = proxyquire('util/device', {
        'util/websockets': { send: fireboltSend },
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

    return { device, calls };
}

describe('util/device — Firebolt-backed helpers', () => {
    describe('getCountry', () => {
        it('calls Localization.country at the Firebolt target', async () => {
            const { device, calls } = loadDevice({ sendImpl: () => Promise.resolve('GB') });

            await device.getCountry();

            expect(calls).to.have.length(1);
            expect(calls[0]).to.deep.equal({
                target: FIREBOLT_URL,
                method: 'Localization.country'
            });
        });

        it('forwards the Firebolt result unchanged (preserves case)', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.resolve('GB') });

            const result = await device.getCountry();

            expect(result).to.equal('GB');
        });

        it('forwards "" when the setting is not initialized', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.resolve('') });

            const result = await device.getCountry();

            expect(result).to.equal('');
        });

        it('wraps a send() rejection in OipfError(311)', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.reject(new Error('socket down')) });

            let caught;
            try {
                await device.getCountry();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.constructor.name).to.equal('OipfError');
            expect(caught.code).to.equal(311);
        });
    });

    describe('getPreferredAudioLanguages', () => {
        it('calls Localization.preferredAudioLanguages and forwards the array result', async () => {
            const { device, calls } = loadDevice({
                sendImpl: () => Promise.resolve(['eng', 'fra'])
            });

            const result = await device.getPreferredAudioLanguages();

            expect(calls).to.have.length(1);
            expect(calls[0]).to.deep.equal({
                target: FIREBOLT_URL,
                method: 'Localization.preferredAudioLanguages'
            });
            expect(result).to.deep.equal(['eng', 'fra']);
        });

        it('wraps a send() rejection in OipfError(303)', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.reject(new Error('boom')) });

            let caught;
            try {
                await device.getPreferredAudioLanguages();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.constructor.name).to.equal('OipfError');
            expect(caught.code).to.equal(303);
        });
    });

    describe('getClosedCaptionsSettings', () => {
        it('calls Accessibility.closedCaptionsSettings and forwards the settings object by reference', async () => {
            const settings = { enabled: true, preferredLanguages: ['eng'] };
            const { device, calls } = loadDevice({ sendImpl: () => Promise.resolve(settings) });

            const result = await device.getClosedCaptionsSettings();

            expect(calls).to.have.length(1);
            expect(calls[0]).to.deep.equal({
                target: FIREBOLT_URL,
                method: 'Accessibility.closedCaptionsSettings'
            });
            expect(result).to.equal(settings);
        });

        it('wraps a send() rejection in OipfError(304)', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.reject(new Error('boom')) });

            let caught;
            try {
                await device.getClosedCaptionsSettings();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.constructor.name).to.equal('OipfError');
            expect(caught.code).to.equal(304);
        });
    });

    describe('getAudioDescription', () => {
        it('calls Accessibility.audioDescription and forwards the boolean result', async () => {
            const { device, calls } = loadDevice({ sendImpl: () => Promise.resolve(true) });

            const result = await device.getAudioDescription();

            expect(calls).to.have.length(1);
            expect(calls[0]).to.deep.equal({
                target: FIREBOLT_URL,
                method: 'Accessibility.audioDescription'
            });
            expect(result).to.equal(true);
        });

        it('wraps a send() rejection in OipfError(318)', async () => {
            const { device } = loadDevice({ sendImpl: () => Promise.reject(new Error('boom')) });

            let caught;
            try {
                await device.getAudioDescription();
            } catch (err) {
                caught = err;
            }
            expect(caught).to.exist;
            expect(caught.constructor.name).to.equal('OipfError');
            expect(caught.code).to.equal(318);
        });
    });

    describe('overall', () => {
        it('each helper issues exactly one Firebolt send call and returns a Promise', async () => {
            const { device, calls } = loadDevice({ sendImpl: () => Promise.resolve(null) });

            const a = device.getCountry();
            const b = device.getPreferredAudioLanguages();
            const c = device.getClosedCaptionsSettings();
            const d = device.getAudioDescription();

            expect(a).to.be.an.instanceOf(Promise);
            expect(b).to.be.an.instanceOf(Promise);
            expect(c).to.be.an.instanceOf(Promise);
            expect(d).to.be.an.instanceOf(Promise);

            await Promise.all([a, b, c, d]);

            expect(calls.map(c => c.method)).to.deep.equal([
                'Localization.country',
                'Localization.preferredAudioLanguages',
                'Accessibility.closedCaptionsSettings',
                'Accessibility.audioDescription'
            ]);
        });
    });
});
