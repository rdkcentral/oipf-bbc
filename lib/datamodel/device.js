/**
 * Data model for Device
 * @ignore
 * @hideconstructor
 */
class Device {
    /**
     * Creates an instance of Device
     * @param {Object} [data={}] the data object from the middleware with which to instantiate the object
     */
    constructor(data = {}) {
        /**
         * Middleware version, eg "4.11"
         * @type {String}
         */
        this.middlewareVersion = data.appVersion || '';

        /**
         * 2 letter country code, which follows ISO 3166-1 alpha-2
         * @type {String}
         */
        this.country = data.country || '';

        /**
         * Firmware version, eg "DCX960__-MON-PRD-00.01-048-AI-AL-20180816102208-NA004"
         * @type {String}
         */
        this.firmwareVersion = data.firmwareVersion || '';

        /**
         * STB identifier, eg "3C36E4-EOSSTB-003503653101"
         * Due to GDPR do not use this value without discussing with your cable company contact first.
         * @type {String}
         */
        this.deviceId = data.id || '';

        /**
         * Conditional Access serial number, eg "00 0011 6023 33"
         * Due to GDPR do not use this value without discussing with your cable company contact first.
         * @type {String}
         */
        this.caSerialNumber = data.caSerialNumber || '';
    }
}

export default Device;
