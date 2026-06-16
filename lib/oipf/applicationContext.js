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

import { exitToApp } from 'util/navigate';
import { getKeyMask, setKeyMask } from 'util/keymask';
import { addConfigListener } from 'util/config';

let MASTER_KEY_MASK = 4294967295; //hex value 0xFFFFFFFF which enables all keys allowed by Main UI
let createdApplicationAppId = undefined;
let createdApplicationTimerId = undefined;
let createAppCooldown = 60000;

addConfigListener('createAppCooldown', function(o) {
    if (o.createAppCooldown !== undefined) createAppCooldown = o.createAppCooldown;
});

/**
 * Fetch the master key mask from the host.
 */
export function init() {
    getKeyMask()
        .then(function(mask) {
            MASTER_KEY_MASK = mask;
        })
        .catch(console.error);
}

/**
 * Registry of BBC apps mapping launch URL → Firebolt app ID. The OIPF surface
 * lets callers launch by URL, but the underlying Firebolt launch
 * call takes an app ID — so any URL-based launch needs to be resolved through
 * this table first.
 *
 * An entry's `url` is treated as a prefix: an incoming URL matches if it equals
 * or starts with the registered `url`. This lets us route URLs that carry extra
 * path/query parts (e.g. linear's channel parameters) without enumerating them.
 *
 * TODO: uk.co.bbc.linear needs path/channel parameters passed through, but we
 * don't yet know how Firebolt's launch accepts them — for now the
 * base URL just resolves the app ID and any extra parts are ignored.
 */
const apps = [
    { appId: 'uk.co.bbc.iplayer', context: 'Standalone', url: 'https://www.live.bbctvapps.co.uk/tap/iplayer' },
    { appId: 'uk.co.bbc.sounds', context: 'Standalone', url: 'https://www.live.bbctvapps.co.uk/tap/sounds' },
    { appId: 'uk.co.bbc.linear', context: 'Terminal-initiated-linear', url: 'https://www.live.bbctvapps.co.uk/' }
];

/**
 * Resolve a launch URL to a Firebolt app ID using the registry.
 * Returns the first entry whose `url` is a prefix of the incoming URL, or null
 * if no entry matches.
 */
export function getAppIdForUrl(url) {
    const match = apps.find(app => url.startsWith(app.url));
    return match ? match.appId : null;
}

/**
 * Create a new application.
 * Currently does not support nested applications so instead creates a new application context.
 * URLs are resolved to a Firebolt app ID via the registry; URLs not in the
 * registry are a silent no-op (the OIPF surface has no error channel back to
 * the BBC caller).
 * @param {String} url Destination url of the new application.
 */
export function createApplication(url) {
    const appId = getAppIdForUrl(url);
    if (!appId) return; //URL not in registry — silently drop the launch

    if (createdApplicationAppId && appId === createdApplicationAppId) return;

    clearTimeout(createdApplicationTimerId);
    createdApplicationAppId = appId;

    exitToApp(appId)
        .then(function() {
            createdApplicationTimerId = setTimeout(() => {
                createdApplicationAppId = undefined;
            }, createAppCooldown);
        })
        .catch(function() {
            // Launch failed — clear the dedupe guard so the caller can retry,
            createdApplicationAppId = undefined;
        });
}

/**
 * Destroy the current application.
 * Because nested applications are not supported this actually closes the application context.
 */
export function destroyApplication() {
    window.close();
}

/**
 * The OIPF owner application object
 */
export const application = {
    show: function() {},
    privateData: {
        keyset: {
            setValue: setKeySetValue
        }
    },
    createApplication: createApplication,
    destroyApplication: destroyApplication
};

/**
 * Set the key mask.
 * Uses the standard OIPF mappings with some extras:
 *
 * RED = 0x1
 * GREEN = 0x2
 * YELLOW = 0x4
 * BLUE = 0x8
 * NAVIGATION (UP, DOWN, LEFT, RIGHT, ENTER, BACK) = 0x10
 * MEDIA (PLAY, PAUSE, STOP, FFWD, REWIND, PLAYPAUSE) = 0x20
 * SCROLL (PAGE_UP, PAGE_DOWN) = 0x40
 * INFO = 0x80
 * NUMERIC (numbers 0 to 9) = 0x100
 * ALPHA (all alphabets) = 0x200
 * SPACE = 0x400
 * BACKSPACE = 0x800
 * SEARCH = 0x1000
 * SUBTITLE = 0x2000
 * TELETEXT = 0x4000
 * HELP = 0x8000
 * CONTEXT = 0x10000
 * ALL = 0xFFFFFFFF
 *
 * @param {number} The key mask to apply
 * @return {number} The calculated key mask. This may not be the actual key mask
 * if setKeySetValue is called before the library can request the actual key mask.
 */
export function setKeySetValue(mask) {
    if (mask == null) mask = MASTER_KEY_MASK;
    let allowedMask = MASTER_KEY_MASK & mask;
    setKeyMask(allowedMask);

    return allowedMask;
}
