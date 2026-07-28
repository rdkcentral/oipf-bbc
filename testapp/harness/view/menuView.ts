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
 * MenuView (View) — owns the menu column DOM (list, breadcrumb, caption, hints)
 * and the focus cursor for the level currently in view. The controller owns the
 * drill-down stack; this view owns which item is focused within the shown level.
 * Emits intent via opts.onActivate(childNode); opts.isLeaf decides the chevron.
 */
import { updateScrollHints } from 'harness/util';
import type { TreeNode } from 'harness/types';

export interface MenuView {
    render: (node: TreeNode, focusIdx: number, breadcrumb: string[], isGhosted: boolean) => void;
    focusDown: () => void;
    focusUp: () => void;
    focusedIndex: () => number;
    setGhosted: (isGhosted: boolean) => void;
    updateHints: () => void;
}

export interface MenuViewOpts {
    onActivate: (child: TreeNode) => void;
    isLeaf: (node: TreeNode) => boolean;
}

export function createMenuView(opts: MenuViewOpts): MenuView {
    const onActivate = opts.onActivate;
    const isLeaf = opts.isLeaf;

    const scrollEl = document.getElementById('menuScroll')!;
    const breadcrumbEl = document.getElementById('menuBreadcrumb');
    const captionEl = document.getElementById('menuCaption');

    let currentNode: TreeNode | null = null; // the branch whose children are listed
    let focusIndex = 0;
    let ghosted = false; // true while the results pane holds true focus

    function updateHints(): void {
        updateScrollHints('menuScroll', 'menuScrollUp', 'menuScrollDown');
    }

    function repaintFocus() {
        const focusedClass = 'menuItem focused' + (ghosted ? ' ghosted' : '');
        const items = scrollEl.querySelectorAll('.menuItem');
        for (let i = 0; i < items.length; i++) {
            items[i].className = i === focusIndex ? focusedClass : 'menuItem';
        }
        const focused = items[focusIndex] as HTMLElement | undefined;
        if (focused && focused.scrollIntoView) {
            focused.scrollIntoView({ block: 'nearest' });
        }
        updateHints();
    }

    // Renders a level's children. focusIdx seeds the cursor (restored on drill-out);
    // breadcrumb is the path labels; isGhosted dims focus when results are active.
    function render(node: TreeNode, focusIdx: number, breadcrumb: string[], isGhosted: boolean): void {
        currentNode = node;
        focusIndex = focusIdx || 0;
        ghosted = !!isGhosted;

        scrollEl.innerHTML = '';
        node.children.forEach(function (child, i) {
            const item = document.createElement('div');
            item.className = 'menuItem';

            const text = document.createElement('div');
            text.className = 'menuItemText';
            const label = document.createElement('span');
            label.className = 'menuLabel';
            label.textContent = child.label;
            text.appendChild(label);
            if (child.subtitle) {
                // Second line explaining the item (e.g. what an interface means).
                const subtitle = document.createElement('span');
                subtitle.className = 'menuSubtitle';
                subtitle.textContent = child.subtitle;
                text.appendChild(subtitle);
            }
            item.appendChild(text);

            if (!isLeaf(child)) {
                // Branch — show a drill-in affordance.
                const chevron = document.createElement('span');
                chevron.className = 'menuChevron';
                chevron.textContent = '›';
                item.appendChild(chevron);
            }

            item.addEventListener('click', function () {
                focusIndex = i;
                repaintFocus();
                onActivate(child);
            });
            scrollEl.appendChild(item);
        });

        if (breadcrumbEl) {
            breadcrumbEl.textContent = breadcrumb.join(' › ');
        }
        if (captionEl) {
            captionEl.textContent = node.caption || '';
            captionEl.style.display = node.caption ? 'block' : 'none';
        }
        repaintFocus();
    }

    function focusDown(): void {
        focusIndex = Math.min(focusIndex + 1, currentNode!.children.length - 1);
        repaintFocus();
    }

    function focusUp(): void {
        focusIndex = Math.max(focusIndex - 1, 0);
        repaintFocus();
    }

    function setGhosted(isGhosted: boolean): void {
        ghosted = !!isGhosted;
        repaintFocus();
    }

    return {
        render: render,
        focusDown: focusDown,
        focusUp: focusUp,
        focusedIndex: function () {
            return focusIndex;
        },
        setGhosted: setGhosted,
        updateHints: updateHints
    };
}
