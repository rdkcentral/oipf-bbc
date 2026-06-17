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
 * Minimal, dependency-free test harness for the oipf-bbc library.
 *
 * Test groups self-register via `harness.register({ path, accessors, cases })`
 * (see the files in tests/); the harness builds a drill-down menu tree from them.
 * `harness.init()` is called by harness/loader.js once the library is resolved
 * (either the local ../dist copy, or a platform-injected instance).
 *
 * Everything renders to the screen: results pane + a log pane that also mirrors
 * console.log / console.error, since the target STB browser has no devtools.
 */
window.harness = (function () {
    // Generic menu tree. Branch nodes have `children`; leaf nodes carry a `group`
    // (a runnable test group). Nodes may carry a `subtitle` (second menu line) and
    // a `caption` (help text shown above this node's children). Built by register().
    var root = {
        label: 'Home',
        children: [],
        index: {},
        group: null,
        subtitle: null,
        caption: 'How are OIPF objects accessed? Choose an interface type, or a global category.'
    };

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

    // Navigation state. `levels` is the drill-down stack of branch nodes in view
    // (last = current level, each with its own focus); the rest is the
    // results-pane cursor. Grouped so adding menu layers stays localised here.
    var nav = {
        levels: [], // [{ node, focusIndex }] — set in init()
        pane: 'menu', // 'menu' | 'results'
        resultIndex: 0, // focused case row while nav.pane === 'results'
        inResult: false, // true while scrolling within the focused result's data
        reloadPending: false // true while the results pane shows a setup-failure reload prompt
    };

    var DATA_SCROLL_STEP_PX = 60;

    // Successful setup() results, keyed by group id. Some library objects are
    // single-instance per page load (e.g. only one VideoBroadcast view, one
    // ApplicationManager) with no teardown API — so re-opening a group must
    // reuse the object rather than reconstruct it (which would throw).
    var setupCache = {};

    // ---- on-screen log (mirrors console) --------------------------------

    function appendLog(text, isError) {
        var list = document.getElementById('logList');
        if (!list) {
            return;
        }
        var line = document.createElement('div');
        line.className = 'logLine' + (isError ? ' error' : '');
        line.textContent = text;
        list.appendChild(line);
        list.scrollTop = list.scrollHeight;
    }

    function stringifyArgs(args) {
        return Array.prototype.map
            .call(args, function (a) {
                if (typeof a === 'string') {
                    return a;
                }
                try {
                    return JSON.stringify(a);
                } catch (e) {
                    return String(a);
                }
            })
            .join(' ');
    }

    function captureConsole() {
        ['log', 'info', 'warn', 'error'].forEach(function (level) {
            var original = console[level] ? console[level].bind(console) : function () {};
            console[level] = function () {
                appendLog(stringifyArgs(arguments), level === 'error' || level === 'warn');
                original.apply(null, arguments);
            };
        });
        window.addEventListener('error', function (e) {
            appendLog('Uncaught: ' + (e.message || e), true);
        });
        window.addEventListener('unhandledrejection', function (e) {
            appendLog('Unhandled rejection: ' + stringifyArgs([e.reason]), true);
        });
    }

    // ---- rendering -------------------------------------------------------

    function setStatus(text) {
        var el = document.getElementById('appStatus');
        if (el) {
            el.textContent = text;
        }
    }

    function pretty(value) {
        if (value instanceof Error) {
            return value.name + ': ' + value.message + (value.detail ? '\n' + value.detail : '');
        }
        if (typeof value === 'string') {
            return value;
        }
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            return String(value);
        }
    }

    function currentLevel() {
        return nav.levels[nav.levels.length - 1];
    }

    // A node is a leaf (runnable test group) when it carries a group; anything
    // else is a branch to drill into. Keyed on `group`, not child count, so an
    // empty branch isn't mistaken for a leaf (or a group-bearing node for a branch).
    function isLeaf(node) {
        return !!node.group;
    }

    // Renders the current level's children into the menu column and refreshes the
    // breadcrumb. Called when drilling in/out; intra-level focus moves only call
    // syncMenuFocus.
    function renderLevel() {
        var level = currentLevel();
        var menu = document.getElementById('menuScroll');
        menu.innerHTML = '';
        level.node.children.forEach(function (child, i) {
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
                level.focusIndex = i;
                selectCurrent();
            });
            menu.appendChild(item);
        });
        renderBreadcrumb();
        renderCaption();
        syncMenuFocus();
    }

    // Optional help text for the current level (e.g. "How are OIPF objects
    // accessed?"), taken from the level's node; hidden when there's none.
    function renderCaption() {
        var el = document.getElementById('menuCaption');
        if (!el) {
            return;
        }
        var caption = currentLevel().node.caption;
        el.textContent = caption || '';
        el.style.display = caption ? 'block' : 'none';
    }

    function renderBreadcrumb() {
        var el = document.getElementById('menuBreadcrumb');
        if (!el) {
            return;
        }
        // root label + each pushed branch level's label.
        var labels = nav.levels.map(function (l) {
            return l.node.label;
        });
        el.textContent = labels.join(' › ');
    }

    // Drills into the focused branch, or runs the focused leaf.
    function selectCurrent() {
        var level = currentLevel();
        var child = level.node.children[level.focusIndex];
        if (!child) {
            return;
        }
        if (isLeaf(child)) {
            runGroup(child);
        } else {
            nav.levels.push({ node: child, focusIndex: 0 });
            renderLevel();
        }
    }

    function syncMenuFocus() {
        // The focused item is fully highlighted only while the menu holds true
        // focus; when the results pane is active it is shown "ghosted" so it is
        // clear the menu isn't focused, while still marking where focus returns.
        var level = currentLevel();
        var focusedClass = 'menuItem focused' + (nav.pane === 'results' ? ' ghosted' : '');
        var items = document.querySelectorAll('.menuItem');
        for (var i = 0; i < items.length; i++) {
            items[i].className = i === level.focusIndex ? focusedClass : 'menuItem';
        }

        // Mark the results pane (via its title) when it holds true focus.
        var resultsTitle = document.getElementById('resultsTitle');
        resultsTitle.className = nav.pane === 'results' ? 'focused' : '';
        var focused = items[level.focusIndex];
        if (focused && focused.scrollIntoView) {
            focused.scrollIntoView({ block: 'nearest' });
        }
        updateMenuHints();
    }

    function focusedResultData() {
        var rows = document.querySelectorAll('.caseRow');
        var row = rows[nav.resultIndex];
        return row ? row.querySelector('.caseData') : null;
    }

    function dataIsScrollable(data) {
        return data && data.style.display !== 'none' && data.scrollHeight > data.clientHeight;
    }

    // Highlights the focused case row (so Up/Down scroll the page row-by-row) and,
    // while inside a result, marks its data block as the active scroll target.
    function syncResultFocus() {
        var rows = document.querySelectorAll('.caseRow');
        for (var i = 0; i < rows.length; i++) {
            var cls = 'caseRow';
            if (nav.pane === 'results' && i === nav.resultIndex) {
                cls += ' focused' + (nav.inResult ? ' scrolling' : '');
            }
            rows[i].className = cls;
        }
        var scroller = document.getElementById('resultsScroll');
        var row = rows[nav.resultIndex];
        if (nav.pane === 'results' && row && scroller) {
            // Snap to the true extremes for the first/last rows so the viewport
            // can actually reach top/bottom (a tall last row aligned 'nearest'
            // would leave content — and the "more below" hint — stuck on screen);
            // intermediate rows just scroll the minimum needed.
            if (nav.resultIndex === 0) {
                scroller.scrollTop = 0;
            } else if (nav.resultIndex === rows.length - 1) {
                scroller.scrollTop = scroller.scrollHeight;
            } else if (row.scrollIntoView) {
                row.scrollIntoView({ block: 'nearest' });
            }
        }
        updateResultHints();
    }

    // Fades in the up/down indicators when a scroll container has off-screen
    // content in that direction. Cheap enough to call on every scroll or focus.
    function updateScrollHints(scrollerId, upId, downId) {
        var scroller = document.getElementById(scrollerId);
        if (!scroller) {
            return;
        }
        var atTop = scroller.scrollTop <= 0;
        var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        document.getElementById(upId).classList.toggle('visible', !atTop);
        document.getElementById(downId).classList.toggle('visible', !atBottom);
    }

    function updateResultHints() {
        updateScrollHints('resultsScroll', 'scrollUp', 'scrollDown');
    }

    function updateMenuHints() {
        updateScrollHints('menuScroll', 'menuScrollUp', 'menuScrollDown');
    }

    function isArmed(row) {
        return !!(row && row.__armed);
    }

    // Activates a manual (armed) case exactly once: clears the arm flag first so
    // it can't double-fire from both a click and OK, then runs it. Safe to call
    // on any row; single source of truth for both activation paths.
    function fireArmed(row) {
        if (isArmed(row)) {
            var runner = row.__armed;
            row.__armed = null;
            runner();
        }
    }

    function renderCase(name) {
        var row = document.createElement('div');
        row.className = 'caseRow';

        var head = document.createElement('div');
        head.className = 'caseHead';

        var badge = document.createElement('span');
        badge.className = 'badge running';
        badge.textContent = 'RUN';

        var label = document.createElement('span');
        label.className = 'caseName';
        label.textContent = name;

        head.appendChild(badge);
        head.appendChild(label);
        row.appendChild(head);

        var data = document.createElement('pre');
        data.className = 'caseData';
        data.style.display = 'none';
        row.appendChild(data);

        document.getElementById('resultsList').appendChild(row);

        function setBadge(cls, text) {
            badge.className = 'badge ' + cls;
            badge.textContent = text;
        }

        function showData(text) {
            if (text !== undefined && text !== 'undefined' && text !== '') {
                data.textContent = text;
                data.style.display = 'block';
            }
            updateResultHints();
        }

        return {
            row: row,
            markRunning: function () {
                setBadge('running', 'RUN');
            },
            settle: function (ok, value) {
                setBadge(ok ? 'pass' : 'fail', ok ? 'PASS' : 'FAIL');
                showData(pretty(value));
            },
            // Arms a manual case: it does NOT run on group selection. The runner
            // fires only on explicit activation (OK/click), once. Used for
            // destructive actions (e.g. launching/closing the app).
            arm: function (runner) {
                setBadge('manual', 'MANUAL');
                showData('Manual test — press OK or click to run (this may exit the app).');
                row.__armed = runner;
                row.addEventListener('click', function () {
                    fireArmed(row);
                });
            }
        };
    }

    function executeCase(testCase, view, ctx) {
        view.markRunning();
        try {
            Promise.resolve(testCase.run(ctx)).then(
                function (value) {
                    view.settle(true, value);
                },
                function (err) {
                    view.settle(false, err);
                }
            );
        } catch (err) {
            view.settle(false, err);
        }
    }

    // Shown when a group's setup() throws or yields no object — typically the
    // single-instance conflict (only one VideoBroadcast view / ApplicationManager
    // per page load). Renders the error plus a Reload prompt; OK/Enter or a click
    // reloads the page so a different access type can be tried from a clean state.
    function renderSetupFailure(err) {
        renderCase('setup').settle(false, err || 'Object not available for this access type.');

        var note = document.createElement('div');
        note.className = 'reloadNote';
        note.textContent =
            'This object may be limited to one instance per page load. Reload to reset ' +
            'the session and test a different access type.';

        var button = document.createElement('div');
        button.className = 'reloadButton';
        button.textContent = '↻ Reload page';
        button.addEventListener('click', function () {
            window.location.reload();
        });

        var list = document.getElementById('resultsList');
        list.appendChild(note);
        list.appendChild(button);

        nav.reloadPending = true;
        syncResultFocus();
    }

    function runGroup(node) {
        var group = node.group;
        if (!group) {
            return;
        }
        nav.pane = 'results';
        nav.resultIndex = 0;
        nav.inResult = false;
        nav.reloadPending = false;
        syncMenuFocus();
        document.getElementById('resultsTitle').textContent = node.label;
        document.getElementById('resultsList').innerHTML = '';

        // Leaf that exists for an interface type it doesn't support
        if (group.naMessage) {
            var naView = renderCase('not supported');
            naView.row.__inert = true; // not real data — can't be entered/scrolled
            naView.settle(false, group.naMessage);
            syncResultFocus();
            return;
        }

        // Optional setup() yields a context passed to every case. Its result is
        // cached (by node id) so re-opening a group reuses the same object (some
        // library objects are single-instance per page load and would throw if
        // rebuilt). If setup throws or yields no object — the cross-access conflict
        // for single-instance features — show a reload prompt instead of the cases.
        var ctx;
        if (typeof group.setup === 'function') {
            if (Object.prototype.hasOwnProperty.call(setupCache, node.id)) {
                ctx = setupCache[node.id];
            } else {
                try {
                    ctx = group.setup();
                } catch (err) {
                    renderSetupFailure(err);
                    return;
                }
                if (ctx) {
                    setupCache[node.id] = ctx;
                }
            }
            if (!ctx) {
                renderSetupFailure(null);
                return;
            }
        }

        (group.cases || []).forEach(function (testCase) {
            var view = renderCase(testCase.name);
            if (testCase.manual) {
                // Don't auto-run; wait for explicit activation (see executeCase).
                view.arm(function () {
                    executeCase(testCase, view, ctx);
                });
            } else {
                executeCase(testCase, view, ctx);
            }
        });

        syncResultFocus();
    }

    // ---- remote / keyboard navigation -----------------------------------

    // Map raw key codes to semantic actions in one place: browser arrows/enter
    // plus common STB codes (Back is 8/461, joining Left). Enter ('select') and
    // Right are kept distinct because Right enters a result but does not exit one.
    var KEY_ACTIONS = {
        40: 'down',
        38: 'up',
        13: 'select',
        39: 'right',
        37: 'back',
        8: 'back',
        461: 'back'
    };

    // Each handler acts on a semantic action; unrecognised actions are ignored.

    function handleMenuKey(action) {
        var level = currentLevel();
        if (action === 'down') {
            level.focusIndex = Math.min(level.focusIndex + 1, level.node.children.length - 1);
            syncMenuFocus();
        } else if (action === 'up') {
            level.focusIndex = Math.max(level.focusIndex - 1, 0);
            syncMenuFocus();
        } else if (action === 'select' || action === 'right') {
            selectCurrent();
        } else if (action === 'back') {
            // Pop a drill-down level; no-op at the root.
            if (nav.levels.length > 1) {
                nav.levels.pop();
                renderLevel();
            }
        }
    }

    // Results pane: navigate between case rows (scrolls the page row-by-row).
    function handleResultKey(action) {
        if (nav.reloadPending) {
            // Setup-failure state: OK reloads the page, Back returns to the menu.
            if (action === 'select' || action === 'right') {
                window.location.reload();
            } else if (action === 'back') {
                nav.pane = 'menu';
                syncMenuFocus();
            }
            return;
        }
        if (action === 'down') {
            nav.resultIndex = Math.min(nav.resultIndex + 1, document.querySelectorAll('.caseRow').length - 1);
            syncResultFocus();
        } else if (action === 'up') {
            nav.resultIndex = Math.max(nav.resultIndex - 1, 0);
            syncResultFocus();
        } else if (action === 'select' || action === 'right') {
            var focusedRow = document.querySelectorAll('.caseRow')[nav.resultIndex];
            if (isArmed(focusedRow)) {
                fireArmed(focusedRow);
            } else if (focusedRow && focusedRow.__inert) {
                // Inert row (e.g. an N/A message) — nothing to enter.
            } else if (dataIsScrollable(focusedResultData())) {
                // Otherwise scroll into this result if its data overflows.
                nav.inResult = true;
                syncResultFocus();
            }
        } else if (action === 'back') {
            nav.pane = 'menu';
            syncMenuFocus();
            syncResultFocus();
        }
    }

    // Scrolling within the focused result's data block.
    function handleDataScrollKey(action) {
        var data = focusedResultData();
        if (action === 'down') {
            if (data) data.scrollTop += DATA_SCROLL_STEP_PX;
        } else if (action === 'up') {
            if (data) data.scrollTop -= DATA_SCROLL_STEP_PX;
        } else if (action === 'back' || action === 'select') {
            // Exit the result, back to row navigation.
            nav.inResult = false;
            syncResultFocus();
        }
    }

    function onKeyDown(e) {
        e.preventDefault();
        
        var action = KEY_ACTIONS[e.keyCode || e.which];
        if (!action) {
            return;
        }
        var handler = nav.pane === 'menu' ? handleMenuKey : nav.inResult ? handleDataScrollKey : handleResultKey;
        handler(action);
    }

    // ---- public ----------------------------------------------------------

    function init(env) {
        captureConsole();
        nav.levels = [{ node: root, focusIndex: 0 }];
        renderLevel();
        document.addEventListener('keydown', onKeyDown);
        document.getElementById('resultsScroll').addEventListener('scroll', updateResultHints);
        document.getElementById('menuScroll').addEventListener('scroll', updateMenuHints);
        window.addEventListener('resize', function () {
            updateResultHints();
            updateMenuHints();
        });

        var version = '?';
        try {
            version = (env && env.onesdk && env.onesdk.VERSION) || '?';
        } catch (e) {
            /* ignore */
        }
        setStatus('mode: ' + (env ? env.mode : 'unknown') + '  |  onesdk.VERSION: ' + version);
    }

    function fatal(message) {
        // Only reached from loader.js before init() runs (the library never
        // resolved), so the results list is still empty — just add a failed row
        // via the shared builder rather than hand-rolling the markup.
        setStatus(message);
        renderCase(message).settle(false);
        appendLog(message, true);
    }

    // ---- test-registration helpers --------------------------------------
    //
    // These are harness primitives (not test data), so they live here and are
    // defined before any test file runs — test files self-register against them
    // regardless of <script> ordering. See the OIPF feature tests for usage:
    //
    //   bbc      — the window.bbc facade object
    //   factory  — an object from window.oipfObjectFactory.createXObject()
    //   dom      — a <object type="..."> resolved via the library's
    //              document.getElementById override (auto-instantiation)

    // Returns an accessor (a setup function) that creates a DOM <object> of the
    // given type and resolves it through the factory's getElementById override.
    // Recreates on each call (removing any prior node) to avoid DOM build-up.
    function domObjectAccessor(type, id) {
        return function () {
            var existing = document.getElementById(id);
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
            var obj = document.createElement('object');
            obj.type = type;
            obj.id = id;
            document.body.appendChild(obj);
            // May return null off-STB: the override swallows instantiation errors.
            return document.getElementById(id);
        };
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

    // Registers a test group at an explicit `path`. A path containing
    // harness.INTERFACE is expanded once per interface type (wiring the matching
    // accessor from `accessors`; a missing one becomes an N/A leaf). A path
    // without it is placed literally (e.g. the global onesdk category).
    function register(spec) {
        var path = spec.path || [];
        var ifaceIdx = path.indexOf(INTERFACE);
        if (ifaceIdx === -1) {
            // A literal path whose first segment is an interface label almost
            // certainly meant to use harness.INTERFACE: as written it merges into
            // the expanded interface branch as a leaf with no accessor wiring.
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
        init: init,
        fatal: fatal,
        log: appendLog,
        register: register,
        INTERFACE: INTERFACE,
        domObjectAccessor: domObjectAccessor
    };
})();
