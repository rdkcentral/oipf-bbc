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

import OipfError from 'datamodel/oipfError';

/*
 * OipfError codes used in this file
 * =================================
 *  205  getFirebolt — FireboltServiceManager is not injected on window.FireboltServiceManager
 */

let fireboltClientPromise = null;

/**
 * Resolve the FireboltServiceManager global injected by the WPE WebKit extension.
 * @ignore
 * @throws {OipfError} 205 if the global is missing
 */
function resolveFireboltServiceManager() {
    const manager = window.FireboltServiceManager;
    if (!manager || typeof manager.get !== 'function') {
        throw new OipfError(205, 'FireboltServiceManager is not defined on window.FireboltServiceManager');
    }
    return manager;
}

/**
 * Returns the singleton Firebolt client. Fetches it via
 * FireboltServiceManager.get() on first call and caches the promise for
 * subsequent callers; a rejection clears the cache so the next call retries
 * instead of being stuck with a permanently rejected promise.
 * @ignore
 * @returns {Promise<FireboltClient>}
 */
export function getFirebolt() {
    if (!fireboltClientPromise) {
        fireboltClientPromise = Promise.resolve()
            .then(() => resolveFireboltServiceManager().get())
            .catch(err => {
                fireboltClientPromise = null;
                throw err;
            });
    }
    return fireboltClientPromise;
}
