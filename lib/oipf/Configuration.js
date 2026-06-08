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
