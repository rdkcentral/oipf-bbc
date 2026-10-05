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
import type { InitEnv, TestCase, TreeNode } from 'harness/types';
import type { Tree } from 'harness/model/tree';
import type { Runner } from 'harness/model/runner';
import type { AutoRunner } from 'harness/model/autorun';
import type { LogView } from 'harness/view/log';
import type { MenuView } from 'harness/view/menuView';
import type { ResultView } from 'harness/view/resultView';
import type { PopupView } from 'harness/view/popupView';
import type { ConfirmView } from 'harness/view/confirmView';

export interface Controller {
    init: (env: InitEnv) => void;
    fatal: (message: string) => void;
    activate: (child: TreeNode) => void;
    confirmExit: (accepted: boolean) => void;
}

export interface ControllerDeps {
    tree: Tree;
    runner: Runner;
    autoRunner: AutoRunner;
    logView: LogView;
    menuView: MenuView;
    resultView: ResultView;
    popupView: PopupView;
    confirmView: ConfirmView;
}

type Pane = 'menu' | 'results' | 'popup' | 'confirm';
type KeyAction = 'down' | 'up' | 'select' | 'right' | 'left' | 'back';

interface Level {
    node: TreeNode;
    savedFocus: number;
}

export function createController(deps: ControllerDeps): Controller {
    const tree = deps.tree;
    const runner = deps.runner;
    const autoRunner = deps.autoRunner;
    const logView = deps.logView;
    const menuView = deps.menuView;
    const resultView = deps.resultView;
    const popupView = deps.popupView;
    const confirmView = deps.confirmView;

    // Map raw key codes to semantic actions in one place
    const KEY_ACTIONS: Record<number, KeyAction> = {
        40: 'down',
        38: 'up',
        13: 'select',
        39: 'right',
        37: 'left',
        8: 'back',
        27: 'back', // Esc on desktop; the Back key on our STB environment
        461: 'back'
    };

    let pane: Pane = 'menu';
    let levels: Level[] = []; // drill-down stack of { node, savedFocus }; last = current

    function setStatus(text: string) {
        const el = document.getElementById('appStatus');
        if (el) {
            el.textContent = text;
        }
    }

    // ---- menu side -------------------------------------------------------

    function renderMenu() {
        const top = levels[levels.length - 1];
        const breadcrumb = levels.map(function (frame) {
            return frame.node.label;
        });
        menuView.render(top.node, top.savedFocus || 0, breadcrumb, pane === 'results');
    }

    // Drill into a branch, start an autorun, or run a leaf (key-select and click).
    function activate(child: TreeNode): void {
        if (tree.isLeaf(child)) {
            const group = child.group!;
            if ('autorun' in group) {
                startAutorun(group.autorun, child.label);
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
        const top = levels[levels.length - 1];
        const child = top.node.children[menuView.focusedIndex()];
        if (child) {
            activate(child);
        }
    }

    function handleMenuKey(action: KeyAction) {
        if (action === 'down') {
            menuView.focusDown();
        } else if (action === 'up') {
            menuView.focusUp();
        } else if (action === 'select' || action === 'right') {
            selectFocused();
        } else if (action === 'back' || action === 'left') {
            // Left or Back pops a drill-down level. At the root there's nothing to
            // pop; Left stays a no-op there, but Back offers to exit the app.
            if (levels.length > 1) {
                levels.pop();
                renderMenu();
            } else if (action === 'back') {
                openExitConfirm();
            }
        }
    }

    // ---- exit confirmation -------------------------------------------------

    function openExitConfirm(): void {
        pane = 'confirm';
        confirmView.open('Exit the application?');
    }

    function confirmExit(accepted: boolean): void {
        confirmView.close();
        pane = 'menu';
        if (accepted) {
            window.close();
        }
    }

    function handleConfirmKey(action: KeyAction) {
        if (action === 'left' || action === 'right' || action === 'up' || action === 'down') {
            confirmView.toggleFocus();
        } else if (action === 'select') {
            confirmExit(confirmView.isYesFocused());
        } else if (action === 'back') {
            confirmExit(false);
        }
    }

    // ---- results side ----------------------------------------------------

    function runCase(rowCtl: { markRunning: () => void; settle: (ok: boolean, value?: unknown) => void }, testCase: TestCase<unknown>, ctx: unknown) {
        rowCtl.markRunning();
        runner.execute(testCase, ctx).then(function (result) {
            rowCtl.settle(result.ok, result.value);
        });
    }

    function runLeaf(node: TreeNode) {
        pane = 'results';
        menuView.setGhosted(true);
        resultView.setActive(true);
        resultView.reset(node.label);

        const prep = runner.prepare(node);
        if (prep.kind === 'unavailable') {
            resultView.showUnavailable(prep.message);
        } else if (prep.kind === 'setupFailure') {
            // The reload button is a focusable item; activating it reloads.
            resultView.showReloadPrompt(prep.error, function () {
                window.location.reload();
            });
        } else {
            prep.cases.forEach(function (testCase) {
                const rowCtl = resultView.addCase(testCase.name);
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
    function startAutorun(scope: TreeNode, label: string) {
        pane = 'popup';
        const plan = autoRunner.collect(scope); // one traversal; the denominator + run plan
        popupView.open(label, plan.total);
        autoRunner
            .run(plan, function (entry) {
                popupView.addEntry(entry);
            })
            .then(function (summary) {
                popupView.markComplete(summary);
            });
    }

    function handlePopupKey(action: KeyAction) {
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

    function handleResultKey(action: KeyAction) {
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

    function onKeyDown(e: KeyboardEvent) {
        const action = KEY_ACTIONS[e.keyCode || e.which];
        if (!action) {
            return;
        }
        e.preventDefault();
        if (pane === 'popup') {
            handlePopupKey(action);
        } else if (pane === 'confirm') {
            handleConfirmKey(action);
        } else if (pane === 'menu') {
            handleMenuKey(action);
        } else {
            handleResultKey(action);
        }
    }

    // ---- lifecycle -------------------------------------------------------

    function init(env: InitEnv): void {
        logView.captureConsole();
        pane = 'menu';
        // All test files have registered by now; add the "» Run all tests" entry.
        tree.buildRunAllMenu();
        levels = [{ node: tree.root, savedFocus: 0 }];
        renderMenu();

        document.addEventListener('keydown', onKeyDown);
        document.getElementById('resultsScroll')!.addEventListener('scroll', resultView.updateHints);
        document.getElementById('menuScroll')!.addEventListener('scroll', menuView.updateHints);
        document.getElementById('popupScroll')!.addEventListener('scroll', popupView.updateHints);
        window.addEventListener('resize', function () {
            resultView.updateHints();
            menuView.updateHints();
            popupView.updateHints();
        });

        let version = '?';
        try {
            version = (env && env.onesdk && env.onesdk.VERSION) || '?';
        } catch (e) {
            /* ignore */
        }
        setStatus('mode: ' + (env ? env.mode : 'unknown') + '  |  onesdk.VERSION: ' + version);
    }

    function fatal(message: string): void {
        // Only reached from loader.ts before init() runs (the library never
        // resolved), so the results list is still empty.
        setStatus(message);
        resultView.showFatal(message);
        logView.append(message, true);
    }

    return {
        init: init,
        fatal: fatal,
        activate: activate,
        confirmExit: confirmExit
    };
}
