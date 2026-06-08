/**
 * Unit tests for lib/oipf/videoBroadcastService.js
 *
 * Focus: the service's role as the single owner of broadcast state.
 *   - init() populates channelConfig and resolves currentChannel from the host
 *   - State accessors return the right values, with or without a view attached
 *   - attachView enforces the singleton contract
 *   - setChannel branches (null/release, not-found, bad idType, happy tune) emit
 *     the right events on the attached view
 *   - stop() respects the current playState
 *   - Static callers (no view) get the same return values and no event dispatch
 *
 * util/broadcast is fully stubbed so we control channel data, tune outcomes,
 * and the host's "current channel" without touching real I/O.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const {
    PLAYSTATE_UNREALIZED,
    PLAYSTATE_CONNECTING,
    PLAYSTATE_PRESENTING,
    PLAYSTATE_STOPPED
} = require('oipf/constants/playstates');
const { ID_DVB_C, ID_IPTV_URI } = require('oipf/constants/idTypes');
const { COMPONENT_TYPE_AUDIO, COMPONENT_TYPE_SUBTITLE } = require('oipf/constants/componentTypes');

class FakeOipfError extends Error {
    constructor(type, message) {
        super(message || 'oipf error');
        this.type = type;
        this.name = 'OipfError';
    }
}

// A minimal stand-in for the <object type="video/broadcast"> DOM element.
// EventTarget gives us addEventListener/dispatchEvent; arbitrary props (on*) just work.
function makeView() {
    const view = new EventTarget();
    view.events = [];
    view.addEventListener('PlayStateChange', e => view.events.push({ type: 'PlayStateChange', state: e.state, error: e.error }));
    view.addEventListener('ChannelChangeError', e => view.events.push({ type: 'ChannelChangeError', channel: e.channel, errorState: e.errorState }));
    view.addEventListener('ChannelChangeSucceeded', e => view.events.push({ type: 'ChannelChangeSucceeded', channel: e.channel }));
    view.addEventListener('BroadcastReleased', () => view.events.push({ type: 'BroadcastReleased' }));
    return view;
}

const flush = () => new Promise(resolve => setImmediate(resolve));

/**
 * Build a fresh copy of the service with stubbed collaborators.
 * Each test gets isolated module state.
 */
function loadService(overrides = {}) {
    const broadcast = Object.assign({
        getChannels: () => Promise.resolve([]),
        getCurrentChannelId: () => Promise.resolve(null),
        getChannelById: id => Promise.resolve({ ccid: 'ccid:' + id, name: 'host-' + id }),
        listenForTuneCompletion: () => new Promise(() => {}), //hangs forever unless overridden
        tuneToChannelByNumber: () => Promise.resolve(),
        getAudioComponents: () => Promise.resolve([]),
        getSubtitleComponents: () => Promise.resolve([]),
        setAudioComponent: () => {},
        setSubtitleComponent: () => {},
        listenToChannelChange: () => {},
        unregisterChannelChange: () => {}
    }, overrides.broadcast || {});

    // Capture the listener registered at init() so tests can simulate channelErrorListener firing.
    let channelChangeListener = null;
    const originalListen = broadcast.listenToChannelChange;
    broadcast.listenToChannelChange = cb => {
        channelChangeListener = cb;
        return originalListen(cb);
    };

    // ChannelConfig identity-wraps the channel list so tests can pass a plain array
    // and assert against it directly.
    const ChannelConfig = function(channels) {
        return { channelList: channels || [] };
    };

    const AVComponentCollection = function(type, items, audio, subtitle) {
        return { type, items, audio, subtitle };
    };

    delete require.cache[require.resolve('oipf/videoBroadcastService')];
    const service = proxyquire('oipf/videoBroadcastService', {
        'util/broadcast': broadcast,
        'oipf/ChannelConfig': { __esModule: true, default: ChannelConfig },
        'oipf/AVComponentCollection': { __esModule: true, default: AVComponentCollection },
        'oipf/AVComponent': { __esModule: true, fbComponent: Symbol('fbComponent') },
        'datamodel/oipfError': { __esModule: true, default: FakeOipfError }
    });

    return { service, broadcast, getListener: () => channelChangeListener };
}

// Minimal CustomEvent polyfill — Node has it natively from 19+, but be defensive.
if (typeof CustomEvent === 'undefined') {
    global.CustomEvent = class CustomEvent extends Event {
        constructor(type, init = {}) {
            super(type, init);
            this.detail = init.detail;
        }
    };
}

// The service references window.innerWidth/innerHeight inside setChannel(null) to
// restore the player to fullscreen. In a browser these are the viewport size; in
// node we provide a stable stand-in so the assertion can be exact.
if (typeof window === 'undefined') {
    global.window = { innerWidth: 1920, innerHeight: 1080 };
}

describe('oipf/videoBroadcastService', () => {
    describe('init', () => {
        it('builds channelConfig from the host channel list', async () => {
            const channels = [{ ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C }];
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve(channels),
                    getCurrentChannelId: () => Promise.resolve('1001')
                }
            });

            await service.init();

            expect(service.getChannelConfig().channelList).to.equal(channels);
        });

        it('does not mutate currentChannel — that is the job of bind/setChannel', async () => {
            const ch = { ccid: 'ccid:2002', name: 'BBC Two', majorChannel: 2, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('2002')
                }
            });

            await service.init();

            expect(service.getCurrentChannel()).to.equal(null);
        });

        it('is idempotent — getChannels is called only once across repeated init() calls', async () => {
            let calls = 0;
            const { service } = loadService({
                broadcast: {
                    getChannels: () => { calls++; return Promise.resolve([]); },
                    getCurrentChannelId: () => Promise.resolve(null)
                }
            });

            await service.init();
            await service.init();
            await service.init();

            expect(calls).to.equal(1);
        });
    });

    describe('view registration', () => {
        it('throws if a second view is attached', () => {
            const { service } = loadService();
            const a = makeView();
            const b = makeView();

            service.attachView(a);

            expect(() => service.attachView(b)).to.throw(/already attached/);
        });

        it('allows re-attach after detachView', () => {
            const { service } = loadService();
            const a = makeView();
            const b = makeView();

            service.attachView(a);
            service.detachView(a);

            expect(() => service.attachView(b)).to.not.throw();
        });
    });

    describe('resolveCurrentChannel', () => {
        it('returns the channel matching the host-tuned id without mutating state', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001')
                }
            });
            await service.init();

            const resolved = await service.resolveCurrentChannel();

            expect(resolved).to.equal(ch);
            expect(service.getCurrentChannel(), 'pure lookup must not write to currentChannel').to.equal(null);
        });

        it('returns null when the host channel id is not in the table', async () => {
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([{ ccid: 'ccid:1001' }]),
                    getCurrentChannelId: () => Promise.resolve('9999')
                }
            });
            await service.init();

            expect(await service.resolveCurrentChannel()).to.equal(null);
        });
    });

    describe('headless operation (no view attached)', () => {
        it('setChannel(null) does not throw and restores fullscreen via the host', async () => {
            const resizeCalls = [];
            let resumed = 0;
            const { service } = loadService({
                broadcast: {
                    resizePlayer: (...args) => resizeCalls.push(args),
                    resumeBroadcast: () => { resumed++; }
                }
            });
            await service.init();

            expect(() => service.setChannel(null)).to.not.throw();
            expect(resizeCalls).to.deep.equal([[0, 0, window.innerWidth, window.innerHeight]]);
            expect(resumed).to.equal(1);
            expect(service.getPlayState()).to.equal(PLAYSTATE_UNREALIZED);
        });

        it('bindToCurrentChannel populates currentChannel without a view', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001'),
                    getAudioComponents: () => Promise.resolve([]),
                    getSubtitleComponents: () => Promise.resolve([])
                }
            });
            await service.init();

            service.bindToCurrentChannel();
            await flush(); await flush(); await flush();

            expect(service.getCurrentChannel()).to.equal(ch);
            expect(service.getPlayState()).to.equal(PLAYSTATE_PRESENTING);
        });
    });

    describe('setChannel(null) — release', () => {
        it('restores the player to fullscreen, unblanks, and transitions to UNREALIZED', async () => {
            const resizeCalls = [];
            let resumed = 0;
            const { service } = loadService({
                broadcast: {
                    resizePlayer: (...args) => resizeCalls.push(args),
                    resumeBroadcast: () => { resumed++; }
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.setChannel(null);

            expect(resizeCalls).to.deep.equal([[0, 0, window.innerWidth, window.innerHeight]]);
            expect(resumed).to.equal(1);
            expect(view.events).to.deep.equal([
                { type: 'PlayStateChange', state: PLAYSTATE_UNREALIZED, error: undefined }
            ]);
            expect(service.getCurrentChannel()).to.equal(null);
        });
    });

    describe('setChannel — validation branches', () => {
        it('dispatches ChannelChangeError(5) when the channel is not in the channel list', async () => {
            const known = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([known]),
                    getCurrentChannelId: () => Promise.resolve('1001')
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            const stranger = { ccid: 'ccid:9999', name: 'Pirate TV', majorChannel: 999, idType: ID_DVB_C };
            service.setChannel(stranger);

            const err = view.events.find(e => e.type === 'ChannelChangeError');
            expect(err).to.exist;
            expect(err.errorState).to.equal(5);
            expect(err.channel).to.equal(stranger);
        });

        it('dispatches ChannelChangeError(0) when the idType is unsupported', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: 999 };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001')
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.setChannel(ch);

            const err = view.events.find(e => e.type === 'ChannelChangeError');
            expect(err).to.exist;
            expect(err.errorState).to.equal(0);
        });
    });

    describe('setChannel — happy tune', () => {
        it('transitions CONNECTING → PRESENTING and dispatches ChannelChangeSucceeded', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001'),
                    listenForTuneCompletion: () => Promise.resolve(),
                    tuneToChannelByNumber: () => Promise.resolve(),
                    getChannelById: () => Promise.resolve(ch),
                    getAudioComponents: () => Promise.resolve([]),
                    getSubtitleComponents: () => Promise.resolve([])
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.setChannel(ch);
            // Let the listenForTuneCompletion → fetchComponents → getCurrentChannelId → getChannelById chain settle.
            await flush();
            await flush();
            await flush();

            const states = view.events.filter(e => e.type === 'PlayStateChange').map(e => e.state);
            expect(states).to.deep.equal([PLAYSTATE_CONNECTING, PLAYSTATE_PRESENTING]);

            const success = view.events.find(e => e.type === 'ChannelChangeSucceeded');
            expect(success).to.exist;
            expect(success.channel).to.equal(ch);

            expect(service.getPlayState()).to.equal(PLAYSTATE_PRESENTING);
            expect(service.getCurrentChannel()).to.equal(ch);
        });

        it('maps OipfError types to the corresponding OIPF error codes', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001'),
                    listenForTuneCompletion: () => Promise.reject(new FakeOipfError(102)),
                    tuneToChannelByNumber: () => Promise.resolve()
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.setChannel(ch);
            await flush();
            await flush();

            const err = view.events.find(e => e.type === 'ChannelChangeError');
            expect(err, 'OipfError type 102 (tunerUnlocked) should map to OIPF error 1').to.exist;
            expect(err.errorState).to.equal(1);
        });
    });

    describe('stop', () => {
        it('moves PRESENTING → STOPPED', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001'),
                    listenForTuneCompletion: () => Promise.resolve(),
                    tuneToChannelByNumber: () => Promise.resolve(),
                    getChannelById: () => Promise.resolve(ch)
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);
            service.setChannel(ch);
            await flush(); await flush(); await flush();

            view.events.length = 0;
            service.stop();

            expect(service.getPlayState()).to.equal(PLAYSTATE_STOPPED);
            expect(view.events).to.deep.equal([
                { type: 'PlayStateChange', state: PLAYSTATE_STOPPED, error: undefined }
            ]);
        });

        it('is a no-op while UNREALIZED', async () => {
            const { service } = loadService();
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.stop();

            expect(service.getPlayState()).to.equal(PLAYSTATE_UNREALIZED);
            expect(view.events.filter(e => e.type === 'PlayStateChange')).to.deep.equal([]);
        });
    });

    describe('bindToCurrentChannel', () => {
        it('dispatches ChannelChangeError(5) when the host channel is not in the channel list', async () => {
            const { service } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([{ ccid: 'ccid:1001' }]),
                    getCurrentChannelId: () => Promise.resolve('9999')
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);

            service.bindToCurrentChannel();
            await flush(); await flush();

            const err = view.events.find(e => e.type === 'ChannelChangeError');
            expect(err).to.exist;
            expect(err.errorState).to.equal(5);
            expect(err.channel).to.equal(null);
        });
    });

    describe('channelErrorListener (tunerUnlocked while PRESENTING)', () => {
        it('clears currentChannel, moves to UNREALIZED, and dispatches the error with the previous channel', async () => {
            const ch = { ccid: 'ccid:1001', name: 'BBC One', majorChannel: 1, idType: ID_DVB_C };
            const { service, getListener } = loadService({
                broadcast: {
                    getChannels: () => Promise.resolve([ch]),
                    getCurrentChannelId: () => Promise.resolve('1001'),
                    listenForTuneCompletion: () => Promise.resolve(),
                    tuneToChannelByNumber: () => Promise.resolve(),
                    getChannelById: () => Promise.resolve(ch)
                }
            });
            await service.init();
            const view = makeView();
            service.attachView(view);
            service.setChannel(ch);
            await flush(); await flush(); await flush();

            // Sanity: we're presenting.
            expect(service.getPlayState()).to.equal(PLAYSTATE_PRESENTING);

            view.events.length = 0;
            const listener = getListener();
            expect(listener, 'service.init() should have registered a channel-change listener').to.be.a('function');
            listener({ eventInfo: 'tunerUnlocked' });

            expect(service.getCurrentChannel()).to.equal(null);
            expect(service.getPlayState()).to.equal(PLAYSTATE_UNREALIZED);

            const err = view.events.find(e => e.type === 'ChannelChangeError');
            expect(err).to.exist;
            expect(err.channel).to.equal(ch); //carries the previously-tuned channel
            expect(err.errorState).to.equal(1);
        });

        it('ignores tunerUnlocked when not PRESENTING', async () => {
            const { service, getListener } = loadService();
            await service.init();
            const view = makeView();
            service.attachView(view);

            getListener()({ eventInfo: 'tunerUnlocked' });

            expect(view.events).to.deep.equal([]);
            expect(service.getPlayState()).to.equal(PLAYSTATE_UNREALIZED);
        });
    });

    describe('selectComponent', () => {
        it('routes audio components to setAudioComponent and subtitle components to setSubtitleComponent', async () => {
            const audioCalls = [];
            const subtitleCalls = [];
            const fbComponent = Symbol('fbComponent');

            delete require.cache[require.resolve('oipf/videoBroadcastService')];
            const service = proxyquire('oipf/videoBroadcastService', {
                'util/broadcast': {
                    getChannels: () => Promise.resolve([]),
                    getCurrentChannelId: () => Promise.resolve(null),
                    getChannelById: () => Promise.resolve(null),
                    listenForTuneCompletion: () => new Promise(() => {}),
                    tuneToChannelByNumber: () => Promise.resolve(),
                    getAudioComponents: () => Promise.resolve([]),
                    getSubtitleComponents: () => Promise.resolve([]),
                    setAudioComponent: c => audioCalls.push(c),
                    setSubtitleComponent: c => subtitleCalls.push(c),
                    listenToChannelChange: () => {},
                    unregisterChannelChange: () => {}
                },
                'oipf/ChannelConfig': { __esModule: true, default: function() { return { channelList: [] }; } },
                'oipf/AVComponentCollection': { __esModule: true, default: function() {} },
                'oipf/AVComponent': { __esModule: true, fbComponent },
                'datamodel/oipfError': { __esModule: true, default: FakeOipfError }
            });

            await service.init();

            const audio = { type: COMPONENT_TYPE_AUDIO, [fbComponent]: 'audio-handle' };
            const subtitle = { type: COMPONENT_TYPE_SUBTITLE, [fbComponent]: 'sub-handle' };

            service.selectComponent(audio);
            service.selectComponent(subtitle);

            expect(audioCalls).to.deep.equal(['audio-handle']);
            expect(subtitleCalls).to.deep.equal(['sub-handle']);
        });
    });
});
