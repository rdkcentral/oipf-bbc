import { send } from 'util/websockets';
import OipfError from 'datamodel/oipfError';
import TARGET_URLS from 'constants/target_urls';

/*
 * OipfError codes used in this file
 * =================================
 *  401  getDisplayInfo               — failed to fetch EDID
 *  406  getDisplaySize               — failed to fetch physical display size
 *  407  getDisplayVideoResolutions   — failed to fetch supported video resolutions
 *  408  getDisplayColorimetry        — failed to fetch supported colorimetry
 */

const displayModule = '/display/';

/**
 * Gets the physical dimensions of the connected or integral display, in centimeters.
 * @returns {Promise} Promise resolves with `{ width, height }`.
 * @throws the promise is rejected, returns an OipfError
 */
export function getDisplaySize() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Display.size'
    }).catch(e => {
        throw new OipfError(406, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Gets the list of HD video resolutions and frame rates supported by the attached TV or integral display.
 * @returns {Promise} Promise resolves with an array of tokens, e.g. `['720p50', '1080p60', '2160p60']`.
 * @throws the promise is rejected, returns an OipfError
 */
export function getDisplayVideoResolutions() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Display.videoResolutions'
    }).catch(e => {
        throw new OipfError(407, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Gets the list of colorimetry values supported by the attached TV or integral display.
 * @returns {Promise} Promise resolves with an array of tokens, e.g. `['bt709', 'bt2020']`.
 * @throws the promise is rejected, returns an OipfError
 */
export function getDisplayColorimetry() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Display.colorimetry'
    }).catch(e => {
        throw new OipfError(408, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Gets the EDID (Extended Display Identification Data) for the tv or monitor the STB is connected to.
 * @returns {Promise} Promise resolves with a display info object (see example).
 * The `edid` field is the EDID (and extensions) as a Base64 encoded string,
 * or an empty string `""` on an OTT/STB device when no display is connected over HDMI.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getDisplayInfo().then(function(displayInfo) {
 *     console.log(displayInfo);
 * });
 * //example displayInfo object
 * {
 *     "edid": "AP///////wBMLTALAAAAAAEcAQOA..."
 * }
 */
export function getDisplayInfo() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Display.edid'
    })
        .then(edid => ({ edid }))
        .catch(e => {
            throw new OipfError(401, 'An unexpected error occurred', e.printable);
        });
}
