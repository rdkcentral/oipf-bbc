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

import { getFirebolt } from 'util/firebolt';
import OipfError from 'datamodel/oipfError';

/**
 * Exit the app and launch another app.
 *
 * Backed by Firebolt Actions.start, which takes:
 *   - intent       — a `launch` intent object (per the RDK8 Firebolt Intents Spec, the
 *                    launch action carries no data object, just a context)
 *   - handlerAppId — the app ID to launch
 *
 * TODO: `params` (additional launch parameters) has no `additionalParameters`
 * field in the generated Actions.StartParams contract, so it is currently dropped.
 *
 * @param  {String} appId - The app ID of the application to launch.
 * @param  {Object} params - Additional parameters to pass to the launched app (currently unused, see TODO above).
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function exitToApp(appId, params) {
    if (params !== undefined) {
        console.warn('exitToApp: additional params are not yet supported by Firebolt Actions.start — ignoring', params);
    }
    return getFirebolt()
        .then(firebolt =>
            firebolt.Actions.start({
                intent: {
                    action: 'launch',
                    context: { source: 'oipf-bbc' }
                },
                handlerAppId: appId
            })
        )
        .catch(e => {
            console.error(e);
            throw new OipfError(603, 'An unexpected error occurred', e.printable);
        });
}
