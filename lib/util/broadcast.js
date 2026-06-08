import Channel from 'datamodel/channel';
import EpgEvent from 'datamodel/epgevent';
import OipfError from 'datamodel/oipfError';
import TARGET_URLS from 'constants/target_urls';
import { addConfigListener } from 'util/config';
import { typeOf } from 'util/general';

//the main UI api expects a resolution of 1280x720 for the player size, so we down scale the values to match
let playerScaleFactor = 0.66667;

//reference to the channel tune timeout
let tuneTimeout = null;
let tuneTimeoutMillis = 10000;

//channel event listener
let chanChangeListener = null;

// channel tune API
let useOldSetChannel = false; //should we use the new set channel api's or the deprecated set channel api?

const channelsModule = 'channels/';
const playerModule = '/player/';
const epgModule = 'epg/';

addConfigListener('broadcast', function(o) {
    console.log('broadcast: onConfigLoaded', o);
    if (o.playerScaleFactor !== undefined) playerScaleFactor = o.playerScaleFactor;
    if (o.tuneTimeoutMillis !== undefined) tuneTimeoutMillis = o.tuneTimeoutMillis;
});

/**
 * Get TV channel metadata information from the box.
 * @param {String[]} [channelIdsArray] - channelIds of required channels. When omitted all channel data will be returned (optional)
 * @returns {Promise} This promise returns with an array of {@link Channel}s.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getChannels(["0062","0064"]).then(function(channelsArray) {
 *     console.log(channelsArray);
 * });
 */
export function getChannels(channelIdsArray) {
    // TODO(migration): re-implement via the new transport (util/websockets).
    // Previously sent AS websocket command 'getChannels' with body
    //   { payload: { channelIds: channelIdsArray } } (module 'channels/') and
    //   mapped each result entry to a new Channel(c).
    // Temporary init shim: resolve with an empty channel list so
    // videoBroadcastService.init() can build a ChannelConfig and app
    // initialisation does not break while migration is pending.
    return Promise.resolve([]);
}

/**
 * Finds the {@link Channel} object from a channel number.
 * @param {Number} channelNumber the number of the TV channel that is sought
 * @returns {Promise} The promise returns a {@link Channel} object which matches the given channel number.
 * @throws the promise is rejected, returns a OipfError
 * @example onesdk.getChannelByNumber(101).then(function(channel) {
 *     console.log(channel);
 * });
 */
export function getChannelByNumber(channelNumber) {
    return getChannels()
        .then(channels => {
            return channels.find(channel => {
                if (channel.channelNumber === channelNumber) {
                    return channel;
                }
            });
        })
        .catch(e => {
            console.error(e);
            throw new OipfError(110, 'An unexpected error occurred', e.printable);
        });
}

/**
 * Finds the {@link Channel} object from a channel name.
 * @param {String} name the name of the TV channel that is sought
 * @returns {Promise} The promise returns a {@link Channel} object which matches the given channel name.
 * @throws the promise is rejected, returns a OipfError
 * @example onesdk.getChannelByName("Cartoon").then(function(channel) {
 *     console.log(channel);
 * });
 */
export function getChannelByName(name) {
    return getChannels()
        .then(channels => {
            return channels.find(channel => {
                if (channel.name === name) {
                    return channel;
                }
            });
        })
        .catch(e => {
            console.error(e);
            throw new OipfError(107, 'An unexpected error occurred', e.printable);
        });
}

/**
 * Finds the {@link Channel} object from a channel id.
 * @param {String} id the id of the TV channel that is sought
 * @returns {Promise} The promise returns a {@link Channel} object which matches the given channel id.
 * @throws the promise is rejected, returns a OipfError
 * @example onesdk.getChannelById("0022").then(function(channel) {
 *     console.log(channel);
 * });
 */
export function getChannelById(id) {
    return getChannels([id])
        .then(channels => channels[0])
        .catch(e => {
            console.error(e);
            throw new OipfError(108, 'An unexpected error occurred', e.printable);
        });
}

/**
 * To find the ID of the currently tuned TV channel.
 * @returns {Promise} The resolved value holds the channelId of the channel that the box is currently tuned to.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getCurrentChannelId().then(function(chanId) {
 *     console.log(chanId);
 * });
 * //example chanId output
 * "0245"
 */
export function getCurrentChannelId() {
    // TODO(migration): re-implement via the new transport (util/websockets).
    // Previously sent MainUI websocket command 'getCurrentChannel' (module 'channels/')
    // and resolved with channelId.toString().
}

/**
 * Clear any ongoing tune listener
 * @ignore
 */
function clearChannelChangeListener() {
    unregisterChannelChange(chanChangeListener);
    chanChangeListener = null;
}

/**
 * To tune to a TV channel using a channel number. If you dont know the channel number, use {@link tuneToChannel} instead.
 * @param {Number} channelNumber - the channel number of the channel to tune to
 * @returns {Promise} Promise resolves when the tune has completed with a {@link Channel} object which matches the given channel number.
 * @throws the promise is rejected, returns a OipfError
 */
export function tuneToChannelByNumber(channelNumber) {
    return getChannels()
        .then(channels => {
            let channel = channels.find(channel => {
                if (channel.channelNumber === channelNumber) {
                    return channel;
                }
            });

            if (channel) return channel;
            else throw new OipfError(135, `Channel number '${channelNumber}' does not exist`);
        })
        .then(tuneToChannel)
        .catch(e => {
            console.error(e);
            throw new OipfError(123, 'An unexpected error occurred', e.printable);
        });
}

/**
 * To tune to a TV channel using a channel name. If you dont know the channel name, use {@link tuneToChannel} instead.
 * @param {Number} name - the channel name of the channel to tune to
 * @returns {Promise} Promise resolves when the tune has completed with a {@link Channel} object which matches the given channel name.
 * @throws the promise is rejected, returns a OipfError
 */
export function tuneToChannelByName(name) {
    return getChannels()
        .then(channels => {
            let channel = channels.find(channel => {
                if (channel.name === name) {
                    return channel;
                }
            });

            if (channel) return channel;
            else throw new OipfError(134, `Channel name '${name}' does not exist`);
        })
        .then(tuneToChannel)
        .catch(e => {
            console.error(e);
            throw new OipfError(132, 'An unexpected error occurred', e.printable);
        });
}

/**
 * To tune to a TV channel using a channel ID. If you dont know the channel ID, use {@link tuneToChannel} instead.
 * @param {String} channelId - the channel ID of the channel to tune to
 * @returns {Promise} Promise resolves when the tune has completed with a {@link Channel} object which matches the given channel ID.
 * @throws the promise is rejected, returns a OipfError
 */
export function tuneToChannelById(channelId) {
    return getChannelById(channelId)
        .then(channel => {
            if (channel) return tuneToChannel(channel);
            else throw new OipfError(133, `Channel id '${channelId}' does not exist`);
        })
        .catch(e => {
            console.error(e);
            throw new OipfError(124, 'An unexpected error occurred', e.printable);
        });
}

/**
 *
 * Applies listeners for tune events, specifically tuneLocked, tuneUnlocked and videoPlaying.
 * If videoPlaying is received before a configurable timeout then the Promise will resolve.
 * If no videoPlaying is received, or a tuneUnlocked event is received, then the Promise will reject.
 *
 * @ignore
 * @param  {Object} chanId - the channelId of the channel for which to listen for events
 * @returns {Promise} Promise resolves when the tune has completed with the {@link Channel} object which was passed in.
 * @throws the promise is rejected, returns a OipfError
 * @example
 *
 * onesdk.listenForTuneCompletion(chanId).then().catch(function(){
 *     //handle errors
 * });
 */
export function listenForTuneCompletion(chanId) {
    return new Promise(function(resolve, reject) {
        function onTuneError(errorNumber, message, additionalCode) {
            clearTimeout(tuneTimeout);
            clearChannelChangeListener();
            reject(new OipfError(errorNumber, message, additionalCode));
        }

        function onChannelChange(event) {
            console.log(event);
            //only listen for tune events for the correct channel
            if (event.channelId !== undefined && event.channelId.toString() === chanId) {
                clearTimeout(tuneTimeout);
                switch (event.eventInfo) {
                    case 'tunerLocked':
                        tuneTimeout = setTimeout(function() {
                            onTuneError(101, 'timed out after received tuner locked event, because no video playing event was received');
                        }, tuneTimeoutMillis);
                        break;
                    case 'tunerUnlocked':
                        onTuneError(102, 'received a tuner unlocked event');
                        break;
                    case 'videoPlaying':
                        clearChannelChangeListener();
                        resolve();
                        break;
                }
            }
        }

        let returnedChannel = null;

        clearTimeout(tuneTimeout);
        tuneTimeout = setTimeout(function() {
            onTuneError(103, `no tune events received for the channel ID ${chanId}`);
        }, tuneTimeoutMillis);

        if (chanChangeListener) {
            clearChannelChangeListener();
        }

        chanChangeListener = listenToChannelChange(onChannelChange);
    });
}

/**
 * To tune to a TV channel using a {@link Channel} object. If you already know the channel number or channel ID
 * you can call {@link tuneToChannelByNumber} or {@link tuneToChannelById} instead.
 * @param  {Object} channel - the {@link Channel} object
 * @returns {Promise} Promise resolves when the tune has been requested with the {@link Channel} object which was passed in.
 * @throws the promise is rejected, returns a OipfError
 * @example
 *
 * onesdk.getChannelById(chanId).then(onesdk.tuneToChannel).catch(function(){
 *     //handle errors
 * });
 */
export function tuneToChannel(channel) {
    if (!channel || !channel.hasOwnProperty('channelId')) {
        throw new OipfError(126, 'tried to tune to invalid channel');
    } else if (!channel.isEntitled) {
        throw new OipfError(127, 'tried to tune to unentitled channel');
    }

    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'setChannelByChannelId' with body { channelId: channel.channelId }
    // (module '/channels/'), validated the returned channel matched the request (calling
    // blankVideo() and throwing OipfError 128 on mismatch), and resolved with the channel.
}

/**
 * Used for getting events ({@link EpgEvent}) for a specified timeframe for a specified list of channels.
 * @param  {Number} startTime start of timeframe in seconds since epoc
 * @param  {Number} endTime end of timeframe in seconds since epoc
 * @param  {String[]} channelIdsArray an array of channel identifiers for the channels whose events are required
 * @returns {Promise} Promise resolves with an array of {@link EpgEvent}s.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getEpgEvents(1527773481, 1527777081, ['0161']).then(function(epgEventsArray) {
 *     console.log(epgEventsArray);
 * });
 */
export function getEpgEvents(startTime, endTime, channelIdsArray) {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // AS command 'getEPGEvents' with body
    //   { payload: { params: { startTime, endTime, channelIds: channelIdsArray } } }
    // (module 'epg/'), mapping each result to { channelId, events: events.map(e => new EpgEvent(e)) }.
}

/**
 * Will resize/scale the TV channel viewport based on full screen size being 1920x1080, regardless of user settings.
 * <p>You can use this to reduce the TV display for a picture in graphic
 * @param {Number} x       x coord of the viewport
 * @param {Number} y       y coord of the viewport
 * @param {Number} width   width of the viewport
 * @param {Number} height  height of the viewport
 * @returns {Promise} Promise returns a status result object (see example).
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.resizePlayer(0, 0, 1280, 720).then(function(statusResult) {
 *     console.log(statusResult);
 * });
 * //example status result object
 * {
 *     "setSessionProperty": {
 *         "propertyStatus": {
 *             "window": true
 *         }
 *     }
 * }
 */
export function resizePlayer(x, y, width, height) {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'resize' (module '/player/') with body { x, y, width, height }, each
    // floored after multiplying by playerScaleFactor.
}

/**
 * Mute the currently tuned TV channel audio
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function mute() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'doMute' with body { videoBlank: false, audioMute: true } (module '/player/').
}

/**
 * Unmute the currently tuned TV channel audio
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function unmute() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'doUnmute' with body { videoBlank: false, audioMute: true } (module '/player/').
}

/**
 * Hide and mute the currently tuned TV channel video/audio
 * @return {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function blankVideo() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'doMute' with body { videoBlank: true, audioMute: true } (module '/player/').
}

/**
 * Unhide and unmute the currently tuned TV channel video/audio
 * @return {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function unblankVideo() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'doUnmute' with body { videoBlank: true, audioMute: true } (module '/player/').
}

/**
 * Get the mute state of the currently tuned TV channel audio
 * @returns {Promise} Promise returns a boolean, true if audio is currently muted.
 * @throws the promise is rejected, returns a OipfError
 */
export function isMuted() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'getMuteState' (module '/player/') and resolved with
    // state.sessionProperty && state.sessionProperty.audioMute.
}

/**
 * Get the blanked state of the currently tuned TV channel video
 * @returns {Promise} Promise returns a boolean, true if video is currently blanked.
 * @throws the promise is rejected, returns a OipfError
 */
export function isVideoBlanked() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'getMuteState' (module '/player/') and resolved with
    // state.sessionProperty && state.sessionProperty.videoBlank.
}

/**
 * Suspend the currently tuned TV channel completely. Resume must be called to recover the channel.
 * If you want to play IP media streams or use web audio you must call this first.
 * <p> Note, this is safe to call if the TV channel is already suspended.
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function suspendBroadcast() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'suspend' (module '/player/'), treating a 'No source to suspend.' result
    // as success and otherwise throwing OipfError 130.
}

/**
 * Resume the currently tuned TV channel after it has been suspended
 * <p> Note, this is safe to call if the TV channel is already resumed.
 * @returns {Promise}
 * @throws the promise is rejected, returns a OipfError
 */
export function resumeBroadcast() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'resume' (module '/player/'), treating a 'No source to resume.' result
    // as success and otherwise throwing OipfError 131.
}

/**
 * Return a list of the audio components available for the currently tuned TV channel.
 * The properties returned are shown in the example.
 * <p> NOTE - componentTag and pid values are currently not provided.
 * @return {Promise} Promise returns an object, see below for an example.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getAudioComponents().then(function(audioComponents) {
 *     console.log(audioComponents);
 * });
 * //example result object
 *  [{
 *      desc: 'eng-ac3-2-76e',
 *      lng: 'eng',
 *      type: 'nrm',
 *      codec: 'ac3',
 *      tag: 2,
 *      pid: 1902
 * },
 * {
 *     desc: 'ger-ac3-3-76f',
 *     lng: 'ger',
 *     type: 'nrm',
 *     codec: 'ac3',
 *     tag: 3,
 *     pid: 1903
 * }];
 */
export function getAudioComponents() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'getAudioComponents' (module '/player/') and resolved with the array
    // result (or [] when not an array).
}

/**
 * Set the audio component for the currently tuned TV channel.
 * Depending on the parameters passed, effort is made to set audio track matching the criteria.
 * Any subset, or all, of the available parameters can be used to match an audio track.
 * The available parameters are listed in {@link getAudioComponents}.
 * However, if more than one track matching the criteria is found, the first audio track will be selected.
 * If no audio tracks matching the criteria are found, the first audio track in the PMT will be selected.
 * <p> NOTE - componentTag and pid values are currently not supported.
 * @param {Object} componentType A description of the desired audio stream. See the examples below.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * //example 1
 * onesdk.setAudioComponent({
 *    "pid": 0
 *})
 * //example 2
 * onesdk.setAudioComponent({
 *      desc: 'eng-ac3-2-76e',
 *      lng: 'eng',
 *      type: 'nrm',
 *      codec: 'ac3',
 *      tag: 2,
 *      pid: 1902
 *})
 */
export function setAudioComponent(componentType) {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'setAudioComponent' with body componentType (module '/player/').
}

/**
 * Returns a list of the subtitle components available for the currently tuned TV channel.
 * The properties returned are shown in the example.
 * <p> NOTE - componentTag and pid values are currently not provided.
 * @return {Promise} Promise returns an object, see below for an example.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getSubtitleComponents().then(function(subtitleComponents) {
 *     console.log(subtitleComponents);
 * });
 * //example result object
 *     [{
 *         desc: 'eng-nrm-default-ttxt-0-136',
 *         lng: 'eng',
 *         type: 'nrm',
 *         display_type: 'default',
 *         stream_type: 'ttxt',
 *         aux1: 0,
 *         aux2: 136,
 *         stream: 0,
 *         'iso-lang': 'en',
 *         componentTag: ,
 *         pid:
 *     }]
 */
export function getSubtitleComponents() {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'getSubtitleComponents' (module '/player/') and resolved with the array
    // result (or [] when not an array).
}

/**
 * Set the subtitle component for the currently tuned TV channel.
 * Depending on the parameters passed, effort is made to set subtitle track matching the criteria.
 * Any subset, or all, of the available parameters can be used to match a subtitle track. The available parameters are listed in {@link getSubtitleComponents}.
 * However, if more than one track matching the criteria is found, the first subtitle track will be selected.
 * If no subtitle tracks matching the criteria are found, subtitles will be disabled.
 * <p> NOTE - componentTag and pid values are currently not supported.
 * @param {Object} componentType A description of the desired subtitle. See the examples below.
 * @throws the promise is rejected, returns a OipfError
 * @example
 * // example 1
 * onesdk.setSubtitleComponent({
 *    "lng": "eng"
 * })
 * // example 2
 * onesdk.setSubtitleComponent({
 *    "desc": 'eng-nrm-default-ttxt-0-136',
 *    "lng": "eng",
 *    "type": "nrm",
 *    "display_type": "default",
 *    "stream_type": "dvbsub",
 *    "aux1": 0,
 *    "aux2": 0,
 *    "stream": 0,
 *    "iso-lang": 'en',
 *    "componentTag": 0,
 *    "pid": 0
 * })
 */
export function setSubtitleComponent(componentType) {
    // TODO(migration): re-implement via the new transport (util/websockets). Previously sent
    // MainUI command 'setSubtitleComponent' with body componentType (module '/player/').
}

/**
 * Set a listener for channel change events
 * The provided callback handler will be called with a tune event object, see the example below.
 * The eventInfo can have one of three values:
 * <br> - "tunerLocked" - the tuner has been locked and the tune is in progress
 * <br> - "tunerUnlocked" - the tuner has not been locked and the tune is not in progress
 * <br> - "videoPlaying" - the tune has completed and video is playing
 * @ignore
 * @param  {Function} callback  This function will be called whenever a channel change event occurs. It will have
 * a single object parameter as shown in the example.
 * @returns {Function} A reference to the function which was added. This value should be used when unregistering.
 * @example
 * Example object as passed to the callback function
 *  {
 *      channelId: 68,
 *      eventInfo: "videoPlaying"
 *  }
 */
export function listenToChannelChange(callback) {
    // TODO(migration): re-subscribe via the new transport (util/websockets).
    // Previously registered the callback for MainUI event 'channelChangeResponse'.
    return callback;
}

/**
 * Clear the channel change listener.
 * To correctly clear the channel change listener the same callback function must be passed
 * into this function
 * @ignore
 * @param  {Function} callback The callback function to unregister from the channel change event
 */
export function unregisterChannelChange(callback) {
    // NOTE: Code update required if unregisterEvent() in websockets module no longer called by this method. See comments in send() in websockets
    // TODO(migration): re-implement via the new transport (util/websockets).
    // Previously unregistered the callback from MainUI event 'channelChangeResponse'.
}
