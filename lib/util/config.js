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
 * Description
 * ===========
 * Config utilities
 *
 * How to use
 * ==========
 * Any module which requires configuration data should subscribe to be notified
 * when the config has been finalised.
 *
 * When config has been finalised, any modules which subscribed to be notified
 * will be called back with the data.
 *
 * See functions below for further details
 */

let configCallbacks = {};

/**
 * Register interest in the value of a property of the config.
 * @ignore
 * @param {String}   name     The name of the config object which will be passed into the callback
 * @param {Function} callback The callback function which should be called when the config
 *                            has been finalised. The callback function will be called with one
 *                            parameter, the property of the final config whose name matches the
 *                            name passed into addConfigListener.
 */
export function addConfigListener(name, callback) {
    configCallbacks[name] = callback;
}

/**
 * Process the final config. This should only be done after all config vectors have been
 * merged together.
 * All config callbacks will be called with the config property they asked for.
 * @ignore
 * @return  {Object} config The final config.
 */
export function processConfig(config) {
    if (config) {
        for (let i in configCallbacks) {
            if (Object.prototype.hasOwnProperty.call(config, i)) configCallbacks[i](config[i]);
        }
    }

    configCallbacks = {};
}
