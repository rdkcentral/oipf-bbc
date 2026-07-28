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
 * Tests for onesdk display APIs and getPrimaryDisplay. These are global (not tied
 * to an interface type), so they live under their own top-level 'onesdk' category
 * rather than being expanded across bbc/Factory/DOM.
 */
import { harness } from 'harness/harness';
import { DisplayInfoSchema, PrimaryDisplaySchema, VersionSchema, parseOrThrow } from 'harness/schemas';

harness.register({
    path: ['onesdk', 'Display Info'],
    cases: [
        {
            name: 'onesdk.VERSION',
            run: function () {
                parseOrThrow(VersionSchema, onesdk.VERSION, 'onesdk.VERSION');
                return { VERSION: onesdk.VERSION };
            }
        },
        {
            name: 'onesdk.getDisplayInfo()',
            run: function () {
                // Resolves with { edid } from Firebolt; rejects with an OipfError off-STB.
                return Promise.resolve(onesdk.getDisplayInfo()).then(function (displayInfo) {
                    parseOrThrow(DisplayInfoSchema, displayInfo, 'getDisplayInfo()');
                    return { edid: displayInfo.edid };
                });
            }
        },
        {
            name: 'getPrimaryDisplay()',
            run: function () {
                const display = getPrimaryDisplay();
                parseOrThrow(PrimaryDisplaySchema, display, 'getPrimaryDisplay()');
                return display;
            }
        }
    ]
});
