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
 * Runner (Model) — runs a leaf's test group. DOM-free, so it (and the tree) can
 * be unit-tested headless. Caches setup() results per node id because some
 * library objects are single-instance per page load with no teardown — re-opening
 * a group must reuse the object rather than rebuild it (which would throw).
 */
export function createRunner() {
    const setupCache = {};

    // Decides what a leaf should show, resolving (and caching) its setup context:
    //   { kind: 'unavailable', message }   — interface type with no accessor
    //   { kind: 'setupFailure', error }    — setup threw or yielded nothing
    //   { kind: 'cases', cases, ctx }      — ready to run
    function prepare(node) {
        const group = node.group;
        if (group.naMessage) {
            return { kind: 'unavailable', message: group.naMessage };
        }
        if (typeof group.setup !== 'function') {
            return { kind: 'cases', cases: group.cases || [], ctx: undefined };
        }
        if (Object.prototype.hasOwnProperty.call(setupCache, node.id)) {
            return { kind: 'cases', cases: group.cases || [], ctx: setupCache[node.id] };
        }
        let ctx;
        try {
            ctx = group.setup();
        } catch (err) {
            return { kind: 'setupFailure', error: err };
        }
        if (!ctx) {
            return { kind: 'setupFailure', error: null };
        }
        setupCache[node.id] = ctx;
        return { kind: 'cases', cases: group.cases || [], ctx: ctx };
    }

    // Runs one case; always resolves (never rejects) with { ok, value }.
    function execute(testCase, ctx) {
        return new Promise(function (resolve) {
            try {
                Promise.resolve(testCase.run(ctx)).then(
                    function (value) {
                        resolve({ ok: true, value: value });
                    },
                    function (err) {
                        resolve({ ok: false, value: err });
                    }
                );
            } catch (err) {
                resolve({ ok: false, value: err });
            }
        });
    }

    return {
        prepare: prepare,
        execute: execute
    };
}
