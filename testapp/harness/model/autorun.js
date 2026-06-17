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
 * AutoRunner (Model) — runs every non-manual case under a chosen scope (a menu
 * subtree), sequentially, reporting each result via a callback. DOM-free, so it's
 * headless-testable. Scoping to one subtree keeps single-instance objects
 * (VideoBroadcast / ApplicationManager) from conflicting across interfaces.
 */
window.Harness = window.Harness || {};

window.Harness.createAutoRunner = function (deps) {
    var tree = deps.tree;
    var runner = deps.runner;

    // Depth-first list of every leaf under a node (the node itself if it's a leaf).
    function leavesUnder(node) {
        if (tree.isLeaf(node)) {
            return [node];
        }
        var out = [];
        node.children.forEach(function (child) {
            out = out.concat(leavesUnder(child));
        });
        return out;
    }

    // Counts up front so progress has a denominator. N/A leaves contribute nothing;
    // manual cases are skipped (and counted separately).
    function collect(scope) {
        var total = 0;
        var manualSkipped = 0;
        var naCount = 0;
        leavesUnder(scope).forEach(function (leaf) {
            var group = leaf.group;
            if (!group.cases) {
                naCount++; // naMessage leaf (or no cases)
                return;
            }
            group.cases.forEach(function (testCase) {
                if (testCase.manual) {
                    manualSkipped++;
                } else {
                    total++;
                }
            });
        });
        return { total: total, manualSkipped: manualSkipped, naCount: naCount };
    }

    // Runs the scope sequentially, calling onResult({ index, total, path, name, ok,
    // value }) as each case settles. Resolves with summary counts. Never rejects.
    function run(scope, onResult) {
        var stats = collect(scope);
        var total = stats.total;
        var leaves = leavesUnder(scope).filter(function (leaf) {
            return !!leaf.group.cases;
        });

        var passed = 0;
        var failed = 0;
        var index = 0;

        return new Promise(function (resolve) {
            var li = 0;
            var prep = null;
            var cases = null;
            var ci = 0;

            function finish() {
                resolve({
                    total: total,
                    passed: passed,
                    failed: failed,
                    manualSkipped: stats.manualSkipped,
                    naCount: stats.naCount
                });
            }

            function record(leaf, testCase, ok, value) {
                index++;
                if (ok) {
                    passed++;
                } else {
                    failed++;
                }
                onResult({ index: index, total: total, path: leaf.id, name: testCase.name, ok: ok, value: value });
            }

            function step() {
                if (li >= leaves.length) {
                    finish();
                    return;
                }
                var leaf = leaves[li];
                if (prep === null) {
                    prep = runner.prepare(leaf);
                    cases = leaf.group.cases.filter(function (testCase) {
                        return !testCase.manual;
                    });
                    ci = 0;
                }
                if (ci >= cases.length) {
                    li++;
                    prep = null;
                    cases = null;
                    step();
                    return;
                }
                var testCase = cases[ci];
                ci++;
                if (prep.kind === 'setupFailure') {
                    record(leaf, testCase, false, prep.error || 'setup failed (no object resolved)');
                    step();
                } else {
                    runner.execute(testCase, prep.ctx).then(function (result) {
                        record(leaf, testCase, result.ok, result.value);
                        step();
                    });
                }
            }

            step();
        });
    }

    return {
        collect: collect,
        run: run
    };
};
