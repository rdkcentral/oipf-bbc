/**
 * Description
 * ===========
 * Converts a Firebolt channel list into an oipf channel list to allow for cross compatibility.
 *
 *
 * How To Use
 * ==========
 * Pass the Firebolt channel list into the constructor.
 *
 * channelList = new ChannelList(fbChannels)
 *
 * Channels can be addressed via numerical index or by using one of the helper functions.
 *
 * e.g.
 * channel101 = channelList[101];
 *
 * OR
 *
 * channel101 = channelList.item(101);
 *
 * OR
 *
 * bbcOne = channeList.getChannelByName("bbcOne");
 *
 */

import Channel from 'oipf/Channel.js';

/**
 * The channel list class is an abstraction layer which allows a Firebolt channel list
 * to follow the same interface as an oipf channel list.
 * @param  {array} fbChannels  An array of Firebolt channel objects.
 * @return {array}               A decorated array which follows the same interface in accordance with the
 *                               OIPF specification.
 */
export default function ChannelList(fbChannels) {
    function searchChannels(propName, propValue) {
        return oipfChannels.find(function(channel) {
            return channel[propName] === propValue;
        });
    }

    let oipfChannels;

    //can't use a ternary here because the prettifier and the linter have a fight
    if (fbChannels) {
        oipfChannels = fbChannels.reduce(function(channels, fbChannel) {
            try {
                channels.push(new Channel(fbChannel));
            } catch (e) {
                console.error('Skipping invalid channel:', e.message);
            }
            return channels;
        }, []);
    } else {
        oipfChannels = [];
    }

    /**
     * Get a single channel based on its index in the channels array
     * @param  {Number} i The index into the channels array to find the channel.
     * @return {Object}   The channel object at the desired index.
     */
    oipfChannels.item = function(i) {
        return oipfChannels[i];
    };

    /*oipfChannels.getChannel = function(channelId){
		return searchChannels("ccid",ccid);
	};*/

    /**
     * Get a single channel based on its name
     * @param  {String} name The name of the channel.
     * @return {Object}      The channel whose name matches the provided string.
     *                       If no channel was found, undefined will be returned.
     */
    /*oipfChannels.getChannelByName = function(name) {
        return searchChannels('name', name);
    };*/

    /**
     * Get a single channel based on its Network Service ID
     * @param  {Number} name The Network Service ID of the channel.
     * @return {Object}      The channel whose name matches the provided network service ID.
     *                       If no channel was found, undefined will be returned.
     */
    /*oipfChannels.getChannellById = function(sid) {
        return searchChannels('sid', sid);
    };*/

    /*oipfChannels.getChannelBySourceID = function(){
		return searchChannels();
	};*/

    /*oipfChannels.getChannelByTriplet = function(){
		return searchChannels();
	};*/

    /*var fbChannel = {
		"channelId": "0062",
		"name": "NPO 1",
		"channelNumber": 2,
		"isRadio": false,
		"isAdult": false,
		"is3D": false,
		"resolution": "SD",
		"locator": "tune://pgmno=21001&frequency=236000000&modulation=16&symbol_rate=6900",
		"logoFocused": "https://staticqbr-nl-lab5a.lab.cdn.dmdsdp.com/image-service/ImagesEPG/Logos/Focused/npo1.png",
		"isEntitled": true,
		"allowStartOver": true,
		"allowReplayTV": true,
		"replayMode": "EXACT",
		"replayDuration": 604800,
		"replayEntitledDuration": 604800
	};*/

    return oipfChannels;
}
