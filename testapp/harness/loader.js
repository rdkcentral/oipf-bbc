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
 * Resolves which library instance the harness tests against, supporting the two
 * meta environments:
 *
 *   local  — this app loads its own bundled copy (../dist/stb/oipf-bbc.js).
 *   auto   — the platform/STB injects the OIPF library globally before our
 *            scripts run; we must NOT load a second copy.
 *
 * Mode is forced with ?lib=local or ?lib=auto. With no param we auto-detect:
 * if the globals already exist we treat it as `auto`, otherwise we fall back to
 * `local` and inject the bundle.
 */
(function () {
    var LIB_SRC = '../dist/stb/oipf-bbc.js';
    var AUTO_POLL_INTERVAL_MS = 100;
    var AUTO_POLL_TIMEOUT_MS = 3000;

    function getParam(name) {
        var match = new RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function librariesPresent() {
        return typeof window.oipfObjectFactory !== 'undefined' &&
            typeof window.bbc !== 'undefined' &&
            typeof window.onesdk !== 'undefined';
    }

    function start(mode) {
        window.harness.init({ mode: mode, onesdk: window.onesdk });
    }

    function loadLocal() {
        if (librariesPresent()) {
            // Already injected by something else; don't pull in a second copy.
            start('local');
            return;
        }
        var script = document.createElement('script');
        script.src = LIB_SRC;
        script.onload = function () {
            start('local');
        };
        script.onerror = function () {
            window.harness.fatal('Failed to load local library from ' + LIB_SRC);
        };
        document.body.appendChild(script);
    }

    function loadAuto() {
        if (librariesPresent()) {
            start('auto');
            return;
        }
        // The platform may inject asynchronously; poll briefly before giving up.
        var waited = 0;
        var timer = window.setInterval(function () {
            if (librariesPresent()) {
                window.clearInterval(timer);
                start('auto');
            } else if ((waited += AUTO_POLL_INTERVAL_MS) >= AUTO_POLL_TIMEOUT_MS) {
                window.clearInterval(timer);
                window.harness.fatal(
                    'Library not found in auto-loaded environment (waited ' +
                        AUTO_POLL_TIMEOUT_MS +
                        'ms). Use ?lib=local to test the bundled copy.'
                );
            }
        }, AUTO_POLL_INTERVAL_MS);
    }

    var requested = getParam('lib');
    var mode = requested === 'auto' || requested === 'local'
        ? requested
        : librariesPresent() ? 'auto' : 'local';

    if (mode === 'auto') {
        loadAuto();
    } else {
        loadLocal();
    }
})();
