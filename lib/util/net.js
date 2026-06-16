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
 * Takes a string and splits it into the 2 strings that are separated by the first occurrence of a given separator string
 * @ignore
 * @param	{String} str The string to be split
 * @param	{String} sep The separator string
 * @return {Array} An array of the 2 parts. If the separator does not exist returns an array of one value that is the whole original string.
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
 * Iterates over the nvps in a string and calls a process function for each nvp.
 * @ignore
 * @param {String} nvpStr. A string containing name/value pairs separated by pairSeparator and with name and value separated by nameValSeparator
 * @param {Function} processFunc A function called for each name/value pair. Signature: (name:String, value:String).
 * @param {Boolean} lowercase. If true all the names are lowercased.
 * @param {Boolean} dontDecode. If false the name and the value will be percent decoded.
 * @param {String} pairSeparator. the character used to separate one nvp from the next nvp, defaults to &
 * @param {String} nameValSeparator. the character used to separate a name from a value. defaults to =
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
