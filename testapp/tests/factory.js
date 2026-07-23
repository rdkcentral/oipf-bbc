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
 * oipfObjectFactory — factory-level tests (isObjectSupported). These live
 * directly under the Factory branch rather than being expanded per interface
 * because isObjectSupported is a factory method with no bbc or DOM equivalent.
 */
import { harness } from 'harness/harness.js';

harness.register({
    path: ['Factory', 'isObjectSupported'],
    cases: [
        {
            name: 'method is present on oipfObjectFactory',
            run: function () {
                if (typeof oipfObjectFactory.isObjectSupported !== 'function') {
                    throw new Error('isObjectSupported is not a function on oipfObjectFactory');
                }
                return 'isObjectSupported present';
            }
        },
        {
            name: 'returns true for video/broadcast',
            run: function () {
                const result = oipfObjectFactory.isObjectSupported('video/broadcast');
                if (result !== true) {
                    throw new Error('expected true, got: ' + result);
                }
                return result;
            }
        },
        {
            name: 'returns true for application/oipfApplicationManager',
            run: function () {
                const result = oipfObjectFactory.isObjectSupported('application/oipfApplicationManager');
                if (result !== true) {
                    throw new Error('expected true, got: ' + result);
                }
                return result;
            }
        },
        {
            name: 'returns true for application/oipfConfiguration',
            run: function () {
                const result = oipfObjectFactory.isObjectSupported('application/oipfConfiguration');
                if (result !== true) {
                    throw new Error('expected true, got: ' + result);
                }
                return result;
            }
        },
        {
            name: 'returns false for an unknown MIME type',
            run: function () {
                const result = oipfObjectFactory.isObjectSupported('application/unknown');
                if (result !== false) {
                    throw new Error('expected false, got: ' + result);
                }
                return result;
            }
        },
        {
            name: 'returns false for an empty string',
            run: function () {
                const result = oipfObjectFactory.isObjectSupported('');
                if (result !== false) {
                    throw new Error('expected false, got: ' + result);
                }
                return result;
            }
        }
    ]
});
