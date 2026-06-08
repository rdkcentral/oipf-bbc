/**
 * Data model for Channel
 * This is the channel object as used in the FB SDK. The channel object used in the OIPF is different and detailed in OIPF directory in OIPF/channel.js.
 * @hideconstructor
 */
class Channel {
    /**
     * Creates an instance of Channel
     * @param {Object} [data={}] the data from the middleware object with which to instantiate the object
     */
    constructor(data = {}) {
        /**
         * Identifier of the channel. For the UK this is the VM SID.
         * @type {String}
         */
        this.channelId = data.channelId || '';
        /**
         * Name of the channel
         * @type {String}
         */
        this.name = data.name || '';
        /**
         * Logical channel number as shown in the EPG
         * @type {Number}
         */
        this.channelNumber = data.channelNumber || 0;
        /**
         * True if channel is a radio channel
         * @type {Boolean}
         */
        this.isRadio = data.isRadio || false;
        /**
         * True if channel is an adult channel
         * @type {Boolean}
         */
        this.isAdult = data.isAdult || false;
        /**
         * True if channel is in 3D
         * @type {Boolean}
         */
        this.is3D = data.is3D || false;
        /**
         * Default video content resolution for the channel [SD, HD, 4K, 5K, 8K]
         * @type {String}
         */
        this.resolution = data.resolution || '';
        /**
         * Locator id of a channel
         * @type {String}
         */
        this.locator = data.locator || '';
        /**
         * The URL of the channel logo in the EPG focused state
         * @type {String}
         */
        this.logoFocused = data.logoFocused || '';
        /**
         * True if user has entitlement for the channel
         * @type {Boolean}
         */
        this.isEntitled = data.isEntitled || false;
        /**
         * If true StartOver functionality is allowed for each event on this channel having the hasReplayTV property enabled
         * @type {Boolean}
         */
        this.allowStartOver = data.allowStartOver || false;
        /**
         * If true ReplayTV functionality is allowed for each event on this channel having the hasReplayTV property enabled
         * @type {Boolean}
         */
        this.allowReplayTV = data.allowReplayTV || false;
        /**
         * Mode for ReplayTV enabled events on this channel [EXACT, VOSDAL]
         * @type {String}
         */
        this.replayMode = data.replayMode || '';
        /**
         * Number of seconds that ReplayTV is available after the endTime of the events
         * @type {Number}
         */
        this.replayDuration = data.replayDuration || 0;
        /**
         * Number of seconds the user is entitled to ReplayTV after the endTime of the events, returned if allowReplayTV is enabled
         * @type {Number}
         */
        this.replayEntitledDuration = data.replayEntitledDuration || 0;
        /**
         * Is this channel visible in the main STB UI, e.g. is it in the epg or search?
         * @type {Boolean}
         */
        this.isHidden = data.isHidden || false;
    }
}

export default Channel;
