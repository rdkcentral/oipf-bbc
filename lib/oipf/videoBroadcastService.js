/**
 * Description
 * ===========
 * Singleton service that owns the broadcast TV state and operations.
 *
 * The VideoBroadcast DOM element is an optional view onto this service: when
 * attached, events are dispatched on it and `on*` handlers fire; when no view
 * is attached, the same operations work headlessly. There is one logical
 * broadcast (one TV tuner) so only a single view may be attached at a time.
 */

import {
    getChannels,
    getCurrentChannelId,
    getChannelById,
    listenForTuneCompletion,
    tuneToChannelByNumber,
    getAudioComponents,
    setAudioComponent,
    getSubtitleComponents,
    setSubtitleComponent,
    listenToChannelChange,
    resizePlayer,
    resumeBroadcast
} from 'util/broadcast';

import OipfError from 'datamodel/oipfError';
import ChannelConfig from 'oipf/ChannelConfig';
import AVComponentCollection from 'oipf/AVComponentCollection';
import { fbComponent } from 'oipf/AVComponent';

import { ID_DVB_C, ID_IPTV_URI } from 'oipf/constants/idTypes';
import { COMPONENT_TYPE_AUDIO, COMPONENT_TYPE_SUBTITLE } from 'oipf/constants/componentTypes';
import { PLAYSTATE_UNREALIZED, PLAYSTATE_CONNECTING, PLAYSTATE_PRESENTING, PLAYSTATE_STOPPED } from 'oipf/constants/playstates';

/*
 * OipfError codes used in this file
 * =================================
 *  701  attachView   — a broadcast view is already attached (only one is supported)
 */

// ---- State ----------------------------------------------------------------

let channelConfig = new ChannelConfig();
let currentChannel = null;
let playState = PLAYSTATE_UNREALIZED;
let audioComponents = null;
let subtitleComponents = null;
let allComponents = null;
let chanTablePromise = null;
let attachedView = null;

const oipfErrorCode = {
    101: 4, //no video playing event
    102: 1, //tune unlocked event
    103: 4, //no tune locked event
    104: 100, //no channel object returned by Main UI
    105: 100 //request to Main UI failed
};

// ---- Lifecycle ------------------------------------------------------------

export function init() {
    if (chanTablePromise) return chanTablePromise;

    listenToChannelChange(onChannelError);

    chanTablePromise = getChannels().then(function(fbChannels) {
        channelConfig = new ChannelConfig(fbChannels);
    });

    return chanTablePromise;
}

// ---- View registration ----------------------------------------------------

/**
 * Attach the single DOM view. Events fire on this element.
 * Throws if a view is already attached — only one broadcast view is supported.
 */
export function attachView(el) {
    if (attachedView) {
        throw new OipfError(701, 'VideoBroadcast view already attached; only one is supported');
    }
    attachedView = el;
}

export function detachView(el) {
    if (attachedView === el) attachedView = null;
}

// ---- State accessors ------------------------------------------------------

export function getChannelConfig() {
    return channelConfig;
}

export function getCurrentChannel() {
    return currentChannel;
}

export function getPlayState() {
    return playState;
}

export function getComponents(componentType) {
    switch (componentType) {
        case COMPONENT_TYPE_AUDIO:
            return audioComponents;
        case COMPONENT_TYPE_SUBTITLE:
            return subtitleComponents;
        case null:
        case undefined:
            return allComponents;
        default:
    }
}

// ---- Public operations ----------------------------------------------------

/**
 * Look up the channel the host is currently tuned to, by CCID.
 * Pure lookup — does not mutate service state. Returns null if not in the table.
 */
export function resolveCurrentChannel() {
    return getCurrentChannelId().then(function(currentChannelId) {
        let currentCcid = 'ccid:' + currentChannelId;
        return (
            channelConfig.channelList.find(function(channel) {
                return channel.ccid === currentCcid;
            }) || null
        );
    });
}

/**
 * Bind to whatever channel the host is currently tuned to.
 * If stopped, performs a full tune; if unrealized, just transitions to PRESENTING.
 */
export function bindToCurrentChannel() {
    chanTablePromise.then(function() {
        resolveCurrentChannel()
            .then(function(channel) {
                if (!channel) {
                    //host's current channel is not in our channel list
                    dispatchError(null, 5);
                    return;
                }
                if (playState === PLAYSTATE_STOPPED) {
                    setChannel(channel);
                } else if (playState === PLAYSTATE_UNREALIZED) {
                    fetchComponents()
                        .then(function() {
                            currentChannel = channel;
                            setPlayState(PLAYSTATE_PRESENTING);
                        })
                        .catch(function() {
                            dispatchError(null, 100);
                        });
                }
            })
            .catch(function() {
                dispatchError(null, 100);
            });
    });
}

/**
 * Tune to a particular channel, or release control if channel is null.
 */
export function setChannel(channel) {
    console.debug('setChannel', channel);

    if (channel === null) {
        currentChannel = null;
        //Release control of the tuner: restore the player to fullscreen and unblank.
        resizePlayer(0, 0, window.innerWidth, window.innerHeight);
        resumeBroadcast();
        setPlayState(PLAYSTATE_UNREALIZED);
        return;
    }

    let foundChannel = channelConfig.channelList.find(function(c) {
        if (c.ccid === channel.ccid || c.name === channel.name) return channel;
    });

    if (!foundChannel) {
        dispatchError(channel, 5);
        return;
    }

    if (channel.idType !== ID_DVB_C && channel.idType !== ID_IPTV_URI) {
        dispatchError(channel, 0); //channel id type not supported
        return;
    }

    let chanId = String(channel.ccid).replace('ccid:', '');

    setPlayState(PLAYSTATE_CONNECTING);

    let tuneFailed = false;

    listenForTuneCompletion(chanId)
        .then(function() {
            if (tuneFailed) return;

            fetchComponents()
                .then(getCurrentChannelId)
                .then(getChannelById)
                .then(function(newChannel) {
                    currentChannel = newChannel;
                    setPlayState(PLAYSTATE_PRESENTING);
                    dispatchSuccess(channel);
                })
                .catch(function() {
                    dispatchError(channel, 100);
                });
        })
        .catch(function(error) {
            if (tuneFailed) return;
            if (error instanceof OipfError) {
                dispatchError(channel, oipfErrorCode[error.type]);
            } else {
                dispatchError(channel, 100);
            }
        });

    tuneToChannelByNumber(channel.majorChannel).catch(function() {
        tuneFailed = true;
        dispatchError(channel, 100);
    });
}

export function selectComponent(component) {
    switch (component.type) {
        case COMPONENT_TYPE_AUDIO:
            setAudioComponent(component[fbComponent]);
            break;
        case COMPONENT_TYPE_SUBTITLE:
            setSubtitleComponent(component[fbComponent]);
            break;
        default:
    }
}

/**
 * Stop the broadcast. Transitions to STOPPED unless already UNREALIZED.
 */
export function stop() {
    if (playState !== PLAYSTATE_UNREALIZED) {
        setPlayState(PLAYSTATE_STOPPED);
    }
}

// ---- Internal -------------------------------------------------------------

function fetchComponents() {
    return Promise.all([getAudioComponents(), getSubtitleComponents()]).then(function([fbAudio, fbSubtitle]) {
        audioComponents = new AVComponentCollection(COMPONENT_TYPE_AUDIO, fbAudio);
        subtitleComponents = new AVComponentCollection(COMPONENT_TYPE_SUBTITLE, fbSubtitle);
        allComponents = new AVComponentCollection(null, null, audioComponents, subtitleComponents);
    });
}

function setPlayState(nextState, errorState) {
    playState = nextState;
    dispatchPlayStateChange(playState, errorState);
}

function onChannelError(event) {
    //only care if the playstate is presenting; a tunerUnlocked while connecting
    //will be caught by the tuneToChannel flow.
    if (playState === PLAYSTATE_PRESENTING && event.eventInfo === 'tunerUnlocked') {
        let previous = currentChannel;
        currentChannel = null;
        setPlayState(PLAYSTATE_UNREALIZED);
        dispatchError(previous, 1);
    }
}

// ---- Event dispatch (no-op when no view attached) -------------------------

function dispatchPlayStateChange(state, errorState) {
    if (!attachedView) return;

    let event = new CustomEvent('PlayStateChange');
    event.state = state;
    event.error = errorState;

    attachedView.dispatchEvent(event);
    if (attachedView.onPlayStateChange) attachedView.onPlayStateChange(state, errorState);
}

function dispatchError(channel, errorState) {
    if (!attachedView) return;

    let event = new CustomEvent('ChannelChangeError');
    event.errorState = errorState;
    event.channel = channel;

    attachedView.dispatchEvent(event);

    if (attachedView.onChannelChangeError) {
        let view = attachedView;
        setTimeout(function() {
            //break the execution flow to prevent an error triggering the VideoBroadcast's catches.
            view.onChannelChangeError(channel, errorState);
        }, 0);
    }
}

function dispatchSuccess(channel) {
    if (!attachedView) return;

    let event = new CustomEvent('ChannelChangeSucceeded');
    event.channel = channel;

    attachedView.dispatchEvent(event);

    if (attachedView.onChannelChangeSucceeded) {
        let view = attachedView;
        setTimeout(function() {
            //break the execution flow to prevent an error triggering the VideoBroadcast's catches.
            view.onChannelChangeSucceeded(channel);
        }, 0);
    }
}
