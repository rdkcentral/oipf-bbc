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
import { harness } from 'harness/harness';

harness.register<ApplicationManager>({
    path: [harness.INTERFACE, 'Application Manager'],
    accessors: {
        bbc: function () {
            return bbc.oipfApplicationManager;
        },
        factory: function () {
            return oipfObjectFactory.createApplicationManagerObject();
        },
        dom: harness.domObjectAccessor<ApplicationManager>('application/oipfApplicationManager', 'ta-app-manager')
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
                const app = am.getOwnerApplication(document);
                if (!app) {
                    throw new Error('getOwnerApplication() returned a falsy value');
                }
                return { type: typeof app, keys: Object.keys(app) };
            }
        },
        {
            name: 'owner application properties',
            run: function (am) {
                const app = am.getOwnerApplication(document);
                if (!app) {
                    throw new Error('getOwnerApplication() returned a falsy value');
                }
                const checks: Record<string, string> = {
                    'show': typeof app.show,
                    'privateData.keyset.setValue': typeof (app.privateData && app.privateData.keyset && app.privateData.keyset.setValue),
                    'createApplication': typeof app.createApplication,
                    'destroyApplication': typeof app.destroyApplication
                };
                const bad = Object.keys(checks).filter(function (k) {
                    return checks[k] !== 'function';
                });
                if (bad.length) {
                    throw new Error('not functions: ' + bad.join(', '));
                }
                return checks;
            }
        },
        {
            name: 'privateData.keyset.setValue(ALL)',
            run: function (am) {
                const app = am.getOwnerApplication(document);
                if (!app) {
                    throw new Error('getOwnerApplication() returned a falsy value');
                }
                return { calculatedMask: app.privateData.keyset.setValue(0xffffffff) };
            }
        },
        {
            // DESTRUCTIVE: launches another app — only runs when activated.
            name: 'createApplication(iPlayer) — launches another app',
            manual: true,
            run: function (am) {
                const app = am.getOwnerApplication(document);
                if (!app) {
                    throw new Error('getOwnerApplication() returned a falsy value');
                }
                app.createApplication('https://www.live.bbctvapps.co.uk/tap/iplayer');
                return 'createApplication called — launching uk.co.bbc.iplayer';
            }
        },
        {
            // DESTRUCTIVE: closes the current app (window.close) — only runs when activated.
            name: 'destroyApplication() — closes this app',
            manual: true,
            run: function (am) {
                const app = am.getOwnerApplication(document);
                if (!app) {
                    throw new Error('getOwnerApplication() returned a falsy value');
                }
                app.destroyApplication();
                return 'destroyApplication called — closing app';
            }
        }
    ]
});
