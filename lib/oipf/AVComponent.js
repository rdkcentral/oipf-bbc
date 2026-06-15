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
 * Converts a Firebolt audio or subtitle component into an OIPF AVComponent.
 *
 *
 * How To Use
 * ==========
 */

import { COMPONENT_TYPE_AUDIO, COMPONENT_TYPE_SUBTITLE } from 'oipf/constants/componentTypes';

export const fbComponent = Symbol('fbComponent');

export default function AVComponent(type, component) {
    /*
     * //example audio data
     *  {
     *      desc: 'eng-ac3-2-76e',
     *      lng: 'eng',
     *      type: 'nrm',
     *      codec: 'ac3',
     *      tag: 2,
     *      pid: 1902 
     *  }
     *
     * //example subtitle data
     *  {
     *      desc: 'eng-nrm-default-ttxt-0-136',
     *      lng: 'eng',
     *      type: 'nrm',
     *      display_type: 'default',
     *      stream_type: 'ttxt',
     *      aux1: 0,
     *      aux2: 136,
     *      stream: 0,
     *      'iso-lang': 'en'
     *  }
     */

    let subtitleEncodingMap = {
        dvbsub: 'DVB-SUBT',
        ttxt: 'EBU-SUBT',
        cc708: 'CEA-SUBT'
    };

    let audioEncodingMap = {
        mp1: 'audio/mpeg',
        ac3: 'audio/ac3',
        ac3plus: 'audio/ac3',
        aac: 'audio/mp4',
        aacplus: 'audio/aacp',
        dts: 'audio/vnd.dts'
    };

    let avComponent = {
        componentTag: component.tag === undefined ? 0 : component.tag,
        pid: component.pid === undefined ? 0 : component.pid,
        type: type,
        encoding: type === COMPONENT_TYPE_AUDIO ? audioEncodingMap[component.codec] : subtitleEncodingMap[component.stream_type],
        language: component.lng
    };

    //we need to store the original fb component because passing it to the main UI is how we select components
    avComponent[fbComponent] = component;

    return avComponent;
}
