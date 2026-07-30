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

import { getCountry, getPreferredAudioLanguages, getClosedCaptionsSettings, getAudioDescription } from 'util/device';

const configuration = {
    preferredAudioLanguage: 'eng',
    preferredSubtitleLanguage: 'eng',
    countryId: 'GBR',
    subtitlesEnabled: false,
    audioDescriptionEnabled: false
};

const iso3166_2to3char = {
    gb: 'GBR',
    be: 'BEL'
};

export function init() {
    getCountry()
        .then(country => {
            if (country) {
                const mapped = iso3166_2to3char[country.toLowerCase()];
                if (mapped) configuration.countryId = mapped;
            }
        })
        .catch(() => {});

    getPreferredAudioLanguages()
        .then(languages => {
            if (Array.isArray(languages) && languages.length > 0) {
                configuration.preferredAudioLanguage = languages[0];
            }
        })
        .catch(() => {});

    getClosedCaptionsSettings()
        .then(settings => {
            if (!settings) return;
            if (typeof settings.enabled === 'boolean') {
                configuration.subtitlesEnabled = settings.enabled;
            }
            if (Array.isArray(settings.preferredLanguages) && settings.preferredLanguages.length > 0) {
                configuration.preferredSubtitleLanguage = settings.preferredLanguages[0];
            }
        })
        .catch(() => {});

    getAudioDescription()
        .then(enabled => {
            if (typeof enabled === 'boolean') {
                configuration.audioDescriptionEnabled = enabled;
            }
        })
        .catch(() => {});
}

export function getConfiguration() {
    return configuration;
}
