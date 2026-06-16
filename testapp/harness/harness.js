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
 * Test groups self-register onto `harness.tests` (see the files in tests/).
 * `harness.init()` is called by harness/loader.js once the library is resolved
 * (either the local ../dist copy, or a platform-injected instance).
 *
 * Everything renders to the screen: results pane + a log pane that also mirrors
 * console.log / console.error, since the target STB browser has no devtools.
 */
window.harness = (function () {
    var tests = {};

    var groupIds = [];
    var focusIndex = 0;
    var pane = 'menu'; // 'menu' | 'results'

    var resultIndex = 0; // focused case row while pane === 'results'
    var inResult = false; // true while scrolling within the focused result's data
    var DATA_SCROLL_STEP_PX = 60;

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

    function buildMenu() {
        var menu = document.getElementById('menu');
        menu.innerHTML = '';
        groupIds = Object.keys(tests);
        groupIds.forEach(function (id, i) {
            var item = document.createElement('div');
            item.className = 'menuItem' + (i === focusIndex ? ' focused' : '');
            item.textContent = tests[id].label || id;
            item.setAttribute('data-index', String(i));
            item.addEventListener('click', function () {
                focusIndex = i;
                syncMenuFocus();
                runGroup(groupIds[focusIndex]);
            });
            menu.appendChild(item);
        });
    }

    function syncMenuFocus() {
        // The focused item is fully highlighted only while the menu holds true
        // focus; when the results pane is active it is shown "ghosted" so it is
        // clear the menu isn't focused, while still marking where focus returns.
        var focusedClass = 'menuItem focused' + (pane === 'results' ? ' ghosted' : '');
        var items = document.querySelectorAll('.menuItem');
        for (var i = 0; i < items.length; i++) {
            items[i].className = i === focusIndex ? focusedClass : 'menuItem';
        }

        // Mark the results pane (via its title) when it holds true focus.
        var resultsTitle = document.getElementById('resultsTitle');
        resultsTitle.className = pane === 'results' ? 'focused' : '';
        var focused = items[focusIndex];
        if (focused && focused.scrollIntoView) {
            focused.scrollIntoView({ block: 'nearest' });
        }
    }

    function focusedResultData() {
        var rows = document.querySelectorAll('.caseRow');
        var row = rows[resultIndex];
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
            if (pane === 'results' && i === resultIndex) {
                cls += ' focused' + (inResult ? ' scrolling' : '');
            }
            rows[i].className = cls;
        }
        var scroller = document.getElementById('resultsScroll');
        var row = rows[resultIndex];
        if (pane === 'results' && row && scroller) {
            // Snap to the true extremes for the first/last rows so the viewport
            // can actually reach top/bottom (a tall last row aligned 'nearest'
            // would leave content — and the "more below" hint — stuck on screen);
            // intermediate rows just scroll the minimum needed.
            if (resultIndex === 0) {
                scroller.scrollTop = 0;
            } else if (resultIndex === rows.length - 1) {
                scroller.scrollTop = scroller.scrollHeight;
            } else if (row.scrollIntoView) {
                row.scrollIntoView({ block: 'nearest' });
            }
        }
        updateScrollHints();
    }

    // Fades in the up/down indicators when there is off-screen content in the
    // results viewport. Cheap enough to call on every scroll, focus or settle.
    function updateScrollHints() {
        var scroller = document.getElementById('resultsScroll');
        if (!scroller) {
            return;
        }
        var atTop = scroller.scrollTop <= 0;
        var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        document.getElementById('scrollUp').classList.toggle('visible', !atTop);
        document.getElementById('scrollDown').classList.toggle('visible', !atBottom);
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

        return {
            settle: function (ok, value) {
                badge.className = 'badge ' + (ok ? 'pass' : 'fail');
                badge.textContent = ok ? 'PASS' : 'FAIL';
                var text = pretty(value);
                if (text !== undefined && text !== 'undefined' && text !== '') {
                    data.textContent = text;
                    data.style.display = 'block';
                }
                updateScrollHints();
            }
        };
    }

    function runGroup(id) {
        var group = tests[id];
        if (!group) {
            return;
        }
        pane = 'results';
        resultIndex = 0;
        inResult = false;
        syncMenuFocus();
        document.getElementById('resultsTitle').textContent = group.label || id;
        document.getElementById('resultsList').innerHTML = '';

        (group.cases || []).forEach(function (testCase) {
            var view = renderCase(testCase.name);
            try {
                Promise.resolve(testCase.run()).then(
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
        if (action === 'down') {
            focusIndex = Math.min(focusIndex + 1, groupIds.length - 1);
            syncMenuFocus();
        } else if (action === 'up') {
            focusIndex = Math.max(focusIndex - 1, 0);
            syncMenuFocus();
        } else if (action === 'select' || action === 'right') {
            runGroup(groupIds[focusIndex]);
        }
    }

    // Results pane: navigate between case rows (scrolls the page row-by-row).
    function handleResultKey(action) {
        if (action === 'down') {
            resultIndex = Math.min(resultIndex + 1, document.querySelectorAll('.caseRow').length - 1);
            syncResultFocus();
        } else if (action === 'up') {
            resultIndex = Math.max(resultIndex - 1, 0);
            syncResultFocus();
        } else if (action === 'select' || action === 'right') {
            // Scroll into this result if its data overflows.
            if (dataIsScrollable(focusedResultData())) {
                inResult = true;
                syncResultFocus();
            }
        } else if (action === 'back') {
            pane = 'menu';
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
            inResult = false;
            syncResultFocus();
        }
    }

    function onKeyDown(e) {
        e.preventDefault();
        
        var action = KEY_ACTIONS[e.keyCode || e.which];
        if (!action) {
            return;
        }
        var handler = pane === 'menu' ? handleMenuKey : inResult ? handleDataScrollKey : handleResultKey;
        handler(action);
    }

    // ---- public ----------------------------------------------------------

    function init(env) {
        captureConsole();
        buildMenu();
        document.addEventListener('keydown', onKeyDown);
        document.getElementById('resultsScroll').addEventListener('scroll', updateScrollHints);
        window.addEventListener('resize', updateScrollHints);

        var version = '?';
        try {
            version = (env && env.onesdk && env.onesdk.VERSION) || '?';
        } catch (e) {
            /* ignore */
        }
        setStatus('mode: ' + (env ? env.mode : 'unknown') + '  |  onesdk.VERSION: ' + version);

        if (groupIds.length) {
            syncMenuFocus();
        }
    }

    function fatal(message) {
        setStatus(message);
        var results = document.getElementById('resultsList');
        if (results) {
            results.innerHTML = '<div class="caseRow"><div class="caseHead">' +
                '<span class="badge fail">ERROR</span>' +
                '<span class="caseName"></span></div></div>';
            results.querySelector('.caseName').textContent = message;
        }
        appendLog(message, true);
    }

    return {
        tests: tests,
        init: init,
        fatal: fatal,
        log: appendLog
    };
})();
