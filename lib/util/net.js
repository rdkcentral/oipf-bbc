/**
 * Takes a string and splits it into the 2 strings that are seperated by the first occurence of a given seperator character
 * @ignore
 * @param	{String} str The string to be split
 * @param	{String} sep The seperator character
 * @return {Array} An array of the 2 parts. If the seperator does not exist returns an array of one value that is the whole original string.
 */
export function splitOnFirst(str, sep) {
    var posStartSep = str.indexOf(sep);
    if (posStartSep !== -1) {
        return [str.slice(0, posStartSep), str.slice(posStartSep + sep.length)];
    } else {
        return [str];
    }
}

/**
 * Itereates over the nvp in a string and calls a process function for each nvp.
 * @ignore
 * @param {String} nvpStr. A string containing name value pairs separated by pairSeparator and with name and value separated by nameValSeparator
 * @param {Function} processFunc A function called for each name value pair. Has signature (name:String, value:String) and sh
 * @param {Boolean} lowercase. If true all the names are lowercased.
 * @param {Boolean} dontDecode. If false the name and the value will be percent decoded.
 * @param {String} pairSeparator. the character used to seperate one nvp from the next nvp, defaults to &
 * @param {String} nameValSeparator. the character used to seperate a name from a value. defaults to =
 */
export function iterateNvpStr(nvpStr, processFunc, lowercase, dontDecode, pairSeparator, nameValSeparator) {
    var props;
    var name;
    var nvp;

    if (!nvpStr) {
        nvpStr = '';
    }

    if (pairSeparator === null || pairSeparator === undefined) {
        pairSeparator = '&';
    }

    if (nameValSeparator === null || nameValSeparator === undefined) {
        nameValSeparator = '=';
    }

    props = nvpStr.split(pairSeparator);

    for (var i = 0; i < props.length; i++) {
        //nvp = props[i].split(nameValSeparator);
        nvp = splitOnFirst(props[i], nameValSeparator); // = are allowed unescaped in a value
        name = nvp[0];
        if (name) {
            name = dontDecode ? name : decodeURIComponent(name);
            if (lowercase && name) {
                name = name.toLowerCase();
            }
            if (name) {
                processFunc(name, dontDecode ? nvp[1] : decodeURIComponent(nvp[1]));
            }
        }
    }
}
