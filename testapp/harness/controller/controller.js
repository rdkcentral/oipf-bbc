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
 * Controller — wires input to the model and views. Owns app state: the active
 * pane, the drill-down level stack, and the reload-pending flag. Views own their
 * own cursors (menu focus, result row/data); the model (tree, runner) is DOM-free.
 */
window.Harness = window.Harness || {};

window.Harness.createController = function (deps) {
    var tree = deps.tree;
    var runner = deps.runner;
    var autoRunner = deps.autoRunner;
    var logView = deps.logView;
    var menuView = deps.menuView;
    var resultView = deps.resultView;
    var popupView = deps.popupView;

    // Map raw key codes to semantic actions in one place
    var KEY_ACTIONS = {
        40: 'down',
        38: 'up',
        13: 'select',
        39: 'right',
        37: 'left',
        8: 'back',
        27: 'back', // Esc on desktop; the Back key on our STB environment
        461: 'back'
    };

    var pane = 'menu'; // 'menu' | 'results' | 'popup'
    var levels = []; // drill-down stack of { node, savedFocus }; last = current

    function setStatus(text) {
        var el = document.getElementById('appStatus');
        if (el) {
            el.textContent = text;
        }
    }

    // ---- menu side -------------------------------------------------------

    function renderMenu() {
        var top = levels[levels.length - 1];
        var breadcrumb = levels.map(function (frame) {
            return frame.node.label;
        });
        menuView.render(top.node, top.savedFocus || 0, breadcrumb, pane === 'results');
    }

    // Drill into a branch, start an autorun, or run a leaf (key-select and click).
    function activate(child) {
        if (tree.isLeaf(child)) {
            if (child.group.autorun) {
                startAutorun(child.group.autorun, child.label);
            } else {
                runLeaf(child);
            }
        } else {
            levels[levels.length - 1].savedFocus = menuView.focusedIndex();
            levels.push({ node: child, savedFocus: 0 });
            renderMenu();
        }
    }

    function selectFocused() {
        var top = levels[levels.length - 1];
        var child = top.node.children[menuView.focusedIndex()];
        if (child) {
            activate(child);
        }
    }

    function handleMenuKey(action) {
        if (action === 'down') {
            menuView.focusDown();
        } else if (action === 'up') {
            menuView.focusUp();
        } else if (action === 'select' || action === 'right') {
            selectFocused();
        } else if (action === 'back' || action === 'left') {
            // Left or Back pops a drill-down level; no-op at the root.
            if (levels.length > 1) {
                levels.pop();
                renderMenu();
            }
        }
    }

    // ---- results side ----------------------------------------------------

    function runCase(rowCtl, testCase, ctx) {
        rowCtl.markRunning();
        runner.execute(testCase, ctx).then(function (result) {
            rowCtl.settle(result.ok, result.value);
        });
    }

    function runLeaf(node) {
        pane = 'results';
        menuView.setGhosted(true);
        resultView.setActive(true);
        resultView.reset(node.label);

        var prep = runner.prepare(node);
        if (prep.kind === 'unavailable') {
            resultView.showUnavailable(prep.message);
        } else if (prep.kind === 'setupFailure') {
            // The reload button is a focusable item; activating it reloads.
            resultView.showReloadPrompt(prep.error, function () {
                window.location.reload();
            });
        } else {
            prep.cases.forEach(function (testCase) {
                var rowCtl = resultView.addCase(testCase.name);
                if (testCase.manual) {
                    // Don't auto-run; wait for explicit activation.
                    rowCtl.arm(function () {
                        runCase(rowCtl, testCase, prep.ctx);
                    });
                } else {
                    runCase(rowCtl, testCase, prep.ctx);
                }
            });
        }
        resultView.refresh();
    }

    function exitToMenu() {
        pane = 'menu';
        menuView.setGhosted(false);
        resultView.setActive(false);
    }

    // ---- autorun popup ---------------------------------------------------

    // Runs every non-manual case under a scope subtree, streaming results into a
    // modal popup. The run can't be cancelled (Back is inert until it completes).
    function startAutorun(scope, label) {
        pane = 'popup';
        var plan = autoRunner.collect(scope); // one traversal; the denominator + run plan
        popupView.open(label, plan.total);
        autoRunner
            .run(plan, function (entry) {
                popupView.addEntry(entry);
            })
            .then(function (summary) {
                popupView.markComplete(summary);
            });
    }

    function handlePopupKey(action) {
        if (action === 'down') {
            popupView.scroll(1);
        } else if (action === 'up') {
            popupView.scroll(-1);
        } else if (action === 'back' || action === 'select') {
            // Dismiss only once the run has finished (no mid-run cancel).
            if (popupView.isComplete()) {
                popupView.close();
                pane = 'menu';
            }
        }
    }

    function handleResultKey(action) {
        if (resultView.isInData()) {
            // Scrolling within the focused result's data block.
            if (action === 'down') {
                resultView.scrollData(1);
            } else if (action === 'up') {
                resultView.scrollData(-1);
            } else if (action === 'back' || action === 'left' || action === 'select') {
                resultView.exitData();
            }
            return;
        }
        if (action === 'down') {
            resultView.focusDown();
        } else if (action === 'up') {
            resultView.focusUp();
        } else if (action === 'select' || action === 'right') {
            resultView.activateFocused();
        } else if (action === 'back' || action === 'left') {
            exitToMenu();
        }
    }

    function onKeyDown(e) {
        var action = KEY_ACTIONS[e.keyCode || e.which];
        if (!action) {
            return;
        }
        e.preventDefault();
        if (pane === 'popup') {
            handlePopupKey(action);
        } else if (pane === 'menu') {
            handleMenuKey(action);
        } else {
            handleResultKey(action);
        }
    }

    // ---- lifecycle -------------------------------------------------------

    function init(env) {
        logView.captureConsole();
        pane = 'menu';
        // All test files have registered by now; add the "» Run all tests" entry.
        tree.buildRunAllMenu();
        levels = [{ node: tree.root, savedFocus: 0 }];
        renderMenu();

        document.addEventListener('keydown', onKeyDown);
        document.getElementById('resultsScroll').addEventListener('scroll', resultView.updateHints);
        document.getElementById('menuScroll').addEventListener('scroll', menuView.updateHints);
        document.getElementById('popupScroll').addEventListener('scroll', popupView.updateHints);
        window.addEventListener('resize', function () {
            resultView.updateHints();
            menuView.updateHints();
            popupView.updateHints();
        });

        var version = '?';
        try {
            version = (env && env.onesdk && env.onesdk.VERSION) || '?';
        } catch (e) {
            /* ignore */
        }
        setStatus('mode: ' + (env ? env.mode : 'unknown') + '  |  onesdk.VERSION: ' + version);
    }

    function fatal(message) {
        // Only reached from loader.js before init() runs (the library never
        // resolved), so the results list is still empty.
        setStatus(message);
        resultView.showFatal(message);
        logView.append(message, true);
    }

    return {
        init: init,
        fatal: fatal,
        activate: activate
    };
};
