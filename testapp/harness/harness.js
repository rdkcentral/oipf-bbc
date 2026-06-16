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
                refreshFocus();
                runGroup(groupIds[focusIndex]);
            });
            menu.appendChild(item);
        });
    }

    function refreshFocus() {
        var items = document.querySelectorAll('.menuItem');
        for (var i = 0; i < items.length; i++) {
            items[i].className = 'menuItem' + (i === focusIndex ? ' focused' : '');
        }
        var focused = items[focusIndex];
        if (focused && focused.scrollIntoView) {
            focused.scrollIntoView({ block: 'nearest' });
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

        return {
            settle: function (ok, value) {
                badge.className = 'badge ' + (ok ? 'pass' : 'fail');
                badge.textContent = ok ? 'PASS' : 'FAIL';
                var text = pretty(value);
                if (text !== undefined && text !== 'undefined' && text !== '') {
                    data.textContent = text;
                    data.style.display = 'block';
                }
            }
        };
    }

    function runGroup(id) {
        var group = tests[id];
        if (!group) {
            return;
        }
        pane = 'results';
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
    }

    // ---- remote / keyboard navigation -----------------------------------

    // Browser arrow/enter codes plus common STB Back codes (8, 461).
    function onKeyDown(e) {
        var code = e.keyCode || e.which;
        var handled = true;

        if (pane === 'menu') {
            if (code === 40) {
                // Down
                focusIndex = Math.min(focusIndex + 1, groupIds.length - 1);
                refreshFocus();
            } else if (code === 38) {
                // Up
                focusIndex = Math.max(focusIndex - 1, 0);
                refreshFocus();
            } else if (code === 13 || code === 39) {
                // Enter / Right -> run + move to results
                runGroup(groupIds[focusIndex]);
            } else {
                handled = false;
            }
        } else {
            // results pane
            if (code === 37 || code === 8 || code === 461) {
                // Left / Back -> return to menu
                pane = 'menu';
            } else {
                handled = false;
            }
        }

        if (handled) {
            e.preventDefault();
        }
    }

    // ---- public ----------------------------------------------------------

    function init(env) {
        captureConsole();
        buildMenu();
        document.addEventListener('keydown', onKeyDown);

        var version = '?';
        try {
            version = (env && env.onesdk && env.onesdk.VERSION) || '?';
        } catch (e) {
            /* ignore */
        }
        setStatus('mode: ' + (env ? env.mode : 'unknown') + '  |  onesdk.VERSION: ' + version);

        if (groupIds.length) {
            refreshFocus();
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
