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

import TARGET_URLS from 'constants/target_urls';
import OipfError from 'datamodel/oipfError';
import { processConfig } from 'util/config';
import { iterateNvpStr } from 'util/net';

let isInitialized = false;

/**
 * Initialisation of the OIPF for BBC instance. This will start listening to events ({@link EVENT_TYPES}) and
 * merge any OIPF for BBC config.
 * @public
 *
 * @param {Object} [config] A data object which can be used to change the behaviour of certain parts of the OIPF for BBC.
 * Init will look in the app URL for a search parameter called config. If it exists it will be parsed as JSON and then
 * merged with this config parameter. The URL config will take precedence.
 * @throws the promise is rejected, returns a OipfError
 */
export function init(config) {
    if (!isInitialized) {
        isInitialized = true;
        try {
            iterateNvpStr(location.search.substr(1), (name, value) => {
                if (name === 'config') {
                    // value is already percent-decoded by iterateNvpStr (dontDecode defaults to false)
                    // URL config takes precedence (last source wins)
                    config = Object.assign({}, config, JSON.parse(value));
                }
            });
        } catch (e) {}
        processConfig(config);
    } else {
        throw new OipfError('3', 'Library already initialized');
    }
}
