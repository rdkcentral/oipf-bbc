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

/* Tests for bbc.oipfConfiguration. */
harness.tests.configuration = {
    label: 'Configuration',
    cases: [
        {
            name: 'bbc.oipfConfiguration exists',
            run: function () {
                if (!bbc || !bbc.oipfConfiguration) {
                    throw new Error('bbc.oipfConfiguration is not available');
                }
                return Object.keys(bbc.oipfConfiguration);
            }
        },
        {
            name: 'bbc.oipfConfiguration.configuration',
            run: function () {
                // Populated asynchronously from Firebolt during init; read current snapshot.
                return bbc.oipfConfiguration.configuration;
            }
        }
    ]
};
