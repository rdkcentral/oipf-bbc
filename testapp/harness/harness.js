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
 * result, log; controller) and exposes the public window.harness facade.
 *
 * Load order (see index.html): util → log → tree → runner → menuView →
 * resultView → controller → this file → test files → loader. Test groups then
 * self-register via harness.register({ path, accessors, cases }); loader.js calls
 * harness.init() once the library is resolved (local ../dist copy or platform).
 *
 * Everything renders to the screen: a drill-down menu, a results pane, and a log
 * pane that mirrors console.log/error (the target STB browser has no devtools).
 */
window.harness = (function () {
    var tree = window.Harness.createTree();
    var runner = window.Harness.createRunner();
    var logView = window.Harness.createLogView();
    var resultView = window.Harness.createResultView();

    var controller;
    var menuView = window.Harness.createMenuView({
        isLeaf: tree.isLeaf,
        onActivate: function (child) {
            controller.activate(child);
        }
    });
    controller = window.Harness.createController({
        tree: tree,
        runner: runner,
        logView: logView,
        menuView: menuView,
        resultView: resultView
    });

    // Test-authoring helper: returns an accessor (a setup function) that creates a
    // DOM <object> of the given type and resolves it through the factory's
    // getElementById override. Recreates on each call to avoid DOM build-up.
    function domObjectAccessor(type, id) {
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
    }

    return {
        register: tree.register,
        INTERFACE: tree.INTERFACE,
        domObjectAccessor: domObjectAccessor,
        init: controller.init,
        fatal: controller.fatal,
        log: logView.append
    };
})();
