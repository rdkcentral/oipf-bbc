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
                    return Promise.resolve(vb.getChannelConfig());
                }
            },
            {
                name: 'currentChannel (getter)',
                run: function (vb) {
                    return vb.currentChannel;
                }
            },
            {
                name: 'playState (getter)',
                run: function (vb) {
                    return { playState: vb.playState };
                }
            },
            {
                name: 'getComponents()',
                run: function (vb) {
                    return Promise.resolve(vb.getComponents());
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
                name: 'Tune flow: bind -> read state -> stop',
                run: function (vb) {
                    return Promise.resolve(vb.bindToCurrentChannel())
                        .then(function () {
                            harness.log('bindToCurrentChannel resolved; playState=' + vb.playState);
                            return Promise.resolve(vb.stop());
                        })
                        .then(function () {
                            return { currentChannel: vb.currentChannel, playState: vb.playState };
                        });
                }
            }
        ]
    });
})();
