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
 * ResultView (View) — owns the results pane DOM and its own cursor: the focused
 * case row (resultIndex) and whether we're scrolling inside a result (inResult).
 * Renders case rows, the N/A row, and the setup-failure reload prompt. The
 * controller owns app state (active pane, reload-pending); this view reports row
 * interactions back through the methods it exposes.
 */
window.Harness = window.Harness || {};

window.Harness.createResultView = function () {
    var DATA_SCROLL_STEP_PX = 60;

    var listEl = document.getElementById('resultsList');
    var titleEl = document.getElementById('resultsTitle');
    var scrollEl = document.getElementById('resultsScroll');

    var resultIndex = 0;
    var inResult = false;
    var active = false; // true while the results pane holds true focus

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

    function updateHints() {
        window.Harness.updateScrollHints('resultsScroll', 'scrollUp', 'scrollDown');
    }

    function rows() {
        return listEl.querySelectorAll('.caseRow');
    }

    function focusedData() {
        var row = rows()[resultIndex];
        return row ? row.querySelector('.caseData') : null;
    }

    function dataIsScrollable(data) {
        return data && data.style.display !== 'none' && data.scrollHeight > data.clientHeight;
    }

    function isArmed(row) {
        return !!(row && row.__armed);
    }

    // Activates a manual (armed) case exactly once: clears the flag first so it
    // can't double-fire from both a click and OK, then runs it.
    function fireArmed(row) {
        if (isArmed(row)) {
            var fire = row.__armed;
            row.__armed = null;
            fire();
        }
    }

    // Highlights the focused row (so Up/Down scroll the page row-by-row) and, while
    // inside a result, marks its data block as the active scroll target. Snaps to
    // the true extremes for first/last so the viewport can fully reach top/bottom.
    function syncFocus() {
        var r = rows();
        for (var i = 0; i < r.length; i++) {
            var cls = 'caseRow';
            if (active && i === resultIndex) {
                cls += ' focused' + (inResult ? ' scrolling' : '');
            }
            r[i].className = cls;
        }
        titleEl.className = active ? 'focused' : '';
        var row = r[resultIndex];
        if (active && row && scrollEl) {
            if (resultIndex === 0) {
                scrollEl.scrollTop = 0;
            } else if (resultIndex === r.length - 1) {
                scrollEl.scrollTop = scrollEl.scrollHeight;
            } else if (row.scrollIntoView) {
                row.scrollIntoView({ block: 'nearest' });
            }
        }
        updateHints();
    }

    function appendCase(name) {
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

        listEl.appendChild(row);

        function setBadge(cls, text) {
            badge.className = 'badge ' + cls;
            badge.textContent = text;
        }

        function showData(text) {
            if (text !== undefined && text !== 'undefined' && text !== '') {
                data.textContent = text;
                data.style.display = 'block';
            }
            updateHints();
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
            arm: function (onFire) {
                setBadge('manual', 'MANUAL');
                showData('Manual test — press OK or click to run (this may exit the app).');
                row.__armed = onFire;
                row.addEventListener('click', function () {
                    fireArmed(row);
                });
            }
        };
    }

    // ---- public ----------------------------------------------------------

    function reset(title) {
        titleEl.textContent = title;
        listEl.innerHTML = '';
        resultIndex = 0;
        inResult = false;
    }

    function addCase(name) {
        return appendCase(name);
    }

    // A single inert "not available" row (can't be entered/scrolled).
    function showUnavailable(message) {
        var view = appendCase('not supported');
        view.row.__inert = true;
        view.settle(false, message);
    }

    // The setup-failure error row plus a reload prompt; onReload fires on the
    // button (the controller also maps OK to it via its reload-pending state).
    function showReloadPrompt(error, onReload) {
        appendCase('setup').settle(false, error || 'Object not available for this access type.');

        var note = document.createElement('div');
        note.className = 'reloadNote';
        note.textContent =
            'This object may be limited to one instance per page load. Reload to reset ' +
            'the session and test a different access type.';

        var button = document.createElement('div');
        button.className = 'reloadButton';
        button.textContent = '↻ Reload page';
        button.addEventListener('click', onReload);

        listEl.appendChild(note);
        listEl.appendChild(button);
    }

    // Pre-init fatal row (library never resolved); list is still empty.
    function showFatal(message) {
        appendCase(message).settle(false);
    }

    function setActive(isActive) {
        active = !!isActive;
        syncFocus();
    }

    function focusDown() {
        resultIndex = Math.min(resultIndex + 1, rows().length - 1);
        syncFocus();
    }

    function focusUp() {
        resultIndex = Math.max(resultIndex - 1, 0);
        syncFocus();
    }

    // OK/Right on the focused row: fire an armed case, ignore an inert row, or
    // otherwise enter data-scroll mode if the row's data overflows.
    function activateFocused() {
        var row = rows()[resultIndex];
        if (isArmed(row)) {
            fireArmed(row);
        } else if (row && row.__inert) {
            return;
        } else if (dataIsScrollable(focusedData())) {
            inResult = true;
            syncFocus();
        }
    }

    function isInData() {
        return inResult;
    }

    function scrollData(direction) {
        var data = focusedData();
        if (data) {
            data.scrollTop += direction * DATA_SCROLL_STEP_PX;
        }
    }

    function exitData() {
        inResult = false;
        syncFocus();
    }

    return {
        reset: reset,
        addCase: addCase,
        showUnavailable: showUnavailable,
        showReloadPrompt: showReloadPrompt,
        showFatal: showFatal,
        refresh: syncFocus,
        setActive: setActive,
        focusDown: focusDown,
        focusUp: focusUp,
        activateFocused: activateFocused,
        isInData: isInData,
        scrollData: scrollData,
        exitData: exitData,
        updateHints: updateHints
    };
};
