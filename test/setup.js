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

/**
 * Global test setup for mocha. Polyfills the browser globals that the source
 * code under test references at module-load or call time.
 */

// Several lib/oipf modules reference `window` at module-load time (e.g.
// VideoBroadcast.js reads window.innerWidth/innerHeight), so a default must
// exist before any lib module is required. Individual tests override
// properties (including window.FireboltServiceManager) as needed.
global.window = global.window || {};
