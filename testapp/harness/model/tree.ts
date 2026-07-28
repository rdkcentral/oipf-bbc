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
import type { InterfacePlaceholder, PathSegment, RegisterSpec, TreeNode } from 'harness/types';

export interface Tree {
    root: TreeNode;
    isLeaf: (node: TreeNode) => boolean;
    // any (not unknown) is deliberate: this is the erasure boundary where each
    // caller's own concrete RegisterSpec<Ctx> (Configuration, VideoBroadcast,
    // ...) gets boxed into the tree's generic storage (RunnableGroup, which
    // uses unknown downstream). Function parameters are contravariant, so
    // RegisterSpec<Configuration> isn't assignable to a RegisterSpec<unknown>
    // parameter — any is what actually absorbs arbitrary concrete Ctx here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: (spec: RegisterSpec<any>) => void;
    buildRunAllMenu: () => void;
    INTERFACE: InterfacePlaceholder;
}

interface InterfaceType {
    key: 'bbc' | 'factory' | 'dom';
    label: string;
    description: string;
}

export function createTree(): Tree {
    // Placeholder token used in a register() path to mean "expand across every
    // interface type". INTERFACE_TYPES is the canonical set and ordering; each
    // `description` explains the access path to a newcomer (shown as the interface
    // node's menu subtitle and as the caption once drilled into it).
    const INTERFACE: InterfacePlaceholder = { interfacePlaceholder: true };
    const INTERFACE_TYPES: InterfaceType[] = [
        { key: 'bbc', label: 'bbc', description: 'the window.bbc facade API' },
        { key: 'factory', label: 'Factory', description: 'objects from oipfObjectFactory.createXObject()' },
        { key: 'dom', label: 'DOM', description: '<object> elements resolved via getElementById' }
    ];

    const root: TreeNode = {
        label: 'Home',
        children: [],
        index: {},
        group: null,
        id: null,
        subtitle: null,
        caption: 'How are OIPF objects accessed? Choose an interface type, or a global category.'
    };

    // A node is a leaf (runnable test group) when it carries a group; anything
    // else is a branch to drill into. Keyed on `group`, not child count.
    function isLeaf(node: TreeNode): boolean {
        return !!node.group;
    }

    function childNode(parent: TreeNode, label: string): TreeNode {
        if (!parent.index[label]) {
            const node: TreeNode = { label: label, children: [], index: {}, group: null, id: null, subtitle: null, caption: null };
            parent.index[label] = node;
            parent.children.push(node);
        }
        return parent.index[label];
    }

    // Inserts a leaf at an explicit path, creating branch nodes as needed. Warns
    // on a path collision — where a leaf and a branch would share a node — since
    // that leaves one of them unreachable (the leaf wins; see isLeaf).
    function insertLeaf(pathArr: PathSegment[], group: TreeNode['group']) {
        const id = pathArr.join(' / ');
        pathArr.forEach(function (segment, i) {
            if (typeof segment !== 'string') {
                console.warn('Menu path "' + id + '" has a non-string segment at index ' + i +
                    ' — likely an unexpanded INTERFACE placeholder or a mis-authored path.');
            }
        });
        let node = root;
        for (let i = 0; i < pathArr.length; i++) {
            node = childNode(node, pathArr[i] as string);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function register(spec: RegisterSpec<any>): void {
        const path = spec.path || [];
        const ifaceIdx = path.indexOf(INTERFACE);
        if (ifaceIdx === -1) {
            // A literal path whose first segment is an interface label almost
            // certainly meant to use INTERFACE: as written it merges into the
            // expanded interface branch as a leaf with no accessor wiring.
            const collides = INTERFACE_TYPES.some(function (type) {
                return type.label === path[0];
            });
            if (collides) {
                console.warn('register: literal path "' + path.join(' / ') + '" starts with the ' +
                    'interface label "' + path[0] + '" but has no INTERFACE placeholder — it will ' +
                    'merge into that interface branch with no accessor. Use harness.INTERFACE instead.');
            }
            insertLeaf(path as string[], { cases: spec.cases });
            return;
        }
        INTERFACE_TYPES.forEach(function (type) {
            const concrete = path.slice();
            concrete[ifaceIdx] = type.label;
            const accessor = spec.accessors && spec.accessors[type.key];
            if (accessor) {
                insertLeaf(concrete, { setup: accessor, cases: spec.cases });
            } else {
                insertLeaf(concrete, { naMessage: 'Not available via ' + type.label });
            }
            // Describe the interface node (the placeholder segment) for newcomers:
            // subtitle in the parent list, caption once drilled in. (ifaceIdx 0 =
            // top level, the supported case; deeper placeholders just stay plain.)
            if (ifaceIdx === 0) {
                const ifaceNode = root.index[type.label];
                ifaceNode.subtitle = type.description;
                ifaceNode.caption = 'Tests using ' + type.description + '.';
            }
        });
    }

    // Adds a top-level "» Run all tests" branch (placed first) whose children are
    // one autorun leaf per existing top-level category. Each leaf's group carries
    // { autorun: categoryNode } — the controller runs that subtree instead of
    // opening it. Call once after all test files have registered (e.g. in init).
    const RUN_ALL_LABEL = '» Run all tests';
    function buildRunAllMenu(): void {
        if (root.index[RUN_ALL_LABEL]) {
            return;
        }
        const categories = root.children.slice(); // snapshot before adding the branch
        if (!categories.length) {
            return;
        }
        const branch = childNode(root, RUN_ALL_LABEL);
        branch.caption = 'Choose a test area to run automatically; results appear in a popup.';
        categories.forEach(function (category) {
            const leaf = childNode(branch, category.label);
            leaf.group = { autorun: category };
            leaf.id = RUN_ALL_LABEL + ' / ' + category.label;
            leaf.subtitle = 'Every non-manual test under ' + category.label;
        });
        // Move the branch to the front of the root list for prominence.
        root.children.splice(root.children.indexOf(branch), 1);
        root.children.unshift(branch);
    }

    return {
        root: root,
        isLeaf: isLeaf,
        register: register,
        buildRunAllMenu: buildRunAllMenu,
        INTERFACE: INTERFACE
    };
}
