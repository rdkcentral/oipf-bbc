import { send } from 'util/websockets';
import TARGET_URLS from 'constants/target_urls';
import OipfError from 'datamodel/oipfError';

/**
 * Exit the app and launch another app.
 *
 * Backed by Firebolt Actions.start, which takes:
 *   - intent       — a `launch` intent (per the RDK8 Firebolt Intents Spec, the
 *                    launch action carries no data object, just a context)
 *   - handlerAppId — the app ID to launch
 *   - a third argument carrying any additional parameters. Its name is NOT yet
 *     confirmed by the platform team, so the placeholder below MUST be renamed
 *     once we have confirmation (see TODO).
 *
 * @param  {String} appId - The app ID of the application to launch.
 * @param  {Object} params - Additional parameters to pass to the launched app.
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function exitToApp(appId, params) {
    return send({
        target: TARGET_URLS.Firebolt,
        method: 'Actions.start',
        params: {
            intent: JSON.stringify({
                action: 'launch',
                context: { source: 'oipf-bbc' }
            }),
            handlerAppId: appId,
            // TODO: the name of this third argument is unconfirmed by the
            // platform team — rename once confirmed.
            additionalParameters: params
        }
    }).catch(e => {
        console.error(e);
        throw new OipfError(603, 'An unexpected error occurred', e.printable);
    });
}
