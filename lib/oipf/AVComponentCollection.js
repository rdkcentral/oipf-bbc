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
