/**
 * Data model for Macs
 * @hideconstructor
 * @ignore
 */
class Macs {
    /**
     * Creates an instance of Macs
     * @param {Object} [data={}] the data object from the middleware with which to instantiate the object
     */
    constructor(data = {}) {
        /**
         * MAC Address of the ethernet interface, eg "20:F1:9E:E6:C1:1C"
         * <br> Due to GDPR do not use this value without discussing with your cable company contact first.
         * @type {String}
         */
        this.ethernetMac = data.ethernetMacAddress || '';

        /**
         * MAC Address of the wifi interface, eg "20:F1:9E:E6:C1:1D"
         * <br> Due to GDPR do not use this value without discussing with your cable company contact first.
         * @type {String}
         */
        this.wirelessMac = data.wirelessMacAddress || '';
    }
}

export default Macs;
