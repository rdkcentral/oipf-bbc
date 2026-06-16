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

import { send } from 'util/websockets';
import TARGET_URLS from 'constants/target_urls';
import OipfError from 'datamodel/oipfError';

/*
 * OipfError codes used in this file
 * =================================
 *  303  getPreferredAudioLanguages   — failed to fetch preferred audio languages
 *  304  getClosedCaptionsSettings    — failed to fetch closed captions settings
 *  311  getCountry                   — failed to fetch country
 *  318  getAudioDescription          — failed to fetch audio description setting
 */

/**
 * Returns the country the STB is in, a 2 character "ISO 3166-1 alpha-2" country code,
 * or "" if the setting is not initialized on the device.
 * Backed by the Firebolt Localization.country API.
 * @public
 *
 * @returns {Promise} Promise resolves with a {String}
 * @example
 * "GB"
 */
export function getCountry() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Localization.country'
    }).catch(e => {
        console.error(e);
        throw new OipfError(311, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Returns the user's preferred audio languages as a list of ISO 639-2/B
 * (alpha-3) codes in decreasing order of preference. Returns an empty list
 * if the setting is not initialized on the device.
 * Backed by Firebolt Localization.preferredAudioLanguages.
 * @public
 *
 * @returns {Promise} Promise resolves with a {String[]}
 * @example
 * ["eng", "fra"]
 */
export function getPreferredAudioLanguages() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Localization.preferredAudioLanguages'
    }).catch(e => {
        console.error(e);
        throw new OipfError(303, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Returns the device's closed captions (subtitles) settings.
 * Backed by Firebolt Accessibility.closedCaptionsSettings.
 * @public
 *
 * @returns {Promise} Promise resolves with an {Object}:
 * <br>    {Boolean} enabled               — whether captions are enabled
 * <br>    {String[]} preferredLanguages  — ISO 639-2/B codes in decreasing order of preference
 * @example
 * { enabled: true, preferredLanguages: ["eng"] }
 */
export function getClosedCaptionsSettings() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Accessibility.closedCaptionsSettings'
    }).catch(e => {
        console.error(e);
        throw new OipfError(304, 'An unexpected error occurred', e.printable);
    });
}

/**
 * Returns whether audio description is enabled on the device.
 * Backed by Firebolt Accessibility.audioDescription.
 * @public
 *
 * @returns {Promise} Promise resolves with a {Boolean}
 * @example
 * true
 */
export function getAudioDescription() {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Accessibility.audioDescription'
    }).catch(e => {
        console.error(e);
        throw new OipfError(318, 'An unexpected error occurred', e.printable);
    });
}
