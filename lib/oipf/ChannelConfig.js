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
 * Converts a Firebolt channel list into an oipf channel config object to allow for cross compatibility.
 *
 *
 * How To Use
 * ==========
 * Pass the Firebolt channel list into the constructor.
 *
 * channelConfig = new ChannelConfig(fbChannels)
 *
 * The channel list can be addressed via the property, i.e;
 *
 * channelList = channelConfig.channelList;
 */

import { default as ChannelList } from 'oipf/ChannelList.js';

function ChannelConfig(fbChannels) {
    let channelList = new ChannelList(fbChannels);

    return {
        channelList: channelList
    };
}

export default ChannelConfig;
