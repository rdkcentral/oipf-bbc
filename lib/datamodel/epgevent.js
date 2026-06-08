/**
 * EpgEvent data model for a programme / event
 * @hideconstructor
 */
class EpgEvent {
    /**
     * Creates an instance of EpgEvent
     * @param {Object} [data={}] the data object from the middleware with which to instantiate the object
     */
    constructor(data = {}) {
        /**
         * Unique identifier for the event
         * @type {String}
         */
        this.eventId = data.eventId || '';
        /**
         * Identifier of the broadcast channel
         * @type {String}
         */
        this.channelId = data.channelId || '';
        /**
         * Title of the event
         * @type {String}
         */
        this.title = data.title || '';
        /**
         * Start time of the event, format milliseconds since epoch
         * @type {Number}
         */
        this.startTime = data.startTime || 0;
        /**
         * End time of the event, format milliseconds since epoch
         * @type {Number}
         */
        this.endTime = data.endTime || 0;
        /**
         * Minimum age restriction for programme
         * @type {Number}
         */
        this.minimumAge = data.minimumAge || 0;
        /**
         * Minimum age restriction for ReplayTV programme
         * @type {Number}
         */
        this.replayTVMinAge = data.replayTVMinAge || 0;
        /**
         * Unique identifier for the season level of the event, typically crid
         * @type {String}
         */
        this.seriesId = data.seriesId || '';
        /**
         * Number of the episode within the linked season
         * @type {Number}
         */
        this.episodeNumber = data.episodeNumber || 0;
        /**
         * Short synopsis of the event
         * @type {String}
         */
        this.shortDescription = data.shortDescription || '';
        /**
         * Long synopsis of the event
         * @type {String}
         */
        this.longDescription = data.longDescription || '';
        /**
         * Country of origin / production location of the event content
         * @type {String}
         */
        this.countryOfOrigin = data.countryOfOrigin || '';
        /**
         * Landscape image URL for programme
         * @type {String}
         */
        this.wall = data.wall || '';
        /**
         * Portrait image URL for programme
         * @type {String}
         */
        this.poster = data.poster || '';
        /**
         * Genre of the event, could list up to 2 entries, providing genre and subgenre
         * @type {String}
         */
        this.genres = data.genres || [];
    }
}

export default EpgEvent;
