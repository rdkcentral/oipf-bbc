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

/* Tests for window.oipfObjectFactory and the DOM <object> auto-instantiation. */
harness.tests.objectFactory = {
    label: 'Object Factory',
    cases: [
        {
            name: 'oipfObjectFactory is exposed on window',
            run: function () {
                if (typeof oipfObjectFactory === 'undefined') {
                    throw new Error('oipfObjectFactory is not defined');
                }
                return Object.keys(oipfObjectFactory);
            }
        },
        {
            name: 'createVideoBroadcastObject() returns an object',
            run: function () {
                var vb = oipfObjectFactory.createVideoBroadcastObject();
                if (!vb) {
                    throw new Error('createVideoBroadcastObject returned a falsy value');
                }
                return { type: typeof vb, tagName: vb.tagName, hasSetChannel: typeof vb.setChannel };
            }
        },
        {
            name: 'DOM <object type="video/broadcast"> auto-instantiates',
            run: function () {
                var obj = document.createElement('object');
                obj.type = 'video/broadcast';
                obj.id = 'ta-video-broadcast';
                document.body.appendChild(obj);
                var resolved = document.getElementById('ta-video-broadcast');
                document.body.removeChild(obj);
                // The factory overrides document.getElementById and swallows any
                // error from `new VideoBroadcast(element)` by returning null. Off-STB
                // the broadcast service init throws, so this resolves to null; on a
                // real STB it should resolve to a VideoBroadcast view.
                if (resolved === null) {
                    throw new Error(
                        'getElementById returned null — VideoBroadcast instantiation threw ' +
                            '(expected off-STB without a Firebolt service)'
                    );
                }
                if (typeof resolved.setChannel !== 'function') {
                    throw new Error('Resolved object does not expose the VideoBroadcast API');
                }
                return 'auto-instantiated VideoBroadcast via getElementById override';
            }
        }
    ]
};
