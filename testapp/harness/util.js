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
 * Shared DOM helpers for the harness. Loaded first; everything else attaches to
 * the window.Harness namespace and the bootstrap (harness.js) assembles the
 * public window.harness facade from these pieces.
 */
window.Harness = window.Harness || {};

// Formats a test result value for display. Pure (no DOM) — shared by the result
// and popup views. Errors show name/message (+ optional detail); other values are
// pretty-printed JSON, falling back to String() for anything non-serialisable.
window.Harness.pretty = function (value) {
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
};

// Fades in the up/down indicators when a scroll container has off-screen content
// in that direction. Shared by the menu and results views.
window.Harness.updateScrollHints = function (scrollerId, upId, downId) {
    var scroller = document.getElementById(scrollerId);
    if (!scroller) {
        return;
    }
    var atTop = scroller.scrollTop <= 0;
    var atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    var up = document.getElementById(upId);
    var down = document.getElementById(downId);
    if (up) {
        up.classList.toggle('visible', !atTop);
    }
    if (down) {
        down.classList.toggle('visible', !atBottom);
    }
};
