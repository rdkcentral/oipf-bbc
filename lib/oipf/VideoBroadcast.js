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

/**
 * Description
 * ===========
 * The video broadcast object can be used to request data about the broadcast channel lineup
 * including information about the current channel.
 *
 *
 * How To Use
 * ==========
 *
 * EITHER:
 *      Add the following HTML to your document; <object id="broadcastVideo" type="video/broadcast"></object>
 *      Use document.getElementById to access this object. Any other dom lookup methods are not supported.
 * OR:
 *      Call the method oipfObjectFactory.createVideoBroadcastObject() to gain an instance of the VideoBroadcast object.
 *      Insert the object into your document.
 *
 * The videoBroadcast object is a fully funcational HMTL Node so it can be manipulated in most of the same ways.
 * However, altering the possition or size of the videoBroadcast object through CSS is not supported.
 *
 * The bulk of the broadcast logic — channel state, tuning, components — lives in
 * `videoBroadcastService`. This constructor is the DOM-attached view onto that
 * service: it owns geometry / visibility, attaches itself for event dispatch,
 * and exposes the OIPF property and method surface.
 */

import { resizePlayer, suspendBroadcast, resumeBroadcast } from 'util/broadcast';

import {
    init as videoBroadcastServiceInit,
    attachView,
    getChannelConfig,
    getCurrentChannel,
    getPlayState,
    getComponents,
    bindToCurrentChannel,
    setChannel,
    selectComponent,
    stop
} from 'oipf/videoBroadcastService';

import { COMPONENT_TYPE_VIDEO, COMPONENT_TYPE_AUDIO, COMPONENT_TYPE_SUBTITLE } from 'oipf/constants/componentTypes';
import { PLAYSTATE_UNREALIZED } from 'oipf/constants/playstates';

import 'oipf/oipf.scss';

const viewHeight = window.innerHeight;
const viewWidth = window.innerWidth;

/**
 * @constructor
 * @param {video/broadcast}[videoBroadcast] If a videobroadcast tag has already been created in the Dom, this is that element.
 */
export default function VideoBroadcast(videoBroadcast) {
    let height;
    let width;
    let top;
    let left;

    let visibility;
    let display;

    if (!videoBroadcast) {
        videoBroadcast = document.createElement('object');
        videoBroadcast.type = 'video/broadcast';
    }

    videoBroadcast.fullScreen = false;

    videoBroadcastServiceInit();
    attachView(videoBroadcast);

    /**
     * @ignore
     * Update the stored values for the Video Broadcast's position
     * And if the Video Broadcast object is not set to fullscreen, resize the TV Player.
     */
    function updateBroadcastPosition(_left, _top, _width, _height) {
        left = _left;
        top = _top;
        width = _width;
        height = _height;
        if (!videoBroadcast.fullScreen) {
            resizePlayer(left, top, width, height);
        }
    }

    /**
     * @ignore
     * Hide and mute the broadcast if visibility/display is hidden/none; otherwise show and unmute.
     */
    function updateBroadcastVisibility() {
        visibility = videoBroadcast.style.visibility;
        display = videoBroadcast.style.display;

        if (visibility === 'hidden' || display === 'none') {
            suspendBroadcast();
        } else {
            resumeBroadcast();
        }
    }

    let mutationObserver = new MutationObserver(function(eventList) {
        eventList.forEach(function(event) {
            if (event.attributeName === 'style' && getPlayState() !== PLAYSTATE_UNREALIZED) {
                let vboRect = videoBroadcast.getBoundingClientRect();

                if (
                    //only allow the video broadcast to be moved if its possition has changed
                    vboRect.height !== height ||
                    vboRect.width !== width ||
                    vboRect.top !== top ||
                    vboRect.left !== left
                ) {
                    updateBroadcastPosition(vboRect.left, vboRect.top, vboRect.width, vboRect.height);
                }

                if (videoBroadcast.style.visibility !== visibility || videoBroadcast.style.display !== display) {
                    //only show/hide the video broadcast object if its visibility has changed
                    updateBroadcastVisibility();
                }
            }
        });
    });

    mutationObserver.observe(videoBroadcast, { attributes: true });

    //While UNREALIZED the player's geometry is reset by setChannel(null) and the
    //MutationObserver is suppressed, so any cached values are stale. Clear them on
    //entry to UNREALIZED, then re-sync on the next wake.
    videoBroadcast.addEventListener('PlayStateChange', function(ev) {
        if (ev.state === PLAYSTATE_UNREALIZED) {
            left = top = width = height = visibility = display = undefined;
            return;
        }
        if (left !== undefined) return; //cache still valid

        let vboRect = videoBroadcast.getBoundingClientRect();
        updateBroadcastPosition(vboRect.left, vboRect.top, vboRect.width, vboRect.height);
        updateBroadcastVisibility();
    });

    function setHeight(h) {
        videoBroadcast.style.height = h + 'px';
    }

    function getHeight() {
        if (videoBroadcast.fullScreen) return viewHeight;
        return videoBroadcast.getBoundingClientRect().height;
    }

    function setWidth(w) {
        videoBroadcast.style.width = w + 'px';
    }

    function getWidth() {
        if (videoBroadcast.fullScreen) return viewWidth;
        return videoBroadcast.getBoundingClientRect().width;
    }

    /**
     * @public
     * Toggle the fullscreen state of the video broadcast.
     */
    function setFullScreen(fullScreen) {
        if (fullScreen) {
            resizePlayer(0, 0, viewWidth, viewHeight);
            videoBroadcast.fullScreen = true;
        } else {
            resizePlayer(left, top, width, height);
            videoBroadcast.fullScreen = false;
        }
    }

    Object.defineProperty(videoBroadcast, 'playState', { get: getPlayState });
    Object.defineProperty(videoBroadcast, 'currentChannel', { get: getCurrentChannel });
    Object.defineProperty(videoBroadcast, 'height', { get: getHeight, set: setHeight });
    Object.defineProperty(videoBroadcast, 'width', { get: getWidth, set: setWidth });

    Object.assign(videoBroadcast, {
        instantiated: true,
        getChannelConfig,
        bindToCurrentChannel,
        setChannel,
        setFullScreen,
        stop,
        getComponents,
        selectComponent,
        COMPONENT_TYPE_VIDEO,
        COMPONENT_TYPE_AUDIO,
        COMPONENT_TYPE_SUBTITLE
    });

    return videoBroadcast;
}
