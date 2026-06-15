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
 * Converts a Firebolt channel into an oipf channel object.
 *
 *
 * How To Use
 * ==========
 */

import { ID_DVB_C, ID_IPTV_URI } from 'oipf/constants/idTypes';
import { CHANNEL_TYPES_TV, CHANNEL_TYPES_RADIO, CHANNEL_TYPES_OTHER } from 'oipf/constants/channelTypes';
import { iterateNvpStr, splitOnFirst } from 'util/net';

class Channel {
    constructor(channel = {}) {
        let self = this;

        this.TYPE_TV = CHANNEL_TYPES_TV;
        this.TYPE_RADIO = CHANNEL_TYPES_RADIO;
        this.TYPE_OTHER = CHANNEL_TYPES_OTHER;

        if (!channel.locator) {
            throw new Error('Channel "' + channel.name + '" (' + channel.channelId + ') has no locator');
        }

        let locator = channel.locator;
        let locatorParams = ''; //the querystring parameters from the locator url

        if (locator.startsWith('http://') || locator.startsWith('https://') || locator.startsWith('dvb-mcast://')) {
            this.idType = ID_IPTV_URI;

            locatorParams = splitOnFirst(locator, '?')[1];
        } else {
            this.idType = ID_DVB_C;
            locatorParams = locator.replace('tune://', '');
        }

        iterateNvpStr(locatorParams, function(name, value) {
            if (name === 'pgmno') self.sid = value;
        });

        this.onid = 0;
        this.tsid = 0;
        this.nid = 0;
        this.dsd = '';
        this.channelType = channel.isRadio ? CHANNEL_TYPES_RADIO : CHANNEL_TYPES_TV;
        this.ccid = 'ccid:' + channel.channelId;
        this.majorChannel = channel.channelNumber;
        this.name = channel.name;
        this.isEntitled = channel.isEntitled;
        this.isAdult = channel.isAdult;
    }
}

export default Channel;
