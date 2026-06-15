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
 * Converts a list of Firebolt audio or subtitle components into an OIPF AVComponentCollection.
 *
 *
 * How To Use
 * ==========
 */

import { default as AVComponent } from 'oipf/AVComponent';

export default function AVComponentCollection(type, avComponents, audioComponents, subtitleComponents) {
    let components = [];

    if (avComponents) {
        components = components.concat(
            avComponents.map(function(avComponent) {
                return new AVComponent(type, avComponent);
            })
        );
    }

    if (audioComponents) {
        components = components.concat(audioComponents);
    }

    if (subtitleComponents) {
        components = components.concat(subtitleComponents);
    }

    /**
     * Get a single component based on its index in the component array
     * @param  {Number} i The index into the component array to find the component.
     * @return {Object}   The component object at the desired index.
     */
    components.item = function(i) {
        return components[i];
    };

    return components;
}
