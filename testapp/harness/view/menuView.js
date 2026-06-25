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
window.Harness = window.Harness || {};

window.Harness.createMenuView = function (opts) {
    var onActivate = opts.onActivate;
    var isLeaf = opts.isLeaf;

    var scrollEl = document.getElementById('menuScroll');
    var breadcrumbEl = document.getElementById('menuBreadcrumb');
    var captionEl = document.getElementById('menuCaption');

    var currentNode = null; // the branch whose children are listed
    var focusIndex = 0;
    var ghosted = false; // true while the results pane holds true focus

    function updateHints() {
        window.Harness.updateScrollHints('menuScroll', 'menuScrollUp', 'menuScrollDown');
    }

    function repaintFocus() {
        var focusedClass = 'menuItem focused' + (ghosted ? ' ghosted' : '');
        var items = scrollEl.querySelectorAll('.menuItem');
        for (var i = 0; i < items.length; i++) {
            items[i].className = i === focusIndex ? focusedClass : 'menuItem';
        }
        var focused = items[focusIndex];
        if (focused && focused.scrollIntoView) {
            focused.scrollIntoView({ block: 'nearest' });
        }
        updateHints();
    }

    // Renders a level's children. focusIdx seeds the cursor (restored on drill-out);
    // breadcrumb is the path labels; isGhosted dims focus when results are active.
    function render(node, focusIdx, breadcrumb, isGhosted) {
        currentNode = node;
        focusIndex = focusIdx || 0;
        ghosted = !!isGhosted;

        scrollEl.innerHTML = '';
        node.children.forEach(function (child, i) {
            var item = document.createElement('div');
            item.className = 'menuItem';

            var text = document.createElement('div');
            text.className = 'menuItemText';
            var label = document.createElement('span');
            label.className = 'menuLabel';
            label.textContent = child.label;
            text.appendChild(label);
            if (child.subtitle) {
                // Second line explaining the item (e.g. what an interface means).
                var subtitle = document.createElement('span');
                subtitle.className = 'menuSubtitle';
                subtitle.textContent = child.subtitle;
                text.appendChild(subtitle);
            }
            item.appendChild(text);

            if (!isLeaf(child)) {
                // Branch — show a drill-in affordance.
                var chevron = document.createElement('span');
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

    function focusDown() {
        focusIndex = Math.min(focusIndex + 1, currentNode.children.length - 1);
        repaintFocus();
    }

    function focusUp() {
        focusIndex = Math.max(focusIndex - 1, 0);
        repaintFocus();
    }

    function setGhosted(isGhosted) {
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
};
