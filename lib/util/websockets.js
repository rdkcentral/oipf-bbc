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

import TARGET_URLS from 'constants/target_urls';
import OipfError from 'datamodel/oipfError';
import { addConfigListener } from 'util/config';

/*
 * OipfError codes used in this file
 * =================================
 *  201  openWebSocket   — WebSocket closed unexpectedly
 *  202  openWebSocket   — WebSocket connection timed out
 *  203  registerEvent   — failed to subscribe to an event
 *  204  send            — no response received before the request timeout
 *
 * Note: JSON-RPC error responses are rewrapped with the server-supplied
 * error code rather than one of the codes above.
 */

const JSONRPC_VERSION = '2.0';

const websocketPool = [];
const websocketMessagePool = [];
const websocketEventSubscriptions = {};
let uniqueId = 0;

// How long to wait for a JSON-RPC response before rejecting the request.
// Without this a dropped socket (or a silent server) leaves the pending
// request — and its promise — hanging forever. Overridable via config.
let requestTimeoutMillis = 10000;

addConfigListener('websockets', function(o) {
    if (o.requestTimeoutMillis !== undefined) requestTimeoutMillis = o.requestTimeoutMillis;
});

/**
 * Track an in-flight JSON-RPC request so its response can be correlated by id,
 * and arm a timeout that rejects (and removes) the request if no response
 * arrives — so a dropped socket or unresponsive server can't hang the caller.
 * @ignore
 */
function addPendingRequest(id, resolve, reject) {
    const timeoutId = setTimeout(() => {
        const index = websocketMessagePool.findIndex(m => m.id === id);
        if (index >= 0) {
            websocketMessagePool.splice(index, 1);
            reject(new OipfError(204, `request ${id} timed out after ${requestTimeoutMillis}ms with no response`));
        }
    }, requestTimeoutMillis);
    websocketMessagePool.push({ id, resolve, reject, timeoutId });
}

function messageHandler(message) {
    let data;
    try {
        data = JSON.parse(message.data);
    } catch (err) {
        console.error(`messageHandler: Can't handle ${message.data}`);
        return;
    }

    if (data.jsonrpc !== JSONRPC_VERSION) {
        console.error(`messageHandler: Not a JSON-RPC 2.0 message`, data);
        return;
    }

    if (data.id !== undefined && data.id !== null) {
        // Response to a method call or subscription acknowledgement
        const poolIndex = websocketMessagePool.findIndex(m => m.id === data.id);
        if (poolIndex >= 0) {
            const poolItem = websocketMessagePool.splice(poolIndex, 1)[0];
            clearTimeout(poolItem.timeoutId);
            if (data.error) {
                poolItem.reject(new OipfError(data.error.code, data.error.message));
            } else {
                poolItem.resolve(data.result);
            }
        }
    } else if (data.method) {
        // Server-push notification — no id
        const subscription = websocketEventSubscriptions[data.method];
        if (subscription) {
            subscription.callbacks.forEach(callback => callback(data.params));
        }
    }
}

function getWebSocket(target) {
    function createWebSocket() {
        return new Promise((resolve, reject) => {
            const attemptsCount = 3;
            let attemptNumber = 1;
            const colones = console;

            function openWebSocket() {
                const ws = new WebSocket(target);
                const id = setTimeout(() => {
                    ws.close();
                }, 2000);
                ws.onmessage = messageHandler;
                ws.onopen = () => {
                    clearTimeout(id);
                    resolve(ws);
                };
                ws.onclose = event => {
                    clearTimeout(id);
                    if (attemptNumber < attemptsCount) {
                        attemptNumber++;
                        colones.log(`WebSocket to target ${target} opening attempt ${attemptNumber} of ${attemptsCount}`);
                        openWebSocket();
                    } else {
                        console.log(`WebSocket to target ${target} opening ran out of retries`);
                        if (!event.wasClean || event.code !== 1000) {
                            reject(new OipfError(201, `WebSocket to ${target} closed unexpectedly`, event.code));
                        } else {
                            reject(new OipfError(202, `WebSocket to ${target} timed out`));
                        }
                    }
                };
                ws.onerror = err => {
                    // err object doesn't have any interesting information,
                    // and onerror is always succeded by an onclose,
                    // so we only handle on close.
                    // console.log(err);
                };
            }

            openWebSocket();
        });
    }
    if (!websocketPool[target]) {
        websocketPool[target] = createWebSocket();
    }
    return websocketPool[target].then(ws => {
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
            websocketPool[target] = createWebSocket();
            return websocketPool[target];
        }
        return ws;
    });
}

/*
 * NOTE
 * All public one sdk methods must check if init has been called. Existing methods just log an error to the
 * console and new methods return/reject with an error. The checking onbehalf of existing methods is delegated to this
 * send method as all call send directly or indirectly.
*/
/**
 * Sends a JSON-RPC 2.0 request to STB code via a websocket.
 * @ignore
 * @param  {String} target                  Which websocket to send the request to. Will be one of TARGET_URLS.
 * @param  {String} method                  The JSON-RPC method in Module.method format, e.g. 'Player.setVolume'.
 * @param  {Object} [params]                The request params. Omitted from the request if not provided.
 * @return {Promise}                        Resolves with the value of the JSON-RPC result field.
 *                                          Rejects with an OipfError whose code and message are taken from the JSON-RPC error object.
 */
export function send({ target, method, params }) {
    return new Promise((resolve, reject) => {
        getWebSocket(target)
            .then(ws => {
                const id = ++uniqueId;
                const message = { jsonrpc: JSONRPC_VERSION, id, method };
                if (params !== undefined && params !== null) {
                    message.params = params;
                }
                const request = JSON.stringify(message);
                addPendingRequest(id, resolve, reject);
                console.debug(`send: ${request}`);
                ws.send(request);
            })
            .catch(reject);
    });
}

function sendSubscription(target, method, listen) {
    return new Promise((resolve, reject) => {
        getWebSocket(target)
            .then(ws => {
                const id = ++uniqueId;
                const request = JSON.stringify({
                    jsonrpc: JSONRPC_VERSION,
                    id,
                    method,
                    params: { listen }
                });
                addPendingRequest(id, resolve, reject);
                console.debug(`send: ${request}`);
                ws.send(request);
            })
            .catch(reject);
    });
}

/**
 * Subscribe to an event on the given websocket target.
 * Sends a JSON-RPC 2.0 request with params: { listen: true } and tracks the callback.
 * Subsequent calls for the same event add callbacks without re-subscribing.
 * @ignore
 * @param  {String}   target   The websocket target URL (one of TARGET_URLS).
 * @param  {String}   method   The event method name in Module.onEventName format.
 * @param  {Function} callback Called with the notification's params when the event fires.
 * @return {Promise}           Resolves when the subscription is acknowledged by the server.
 */
export function registerEvent(target, method, callback) {
    const isFirstSubscriber = !websocketEventSubscriptions[method];
    if (isFirstSubscriber) {
        websocketEventSubscriptions[method] = { target, callbacks: [] };
    }
    if (typeof callback === 'function') {
        websocketEventSubscriptions[method].callbacks.push(callback);
    }
    if (isFirstSubscriber) {
        return sendSubscription(target, method, true).catch(err => {
            delete websocketEventSubscriptions[method];
            throw new OipfError(203, `registerEvent: failed to subscribe to ${method} on ${target}: ${err && err.message ? err.message : err}`);
        });
    }
    return Promise.resolve();
}

export function unregisterEvent(method, callback) {
    const subscription = websocketEventSubscriptions[method];
    if (!subscription) return;

    const i = subscription.callbacks.indexOf(callback);
    if (i >= 0) {
        subscription.callbacks.splice(i, 1);
    }

    if (subscription.callbacks.length === 0) {
        const { target } = subscription;
        delete websocketEventSubscriptions[method];
        sendSubscription(target, method, false).catch(err => {
            console.error(`unregisterEvent: failed to unsubscribe from ${method}`, err);
        });
    }
}

export function cleanup() {
    //TODO
    // unsubscribe event listeners from AS
    // reject all promises
    // close all websocket connections
    // empty all pools
    // reset uniqueId
}
