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
            if (config[i]) configCallbacks[i](config[i]);
        }
    }

    configCallbacks = null;
}
