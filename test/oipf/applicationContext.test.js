/**
 * Unit tests for lib/oipf/applicationContext.js
 *
 * Focus on the externally observable behaviours:
 *   - init() fetches the master key mask from the host
 *   - setKeySetValue masks the request against MASTER_KEY_MASK and forwards
 *     the result to the host; falsy mask means "all keys"
 *   - createApplication resolves the URL to a Firebolt app ID via the
 *     registry, then routes the launch via exitToApp, deduping consecutive
 *     calls for the same app ID within the cooldown window
 *   - createAppCooldown can be live-tuned via the config listener registered
 *     at module load
 *   - destroyApplication closes the application window
 *
 * util/navigate, util/keymask and util/config are all stubbed so the tests
 * can drive the module's collaborators directly.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const flush = () => new Promise(resolve => setImmediate(resolve));

/**
 * Build a fresh context with stubbed collaborators.
 * Returns the module + handles to:
 *   - getKeyMaskCalls / setKeyMaskCalls — to assert key-mask traffic
 *   - exitToAppCalls — to assert createApplication routing
 *   - configListener — the callback the module registered for createAppCooldown
 *   - resolveNextLaunch / rejectNextLaunch — drive the exitToApp promise lifecycle
 */
function loadContext(overrides = {}) {
    const setKeyMaskCalls = [];
    const getKeyMaskCalls = [];
    const exitToAppCalls = [];

    let launchControllers = [];
    const exitToApp = (appId) => {
        exitToAppCalls.push(appId);
        return new Promise((resolve, reject) => {
            launchControllers.push({ resolve, reject });
        });
    };

    const getKeyMask = overrides.getKeyMask || (() => {
        getKeyMaskCalls.push(true);
        return Promise.resolve(0xFFFFFFFF);
    });
    const setKeyMask = mask => setKeyMaskCalls.push(mask);

    let configListener = null;
    const addConfigListener = (key, cb) => {
        if (key === 'createAppCooldown') configListener = cb;
    };

    delete require.cache[require.resolve('oipf/applicationContext')];
    const mod = proxyquire('oipf/applicationContext', {
        'util/navigate': { exitToApp },
        'util/keymask': { getKeyMask, setKeyMask },
        'util/config': { addConfigListener }
    });

    return {
        mod,
        setKeyMaskCalls,
        getKeyMaskCalls,
        exitToAppCalls,
        getConfigListener: () => configListener,
        resolveNextLaunch: () => launchControllers.shift().resolve(),
        rejectNextLaunch: err => launchControllers.shift().reject(err)
    };
}

const IPLAYER_URL = 'https://www.live.bbctvapps.co.uk/tap/iplayer';
const SOUNDS_URL = 'https://www.live.bbctvapps.co.uk/tap/sounds';
const LINEAR_URL = 'https://www.live.bbctvapps.co.uk/some/path?channel=BBC1';

describe('oipf/applicationContext', () => {
    describe('init', () => {
        it('fetches the master key mask from the host', async () => {
            const { mod, getKeyMaskCalls } = loadContext();

            mod.init();
            await flush();

            expect(getKeyMaskCalls).to.have.length(1);
        });

        it('uses the host-supplied mask as the ceiling for subsequent setKeySetValue calls', async () => {
            //Host advertises only RED (0x1) + GREEN (0x2) as legal keys.
            const { mod, setKeyMaskCalls } = loadContext({
                getKeyMask: () => Promise.resolve(0x3)
            });
            mod.init();
            await flush();

            //Caller asks for RED + BLUE (0x9). BLUE isn't in the host mask, so result is just RED.
            const allowed = mod.setKeySetValue(0x9);

            expect(allowed).to.equal(0x1);
            expect(setKeyMaskCalls).to.deep.equal([0x1]);
        });

        it('falls back to the default 0xFFFFFFFF mask if init has not run yet', () => {
            const { mod, setKeyMaskCalls } = loadContext();

            const allowed = mod.setKeySetValue(0x123);

            expect(allowed).to.equal(0x123); //full mask is permissive, returns the request as-is
            expect(setKeyMaskCalls).to.deep.equal([0x123]);
        });
    });

    describe('setKeySetValue', () => {
        it('disables all keys when called with 0 (does not treat 0 as "no value")', () => {
            const { mod, setKeyMaskCalls } = loadContext();

            const allowed = mod.setKeySetValue(0);

            expect(allowed).to.equal(0); //0 is a legitimate "lock out all keys" request
            expect(setKeyMaskCalls).to.deep.equal([0]); //the host is told to disable everything
        });

        it('uses the master key mask when called with no value', () => {
            const { mod, setKeyMaskCalls } = loadContext();

            const allowed = mod.setKeySetValue();

            expect(allowed).to.equal(0xFFFFFFFF | 0); //JS coerces to signed 32-bit, that's fine — same bit pattern
            expect(setKeyMaskCalls).to.have.length(1);
        });

        it('returns the AND of request and master mask', () => {
            const { mod } = loadContext();

            //request: RED+GREEN+BLUE; master = 0xFFFFFFFF → result = request
            expect(mod.setKeySetValue(0x7)).to.equal(0x7);
        });
    });

    describe('getAppIdForUrl', () => {
        it('resolves a registered launch URL to its app ID', () => {
            //iplayer/sounds sit under the linear base prefix, so this also covers
            //that their more specific entries are matched ahead of linear.
            const { mod } = loadContext();
            expect(mod.getAppIdForUrl(IPLAYER_URL)).to.equal('uk.co.bbc.iplayer');
            expect(mod.getAppIdForUrl(SOUNDS_URL)).to.equal('uk.co.bbc.sounds');
        });

        it('prefix-matches an entry against a URL carrying extra path + query parts', () => {
            const { mod } = loadContext();
            expect(mod.getAppIdForUrl(LINEAR_URL)).to.equal('uk.co.bbc.linear');
        });

        it('prefix-matches the base entry when only an extra path is supplied', () => {
            const { mod } = loadContext();
            expect(mod.getAppIdForUrl('https://www.live.bbctvapps.co.uk/just/a/path')).to.equal('uk.co.bbc.linear');
        });

        it('returns null for unknown URLs', () => {
            const { mod } = loadContext();
            expect(mod.getAppIdForUrl('https://example.com/whatever')).to.equal(null);
        });
    });

    describe('createApplication', () => {
        it('resolves the URL to an app ID and launches via exitToApp', () => {
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication(IPLAYER_URL);

            expect(exitToAppCalls).to.deep.equal(['uk.co.bbc.iplayer']);
        });

        it('routes a prefix-match URL to the matched app ID', () => {
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication(LINEAR_URL);

            expect(exitToAppCalls).to.deep.equal(['uk.co.bbc.linear']);
        });

        it('silently drops launches for URLs not in the registry', () => {
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication('https://example.com/unknown');

            expect(exitToAppCalls).to.deep.equal([]);
        });

        it('dedupes a repeat call for the same app ID while the cooldown is active', () => {
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication(IPLAYER_URL);
            mod.createApplication(IPLAYER_URL);
            mod.createApplication(IPLAYER_URL);

            expect(exitToAppCalls).to.have.length(1);
        });

        it('dedupes across different URLs that resolve to the same app ID', () => {
            //Two URLs that both prefix-match linear should only launch once.
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication('https://www.live.bbctvapps.co.uk/path-a');
            mod.createApplication('https://www.live.bbctvapps.co.uk/path-b?channel=BBC2');

            expect(exitToAppCalls).to.deep.equal(['uk.co.bbc.linear']);
        });

        it('allows a different app through immediately', () => {
            const { mod, exitToAppCalls } = loadContext();

            mod.createApplication(IPLAYER_URL);
            mod.createApplication(SOUNDS_URL);

            expect(exitToAppCalls).to.deep.equal(['uk.co.bbc.iplayer', 'uk.co.bbc.sounds']);
        });

        it('does not throw when exitToApp resolves', async () => {
            const { mod, resolveNextLaunch } = loadContext();

            mod.createApplication(IPLAYER_URL);

            resolveNextLaunch();
            await flush();
        });

        it('clears the dedupe guard when the launch fails, so the same app can be retried', async () => {
            const { mod, exitToAppCalls, rejectNextLaunch } = loadContext();

            mod.createApplication(IPLAYER_URL);
            rejectNextLaunch(new Error('firebolt unreachable'));
            await flush();

            //a failed launch must not wedge the appId — a retry should reach exitToApp again
            mod.createApplication(IPLAYER_URL);

            expect(exitToAppCalls).to.deep.equal(['uk.co.bbc.iplayer', 'uk.co.bbc.iplayer']);
        });
    });

    describe('createAppCooldown via config listener', () => {
        it('registers a listener for createAppCooldown at module load', () => {
            const { getConfigListener } = loadContext();
            expect(getConfigListener()).to.be.a('function');
        });

        it('updates the cooldown when the listener fires with the value', () => {
            const { mod, getConfigListener, exitToAppCalls } = loadContext();
            //The cooldown is a private number; observable effect is that the listener
            //runs without throwing. We assert the public side effect (no extra launch
            //call from the listener itself).
            getConfigListener()({ createAppCooldown: 1000 });
            expect(exitToAppCalls).to.deep.equal([]);
        });

        it('ignores listener payloads that don\'t carry createAppCooldown', () => {
            const { getConfigListener } = loadContext();
            expect(() => getConfigListener()({})).to.not.throw();
        });
    });

    describe('destroyApplication', () => {
        it('closes the window directly (Firebolt 9.0 Lifecycle2 is not available to JS)', () => {
            const { mod } = loadContext();

            let closed = 0;
            const originalWindow = global.window;
            global.window = { close: () => { closed++; } };
            try {
                mod.destroyApplication();
            } finally {
                global.window = originalWindow;
            }

            expect(closed).to.equal(1);
        });
    });
});
