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
 * Shared machinery for exercising an OIPF feature through all three access
 * types, so each feature's assertions are written once and run against each.
 *
 *   bbc      — the window.bbc facade object
 *   factory  — an object built via window.oipfObjectFactory.createXObject()
 *   dom      — a <object type="..."> created in the DOM and resolved via the
 *              library's document.getElementById override (auto-instantiation)
 *
 * Loaded before the feature test files so harness.registerOipfFeature and
 * harness.domObjectAccessor are available when they self-register.
 */
(function () {
    // Returns an accessor (setup function) that creates a DOM <object> of the
    // given type and resolves it through the factory's getElementById override.
    // Recreates on each run (removing any prior node) to avoid DOM build-up.
    harness.domObjectAccessor = function (type, id) {
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
    };

    var ACCESS_TYPES = [
        { key: 'bbc', label: 'bbc' },
        { key: 'factory', label: 'Factory' },
        { key: 'dom', label: 'DOM' }
    ];

    // Registers one menu entry per access type for a feature. Each entry shares
    // the same `cases`; its `setup` is the matching accessor, so the resolved
    // object is created once and passed as the context to every case.
    harness.registerOipfFeature = function (spec) {
        ACCESS_TYPES.forEach(function (type) {
            var accessor = spec.accessors[type.key];
            if (!accessor) {
                return;
            }
            harness.tests[spec.key + '_' + type.key] = {
                label: spec.label + ' — ' + type.label,
                setup: accessor,
                cases: spec.cases
            };
        });
    };
})();
