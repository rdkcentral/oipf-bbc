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

/**
 * Description
 * ===========
 *
 * How To Use
 * ==========
 *
 * EITHER:
 *      Add the following HTML to your document; <object id="configuration" type="application/oipfConfiguration"></object>
 *      Use document.getElementById to access this object. Any other dom lookup methods are not supported.
 * OR:
 *      Call the method oipfObjectFactory.createConfigurationObject() to gain an instance of the Configuration object.
 *      Insert the object into your document.
 *
 */

import 'oipf/oipf.scss';
import { init as initConfigurationContext, getConfiguration } from 'oipf/configurationContext';

export function init() {
    initConfigurationContext();
}

/**
 * @constructor
 * @param {application/oipfConfiguration}[configurationElem] If a configuration tag has already been created in the Dom, this is that element.
 */
export default function Configuration(configurationElem) {
    if (!configurationElem) {
        configurationElem = document.createElement('object');
        configurationElem.type = 'application/oipfConfiguration';
    }

    configurationElem.instantiated = true;
    configurationElem.configuration = getConfiguration();

    return configurationElem;
}
