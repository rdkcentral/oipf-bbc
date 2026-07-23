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
 * LogView (View) — mirrors console output to the on-screen log pane, since the
 * target STB browser has no devtools. Owns the #logList DOM; no app logic.
 */
import { pretty } from 'harness/util.js';

export function createLogView() {
    const list = document.getElementById('logList');

    function append(text, isError) {
        if (!list) {
            return;
        }
        const line = document.createElement('div');
        line.className = 'logLine' + (isError ? ' error' : '');
        line.textContent = text;
        list.appendChild(line);
        list.scrollTop = list.scrollHeight;
    }

    function stringifyArgs(args) {
        // Use the shared formatter so Errors render as name/message rather than the
        // bare "{}" that JSON.stringify produces for them.
        return Array.prototype.map
            .call(args, function (a) {
                return pretty(a);
            })
            .join(' ');
    }

    // Wraps console.* and global error events to also append to the log pane.
    function captureConsole() {
        ['log', 'info', 'warn', 'error'].forEach(function (level) {
            const original = console[level] ? console[level].bind(console) : function () {};
            console[level] = function () {
                append(stringifyArgs(arguments), level === 'error' || level === 'warn');
                original.apply(null, arguments);
            };
        });
        window.addEventListener('error', function (e) {
            append('Uncaught: ' + (e.message || e), true);
        });
        window.addEventListener('unhandledrejection', function (e) {
            append('Unhandled rejection: ' + stringifyArgs([e.reason]), true);
        });
    }

    return {
        append: append,
        captureConsole: captureConsole
    };
}
