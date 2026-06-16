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
 * ApplicationManager feature, exercised via bbc / factory / DOM. The common
 * member across all three access types is getOwnerApplication().
 */
(function () {
    harness.registerOipfFeature({
        key: 'applicationManager',
        label: 'Application Manager',
        accessors: {
            bbc: function () {
                return bbc.oipfApplicationManager;
            },
            factory: function () {
                return oipfObjectFactory.createApplicationManagerObject();
            },
            dom: harness.domObjectAccessor('application/oipfApplicationManager', 'ta-app-manager')
        },
        cases: [
            {
                name: 'exposes getOwnerApplication()',
                run: function (am) {
                    if (!am) {
                        throw new Error('object not available (accessor returned null)');
                    }
                    if (typeof am.getOwnerApplication !== 'function') {
                        throw new Error('missing method: getOwnerApplication');
                    }
                    return 'getOwnerApplication present';
                }
            },
            {
                name: 'getOwnerApplication()',
                run: function (am) {
                    var app = am.getOwnerApplication();
                    if (!app) {
                        throw new Error('getOwnerApplication() returned a falsy value');
                    }
                    return { type: typeof app, keys: Object.keys(app) };
                }
            }
        ]
    });
})();
