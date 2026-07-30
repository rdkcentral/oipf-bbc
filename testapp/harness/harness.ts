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
 * Bootstrap — assembles the MVC-light pieces (model: tree + runner; views: menu,
 * result, log; controller) and exports the public harness facade.
 *
 * Test files import this module and self-register via harness.register({ path,
 * accessors, cases }); the entry point (src/index.ts) imports every test module
 * (for its registration side effect) and then loader.ts last, which calls
 * harness.init() once the library is resolved (local stb/ copy or platform).
 *
 * Everything renders to the screen: a drill-down menu, a results pane, and a log
 * pane that mirrors console.log/error (the target STB browser has no devtools).
 */
import { createTree } from 'harness/model/tree';
import { createRunner } from 'harness/model/runner';
import { createAutoRunner } from 'harness/model/autorun';
import { createLogView } from 'harness/view/log';
import { createMenuView } from 'harness/view/menuView';
import { createResultView } from 'harness/view/resultView';
import { createPopupView } from 'harness/view/popupView';
import { createController, type Controller } from 'harness/controller/controller';
import type { Accessor, Harness } from 'harness/types';

const tree = createTree();
const runner = createRunner();
const autoRunner = createAutoRunner({ tree: tree, runner: runner });
const logView = createLogView();
const resultView = createResultView();
const popupView = createPopupView();

let controller: Controller;
const menuView = createMenuView({
    isLeaf: tree.isLeaf,
    onActivate: function (child) {
        controller.activate(child);
    }
});
controller = createController({
    tree: tree,
    runner: runner,
    autoRunner: autoRunner,
    logView: logView,
    menuView: menuView,
    resultView: resultView,
    popupView: popupView
});

// Test-authoring helper: returns an accessor (a setup function) that creates a
// DOM <object> of the given type and resolves it through the factory's
// getElementById override. Recreates on each call to avoid DOM build-up. The
// generic lets each call site say what OIPF interface the element is expected
// to expose once the platform/plugin augments it (TypeScript's DOM types have
// no idea an <object type="..."> grows OIPF methods at runtime).
function domObjectAccessor<Ctx>(type: string, id: string): Accessor<Ctx> {
    return function () {
        const existing = document.getElementById(id);
        if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
        }
        const obj = document.createElement('object');
        obj.type = type;
        obj.id = id;
        document.body.appendChild(obj);
        // May return null off-STB: the override swallows instantiation errors.
        return document.getElementById(id) as Ctx | null;
    };
}

export const harness: Harness = {
    register: tree.register,
    INTERFACE: tree.INTERFACE,
    domObjectAccessor: domObjectAccessor,
    init: controller.init,
    fatal: controller.fatal,
    log: logView.append
};
