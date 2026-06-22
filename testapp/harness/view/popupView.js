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
 * PopupView (View) — the autorun report: a modal overlay with a live summary and a
 * flat chronological list of case results, scrollable by the remote. The
 * controller owns when it opens/closes; this view owns its DOM and scrolling.
 */
window.Harness = window.Harness || {};

window.Harness.createPopupView = function () {
    var SCROLL_STEP_PX = 80;

    var overlay = document.getElementById('popup');
    var titleEl = document.getElementById('popupTitle');
    var summaryEl = document.getElementById('popupSummary');
    var scrollEl = document.getElementById('popupScroll');
    var listEl = document.getElementById('popupList');
    var footerEl = document.getElementById('popupFooter');

    var total = 0;
    var done = 0;
    var passed = 0;
    var failed = 0;
    var complete = false;

    function updateHints() {
        window.Harness.updateScrollHints('popupScroll', 'popupScrollUp', 'popupScrollDown');
    }

    function refreshSummary() {
        summaryEl.textContent = done + '/' + total + ' · ' + passed + ' passed · ' + failed + ' failed';
    }

    function open(scopeLabel, runTotal) {
        total = runTotal;
        done = 0;
        passed = 0;
        failed = 0;
        complete = false;

        titleEl.textContent = 'Run all — ' + scopeLabel;
        listEl.innerHTML = '';
        footerEl.textContent = 'Running…';
        refreshSummary();
        scrollEl.scrollTop = 0;
        overlay.classList.add('open');
        updateHints();
    }

    function addEntry(entry) {
        done++;
        if (entry.ok) {
            passed++;
        } else {
            failed++;
        }

        var row = document.createElement('div');
        row.className = 'popupEntry ' + (entry.ok ? 'pass' : 'fail');

        var badge = document.createElement('span');
        badge.className = 'badge ' + (entry.ok ? 'pass' : 'fail');
        badge.textContent = entry.ok ? 'PASS' : 'FAIL';
        row.appendChild(badge);

        var text = document.createElement('div');
        text.className = 'popupEntryText';
        var path = document.createElement('span');
        path.className = 'popupPath';
        path.textContent = entry.path;
        var name = document.createElement('span');
        name.className = 'popupName';
        name.textContent = entry.name;
        text.appendChild(path);
        text.appendChild(name);
        // Show the detail only for failures, to keep the list scannable.
        if (!entry.ok) {
            var detail = document.createElement('span');
            detail.className = 'popupDetail';
            detail.textContent = window.Harness.pretty(entry.value);
            text.appendChild(detail);
        }
        row.appendChild(text);

        // Stick to the bottom only if the user is already there — don't yank them
        // back down while they're scrolled up reading an earlier result mid-run.
        var atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4;
        listEl.appendChild(row);
        refreshSummary();
        if (atBottom) {
            scrollEl.scrollTop = scrollEl.scrollHeight;
        }
        updateHints();
    }

    function markComplete(summary) {
        complete = true;
        var bits = [summary.passed + ' passed', summary.failed + ' failed'];
        if (summary.manualSkipped) {
            bits.push(summary.manualSkipped + ' manual skipped');
        }
        if (summary.naCount) {
            bits.push(summary.naCount + ' N/A');
        }
        footerEl.textContent = 'Done — ' + bits.join(', ') + '. Press Back to close.';
        refreshSummary();
        updateHints();
    }

    function scroll(direction) {
        scrollEl.scrollTop += direction * SCROLL_STEP_PX;
        updateHints();
    }

    function close() {
        overlay.classList.remove('open');
    }

    return {
        open: open,
        addEntry: addEntry,
        markComplete: markComplete,
        scroll: scroll,
        close: close,
        isComplete: function () {
            return complete;
        },
        updateHints: updateHints
    };
};
