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
 * Tests for bbc.videoBroadcast — the core broadcast/tuning flow.
 *
 * On a real STB these talk to Firebolt and tune the tuner. Off-STB (no Firebolt
 * service at ws://127.0.0.1:9998) the promise-based cases render a clean FAIL
 * with the OipfError, which exercises the harness error rendering.
 */
(function () {
    var vb = function () {
        return bbc.videoBroadcast;
    };

    harness.tests.videoBroadcast = {
        label: 'Video Broadcast',
        cases: [
            {
                name: 'getChannelConfig()',
                run: function () {
                    return Promise.resolve(vb().getChannelConfig());
                }
            },
            {
                name: 'currentChannel (getter)',
                run: function () {
                    return vb().currentChannel;
                }
            },
            {
                name: 'playState (getter)',
                run: function () {
                    return { playState: vb().playState };
                }
            },
            {
                name: 'getComponents()',
                run: function () {
                    return Promise.resolve(vb().getComponents());
                }
            },
            {
                name: 'PlayStateChange listener (logs to Log pane)',
                run: function () {
                    var obj = document.createElement('object');
                    obj.type = 'video/broadcast';
                    obj.id = 'ta-vb-events';
                    document.body.appendChild(obj);
                    var el = document.getElementById('ta-vb-events');
                    if (!el || typeof el.addEventListener !== 'function') {
                        throw new Error('VideoBroadcast object does not support addEventListener');
                    }
                    el.addEventListener('PlayStateChange', function (e) {
                        harness.log('PlayStateChange -> state=' + (e && e.state));
                    });
                    return 'Listener attached; PlayStateChange events will appear in the Log pane.';
                }
            },
            {
                name: 'Tune flow: bind -> read state -> stop',
                run: function () {
                    var b = vb();
                    return Promise.resolve(b.bindToCurrentChannel())
                        .then(function () {
                            harness.log('bindToCurrentChannel resolved; playState=' + b.playState);
                            return Promise.resolve(b.stop());
                        })
                        .then(function () {
                            return { currentChannel: b.currentChannel, playState: b.playState };
                        });
                }
            }
        ]
    };
})();
