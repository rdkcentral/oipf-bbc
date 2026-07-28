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
 * Entry point. Import order below sets menu order (registration order pins
 * top-level categories): interface features first (bbc / Factory / DOM), then
 * the global onesdk category. loader.js runs last — it resolves the library
 * (local bundled copy or platform-injected) and calls harness.init() once every
 * test module above has registered.
 */
import 'harness/harness.css';

import 'tests/configuration.js';
import 'tests/applicationManager.js';
import 'tests/videoBroadcast.js';
import 'tests/displayInfo.js';
import 'tests/factory.js';

import { load } from 'harness/loader.js';

load();
