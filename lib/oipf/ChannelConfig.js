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
