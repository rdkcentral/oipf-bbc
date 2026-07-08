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
 * The oipfObjectFactory is used to create the OIPF objects:
 *  - videoBroadcast
 *  - applicationManager
 *  - configuration
 *
 *
 * How To Use
 * ==========
 * oipf objects can be created in two ways.
 *
 * The first is to call the methods on the oipfObjectFactory directly. This will return an HTML element which
 * can be insterted into the DOM if required.
 *
 * The second is to create the object directly in the DOM.
 * To retrieve an OIPF object which has been created in the DOM then document.getElementById *MUST* be used.
 *
 * If any other access methods are required then they will need to be wrapped by the OIPF library.
 *
 */

import VideoBroadcast from 'oipf/VideoBroadcast';
import { default as ApplicationManager } from 'oipf/ApplicationManager';
import { default as Configuration } from 'oipf/Configuration';

// window.KeyEvent = {
//     VK_ENTER: 13,
//     VK_DOWN: 40,
//     VK_LEFT: 37,
//     VK_UP: 38,
//     VK_RIGHT: 39,
//     VK_RED: 403,
//     VK_GREEN: 404,
//     VK_YELLOW: 405,
//     VK_BLUE: 406,
//     VK_REWIND: 37,
//     VK_0: 48,
//     VK_1: 49,
//     VK_2: 50,
//     VK_3: 51,
//     VK_4: 52,
//     VK_5: 53,
//     VK_6: 54,
//     VK_7: 55,
//     VK_8: 56,
//     VK_9: 57
// };

let originalGetElementByID = document.getElementById;

document.getElementById = function() {
    try {
        let element = originalGetElementByID.apply(document, arguments);

        // let type = element.getAttribute("type");
        if (!element) {
            return element;
        }

        if (element.instantiated === true) {
            return element;
        } else if (element.tagName === 'OBJECT') {
            switch (element.type) {
                case 'video/broadcast':
                    return new VideoBroadcast(element);
                case 'application/oipfApplicationManager':
                    return new ApplicationManager(element);
                case 'application/oipfConfiguration':
                    return new Configuration(element);
                default:
                    return element;
            }
        } else {
            return element;
        }
    } catch (e) {
        return null;
    }
};

let originalSetAttribute = Symbol('setAttribute');
let newSetAttribute = function(name, value) {
    let result = this[originalSetAttribute].apply(this, arguments);

    if (name.toLowerCase() === 'type') {
        switch (value) {
            case 'video/broadcast':
                new VideoBroadcast(this);
                break;
            case 'application/oipfApplicationManager':
                new ApplicationManager(this);
                break;
            case 'application/oipfConfiguration':
                new Configuration(this);
                break;
            default:
                break;
        }
    }

    return result;
};

let originalCreateElement = document.createElement;

document.createElement = function(tagName) {
    let element = originalCreateElement.apply(document, arguments);

    try {
        if (element.tagName === 'OBJECT') {
            element[originalSetAttribute] = element.setAttribute;
            element.setAttribute = newSetAttribute;
        }
    } catch (e) {}

    return element;
};

const oipfObjectFactory = {
    /**
     * @public
     * Returns a videoBroadcastObject object.
     * This DOM object can be manipulated to tune to broadcast channels, and to get
     * information about channels and programmes.
     * @return {videoBroadcastObject} The video broadcast object.
     */
    createVideoBroadcastObject: function() {
        return new VideoBroadcast();
    },
    createApplicationManagerObject: function() {
        return new ApplicationManager();
    },
    createConfigurationObject: function() {
        return new Configuration();
    },

    /**
     * @public
     * Returns true if and only if the object of the specified type is supported.
     */
    isObjectSupported: function(mimeType) {
        switch (mimeType) {
            case 'application/oipfApplicationManager':
            case 'application/oipfConfiguration':
            case 'video/broadcast':
                return true;
            default:
                return false;
        }
    }
};

export default oipfObjectFactory;
