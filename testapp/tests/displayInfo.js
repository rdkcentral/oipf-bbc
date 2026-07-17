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
(function () {
    function assertValidVideoMode(mode, i) {
        if (!mode) {
            return;
        }

        if (typeof mode.width !== 'number' || typeof mode.height !== 'number' || typeof mode.framerate !== 'number') {
            throw new Error('videoModes[' + i + '] missing numeric width/height/framerate: ' + JSON.stringify(mode));
        }
        if (!Array.isArray(mode.colorimetry)) {
            throw new Error('videoModes[' + i + '].colorimetry is not an array: ' + JSON.stringify(mode));
        }
    }

    harness.register({
        path: ['onesdk', 'Display Info'],
        cases: [
            {
                name: 'onesdk.VERSION',
                run: function () {
                    if (typeof onesdk.VERSION !== 'string' || !onesdk.VERSION) {
                        throw new Error('expected onesdk.VERSION to be a non-empty string, got: ' + onesdk.VERSION);
                    }
                    return { VERSION: onesdk.VERSION };
                }
            },
            {
                name: 'onesdk.getDisplayInfo()',
                run: function () {
                    // Resolves with { edid } from Firebolt; rejects with an OipfError off-STB.
                    return Promise.resolve(onesdk.getDisplayInfo()).then(function (displayInfo) {
                        if (!displayInfo || typeof displayInfo !== 'object') {
                            throw new Error('getDisplayInfo() resolved with a non-object: ' + JSON.stringify(displayInfo));
                        }
                        if (typeof displayInfo.edid !== 'string') {
                            throw new Error('getDisplayInfo().edid is not a string: ' + JSON.stringify(displayInfo));
                        }
                        return { edid: displayInfo.edid };
                    });
                }
            },
            {
                name: 'getPrimaryDisplay()',
                run: function () {
                    var display = getPrimaryDisplay();
                    if (!display || typeof display !== 'object') {
                        throw new Error('getPrimaryDisplay() returned a non-object: ' + JSON.stringify(display));
                    }
                    if (typeof display.physicalWidth !== 'number' || typeof display.physicalHeight !== 'number') {
                        throw new Error('getPrimaryDisplay() physicalWidth/physicalHeight are not numbers: ' + JSON.stringify(display));
                    }
                    if (!Array.isArray(display.videoModes)) {
                        throw new Error('getPrimaryDisplay().videoModes is not an array: ' + JSON.stringify(display));
                    }
                    display.videoModes.forEach(assertValidVideoMode);
                    return display;
                }
            }
        ]
    });
})();
