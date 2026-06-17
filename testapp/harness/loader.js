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
 * Mode defaults to `auto` (the most common case going forward — the library is
 * injected by the platform). Pass ?lib=local to instead load the bundled copy.
 */
(function () {
    var LIB_SRC = '../dist/stb/oipf-bbc.js';
    var AUTO_POLL_INTERVAL_MS = 100;
    var AUTO_POLL_TIMEOUT_MS = 3000;

    var params = new URLSearchParams(window.location.search);

    function librariesPresent() {
        // Detect on oipfObjectFactory only — it is the one global common to both
        // the oipf-bbc library and the legacy library we compare against.
        return typeof window.oipfObjectFactory !== 'undefined';
    }

    function start(mode) {
        window.harness.init({ mode: mode, onesdk: window.onesdk });
    }

    function loadLocal() {
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

    var requested = params.get('lib');
    var mode = requested === 'local' ? 'local' : 'auto';

    if (mode === 'auto') {
        loadAuto();
    } else {
        loadLocal();
    }
})();
