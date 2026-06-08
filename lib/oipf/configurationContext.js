import { getCountry, getPreferredAudioLanguages, getClosedCaptionsSettings, getAudioDescription } from 'util/device';

const configuration = {
    preferedAudioLanguage: 'eng',
    preferedSubtitleLanguage: 'eng',
    countryId: 'gbr',
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
                configuration.preferedAudioLanguage = languages[0];
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
                configuration.preferedSubtitleLanguage = settings.preferredLanguages[0];
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
