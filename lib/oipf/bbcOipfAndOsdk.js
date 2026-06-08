/**
 * Description
 * ===========
 * This object collects all the APIs required by the BBC, which consists of the OIPF APIs and some One SDK APIs.
 *
 * The build process exposes all properties of this object as properties of the window object.
 *
 * How To Use
 * ==========
 *
 */

import { getDisplayInfo } from 'util/display.js';

import { init as applicationManagerInit, application } from 'oipf/applicationContext';
import { init as configurationInit, getConfiguration } from 'oipf/configurationContext';
import {
    init as videoBroadcastInit,
    getChannelConfig,
    getCurrentChannel,
    getPlayState,
    getComponents,
    bindToCurrentChannel,
    setChannel,
    selectComponent,
    stop as videoBroadcastStop
} from 'oipf/videoBroadcastService';
import { init as displayServiceInit, getPrimaryDisplay } from 'oipf/displayService';
import { init } from 'util/init';

//We always call onesdk init here because we do not expect the BBC to call it manually
init();
applicationManagerInit();
configurationInit();
videoBroadcastInit();
displayServiceInit();

export { default as oipfObjectFactory } from 'oipf/oipfObjectFactory';

export const onesdk = {
    getDisplayInfo,
    VERSION: __VERSION__ + (__DEVELOPMENT__ ? '_dev' : '')
};

const oipfApplicationManager = {
    getOwnerApplication: () => application
};

const oipfConfiguration = {
    configuration: getConfiguration()
};

const videoBroadcast = {
    getChannelConfig,
    bindToCurrentChannel,
    setChannel,
    getComponents,
    selectComponent,
    stop: videoBroadcastStop,
    get currentChannel() {
        return getCurrentChannel();
    },
    get playState() {
        return getPlayState();
    }
};

export const bbc = {
    oipfApplicationManager,
    oipfConfiguration,
    videoBroadcast
};

export { getPrimaryDisplay };
