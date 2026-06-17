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

/*
 * TreeModel (Model) — the test catalog: a generic menu tree built by register().
 * Branch nodes have `children`; leaf nodes carry a `group` (a runnable test
 * group). Nodes may carry a `subtitle` (second menu line) and a `caption` (help
 * text shown above this node's children). DOM-free — unit-testable headless.
 */
window.Harness = window.Harness || {};

window.Harness.createTree = function () {
    // Placeholder token used in a register() path to mean "expand across every
    // interface type". INTERFACE_TYPES is the canonical set and ordering; each
    // `description` explains the access path to a newcomer (shown as the interface
    // node's menu subtitle and as the caption once drilled into it).
    var INTERFACE = { interfacePlaceholder: true };
    var INTERFACE_TYPES = [
        { key: 'bbc', label: 'bbc', description: 'the window.bbc facade API' },
        { key: 'factory', label: 'Factory', description: 'objects from oipfObjectFactory.createXObject()' },
        { key: 'dom', label: 'DOM', description: '<object> elements resolved via getElementById' }
    ];

    var root = {
        label: 'Home',
        children: [],
        index: {},
        group: null,
        subtitle: null,
        caption: 'How are OIPF objects accessed? Choose an interface type, or a global category.'
    };

    // A node is a leaf (runnable test group) when it carries a group; anything
    // else is a branch to drill into. Keyed on `group`, not child count.
    function isLeaf(node) {
        return !!node.group;
    }

    function childNode(parent, label) {
        if (!parent.index[label]) {
            var node = { label: label, children: [], index: {}, group: null, id: null, subtitle: null, caption: null };
            parent.index[label] = node;
            parent.children.push(node);
        }
        return parent.index[label];
    }

    // Inserts a leaf at an explicit path, creating branch nodes as needed. Warns
    // on a path collision — where a leaf and a branch would share a node — since
    // that leaves one of them unreachable (the leaf wins; see isLeaf).
    function insertLeaf(pathArr, group) {
        var id = pathArr.join(' / ');
        pathArr.forEach(function (segment, i) {
            if (typeof segment !== 'string') {
                console.warn('Menu path "' + id + '" has a non-string segment at index ' + i +
                    ' — likely an unexpanded INTERFACE placeholder or a mis-authored path.');
            }
        });
        var node = root;
        for (var i = 0; i < pathArr.length; i++) {
            node = childNode(node, pathArr[i]);
            if (i < pathArr.length - 1 && node.group) {
                console.warn('Menu path collision: "' + id + '" nests under a ' +
                    'registered test group at "' + node.id + '" — the deeper path is unreachable.');
            }
        }
        if (node.group) {
            console.warn('Menu path collision: a test group is already registered at "' + id + '" — overwriting.');
        } else if (node.children.length) {
            console.warn('Menu path collision: "' + id + '" is also a submenu — its children become unreachable.');
        }
        node.group = group;
        node.id = id;
    }

    // Registers a test group at an explicit `path`. A path containing INTERFACE is
    // expanded once per interface type (wiring the matching accessor; a missing one
    // becomes an N/A leaf). A path without it is placed literally (e.g. onesdk).
    function register(spec) {
        var path = spec.path || [];
        var ifaceIdx = path.indexOf(INTERFACE);
        if (ifaceIdx === -1) {
            // A literal path whose first segment is an interface label almost
            // certainly meant to use INTERFACE: as written it merges into the
            // expanded interface branch as a leaf with no accessor wiring.
            var collides = INTERFACE_TYPES.some(function (type) {
                return type.label === path[0];
            });
            if (collides) {
                console.warn('register: literal path "' + path.join(' / ') + '" starts with the ' +
                    'interface label "' + path[0] + '" but has no INTERFACE placeholder — it will ' +
                    'merge into that interface branch with no accessor. Use harness.INTERFACE instead.');
            }
            insertLeaf(path, { cases: spec.cases });
            return;
        }
        INTERFACE_TYPES.forEach(function (type) {
            var concrete = path.slice();
            concrete[ifaceIdx] = type.label;
            var accessor = spec.accessors && spec.accessors[type.key];
            if (accessor) {
                insertLeaf(concrete, { setup: accessor, cases: spec.cases });
            } else {
                insertLeaf(concrete, { naMessage: 'Not available via ' + type.label });
            }
            // Describe the interface node (the placeholder segment) for newcomers:
            // subtitle in the parent list, caption once drilled in. (ifaceIdx 0 =
            // top level, the supported case; deeper placeholders just stay plain.)
            if (ifaceIdx === 0) {
                var ifaceNode = root.index[type.label];
                ifaceNode.subtitle = type.description;
                ifaceNode.caption = 'Tests using ' + type.description + '.';
            }
        });
    }

    return {
        root: root,
        isLeaf: isLeaf,
        register: register,
        INTERFACE: INTERFACE
    };
};
