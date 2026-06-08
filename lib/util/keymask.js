/*
 * Key mapping is as follows:
 * RED = 0x1
 * GREEN = 0x2
 * YELLOW = 0x4
 * BLUE = 0x8
 * NAVIGATION (UP, DOWN, LEFT, RIGHT, ENTER, BACK) = 0x10
 * MEDIA (PLAY, PAUSE, STOP, FFWD, REWIND, PLAYPAUSE) = 0x20
 * SCROLL (PAGE_UP, PAGE_DOWN) = 0x40
 * INFO = 0x80
 * NUMERIC (numbers 0 to 9) = 0x100
 * ALPHA (all alphabets) = 0x200
 * SPACE = 0x400
 * BACKSPACE = 0x800
 * SEARCH = 0x1000
 * SUBTITLE = 0x2000
 * TELETEXT = 0x4000
 * HELP = 0x8000
 * CONTEXT = 0x10000
 * ALL = 0xFFFFFFFF
 */

/**
 * Get the current key mask as a base 10 number
 * @ignore
 *
 * @returns {Promise} Promise resolves with a mask value (see example).
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.getKeyMask().then(function(mask) {
 *     console.log(mask);
 * });
 * //example mask
 * 817
 */
export function getKeyMask() {
    // TODO(migration): re-implement via the new transport (util/websockets).
    // Previously sent MainUI websocket command 'getKeyMask' (module '/keyfilter/').
    // Temporary init shim: resolve with the all-keys mask (0xFFFFFFFF) so
    // applicationContext.init() keeps its default master key mask and app
    // initialisation does not break while migration is pending.
    return Promise.resolve(0xffffffff);
}

/**
 * Set the current key mask as a base 10 number
 * This mask cannot add keys which have not been made available by the Main UI
 * @ignore
 * @returns {Promise} Promise resolves with a result value (see example).
 * @throws the promise is rejected, returns a OipfError
 * @example
 * onesdk.setKeyMask(817).then(function(result) {
 *     console.log(result);
 * });
 * //example result
 * "Success"
 */
export function setKeyMask(mask) {
    // TODO(migration): re-implement via the new transport (util/websockets).
    // Previously sent MainUI websocket command 'setKeyMask' with body { mask } (module '/keyfilter/').
}
