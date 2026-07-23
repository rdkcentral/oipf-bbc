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
import { pretty, updateScrollHints } from 'harness/util.js';

export function createPopupView() {
    const SCROLL_STEP_PX = 80;

    const overlay = document.getElementById('popup');
    const titleEl = document.getElementById('popupTitle');
    const summaryEl = document.getElementById('popupSummary');
    const scrollEl = document.getElementById('popupScroll');
    const listEl = document.getElementById('popupList');
    const footerEl = document.getElementById('popupFooter');

    let total = 0;
    let done = 0;
    let passed = 0;
    let failed = 0;
    let complete = false;

    function updateHints() {
        updateScrollHints('popupScroll', 'popupScrollUp', 'popupScrollDown');
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
        overlay.setAttribute('aria-hidden', 'false'); // visible — expose to assistive tech
        updateHints();
    }

    function addEntry(entry) {
        done++;
        if (entry.ok) {
            passed++;
        } else {
            failed++;
        }

        const row = document.createElement('div');
        row.className = 'popupEntry ' + (entry.ok ? 'pass' : 'fail');

        const badge = document.createElement('span');
        badge.className = 'badge ' + (entry.ok ? 'pass' : 'fail');
        badge.textContent = entry.ok ? 'PASS' : 'FAIL';
        row.appendChild(badge);

        const text = document.createElement('div');
        text.className = 'popupEntryText';
        const path = document.createElement('span');
        path.className = 'popupPath';
        path.textContent = entry.path;
        const name = document.createElement('span');
        name.className = 'popupName';
        name.textContent = entry.name;
        text.appendChild(path);
        text.appendChild(name);
        // Show the detail only for failures, to keep the list scannable.
        if (!entry.ok) {
            const detail = document.createElement('span');
            detail.className = 'popupDetail';
            detail.textContent = pretty(entry.value);
            text.appendChild(detail);
        }
        row.appendChild(text);

        // Stick to the bottom only if the user is already there — don't yank them
        // back down while they're scrolled up reading an earlier result mid-run.
        const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 4;
        listEl.appendChild(row);
        refreshSummary();
        if (atBottom) {
            scrollEl.scrollTop = scrollEl.scrollHeight;
        }
        updateHints();
    }

    function markComplete(summary) {
        complete = true;
        const bits = [summary.passed + ' passed', summary.failed + ' failed'];
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
        overlay.setAttribute('aria-hidden', 'true'); // hidden — remove from accessibility tree
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
}
