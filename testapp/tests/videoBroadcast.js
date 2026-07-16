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

/*
 * VideoBroadcast feature, exercised via bbc / factory / DOM. The cases below are
 * shared across all three access types; each receives the resolved object (vb).
 *
 * On a real STB these talk to Firebolt and tune the tuner. Off-STB the factory
 * and DOM accessors fail to instantiate (rendered as a setup error), while the
 * bbc facade resolves but its Firebolt-backed calls reject (rendered per case).
 */
(function () {
    var METHODS = ['getChannelConfig', 'bindToCurrentChannel', 'setChannel', 'getComponents', 'selectComponent', 'stop'];

    // OIPF play states (see the VideoBroadcast spec): 0 UNREALIZED, 1 CONNECTING,
    // 2 PRESENTING, 3 STOPPED. Not exposed as globals to the test app, so mirrored here.
    var VALID_PLAY_STATES = [0, 1, 2, 3];

    function isArrayLike(value) {
        return !!value && typeof value.item === 'function' && typeof value.length === 'number';
    }

    function assertValidChannel(channel) {
        if (typeof channel !== 'object') {
            throw new Error('expected currentChannel to be an object, got: ' + typeof channel);
        }
        if (typeof channel.ccid !== 'string') {
            throw new Error('channel is missing a string ccid: ' + JSON.stringify(channel));
        }
    }

    function assertValidPlayState(playState) {
        if (VALID_PLAY_STATES.indexOf(playState) === -1) {
            throw new Error('expected playState to be one of ' + VALID_PLAY_STATES.join(', ') + ', got: ' + playState);
        }
    }

    harness.register({
        path: [harness.INTERFACE, 'Video Broadcast'],
        accessors: {
            bbc: function () {
                return bbc.videoBroadcast;
            },
            factory: function () {
                return oipfObjectFactory.createVideoBroadcastObject();
            },
            dom: harness.domObjectAccessor('video/broadcast', 'ta-video-broadcast')
        },
        cases: [
            {
                name: 'exposes the VideoBroadcast API',
                run: function (vb) {
                    if (!vb) {
                        throw new Error('object not available (accessor returned null)');
                    }
                    var missing = METHODS.filter(function (m) {
                        return typeof vb[m] !== 'function';
                    });
                    if (missing.length) {
                        throw new Error('missing methods: ' + missing.join(', '));
                    }
                    return 'all expected methods present';
                }
            },
            {
                name: 'getChannelConfig()',
                run: function (vb) {
                    return Promise.resolve(vb.getChannelConfig()).then(function (config) {
                        if (!config) {
                            throw new Error('getChannelConfig() returned a falsy value');
                        }
                        if (!isArrayLike(config.channelList)) {
                            throw new Error('getChannelConfig().channelList is not array-like (missing length/item()): ' + JSON.stringify(config.channelList));
                        }
                        return { channelCount: config.channelList.length };
                    });
                }
            },
            {
                name: 'currentChannel (getter)',
                run: function (vb) {
                    var channel = vb.currentChannel;
                    assertValidChannel(channel);
                    return { currentChannel: channel };
                }
            },
            {
                name: 'playState (getter)',
                run: function (vb) {
                    var playState = vb.playState;
                    assertValidPlayState(playState);
                    return { playState: playState };
                }
            },
            {
                name: 'getComponents()',
                run: function (vb) {
                    return Promise.resolve(vb.getComponents()).then(function (components) {
                        if (components !== null && components !== undefined && !isArrayLike(components)) {
                            throw new Error('getComponents() is neither null/undefined nor array-like (missing length/item()): ' + JSON.stringify(components));
                        }
                        return { components: components };
                    });
                }
            },
            {
                name: 'PlayStateChange listener (logs to Log pane)',
                run: function (vb) {
                    // The bbc facade is not an EventTarget; events come from the
                    // underlying DOM/factory object only.
                    if (typeof vb.addEventListener !== 'function') {
                        return 'no EventTarget interface on this access type (expected for the bbc facade)';
                    }
                    // The resolved object is cached, so reopening this group re-runs
                    // the case — attach only once to avoid stacking duplicate listeners.
                    if (vb.__playStateLogged) {
                        return 'Listener already attached; PlayStateChange events appear in the Log pane.';
                    }
                    vb.__playStateLogged = true;
                    vb.addEventListener('PlayStateChange', function (e) {
                        harness.log('PlayStateChange -> state=' + (e && e.state));
                    });
                    return 'Listener attached; PlayStateChange events will appear in the Log pane.';
                }
            },
            {
                name: 'bindToCurrentChannel (bind -> read state -> stop) ',
                run: function (vb) {
                    return Promise.resolve(vb.bindToCurrentChannel())
                        .then(function (boundChannel) {
                            assertValidChannel(boundChannel);
                            assertValidPlayState(vb.playState);
                            harness.log('bindToCurrentChannel resolved; channel=' + (boundChannel && boundChannel.ccid) + '; playState=' + vb.playState);
                            return Promise.resolve(vb.stop());
                        })
                        .then(function () {
                            var currentChannel = vb.currentChannel;
                            var playState = vb.playState;
                            assertValidChannel(currentChannel);
                            assertValidPlayState(playState);
                            return { currentChannel: currentChannel, playState: playState };
                        });
                }
            }
        ]
    });
})();
