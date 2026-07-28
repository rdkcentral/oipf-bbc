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
 * Ambient types for the oipf-bbc library's runtime-injected surface. The
 * library is never statically imported (see harness/loader.js) — it's either a
 * dynamically-loaded local build or a platform-injected global — so these
 * declarations are the only thing telling TypeScript that `bbc`,
 * `oipfObjectFactory`, `onesdk`, and `getPrimaryDisplay` exist at all.
 *
 * The shapes themselves are defined once, in harness/schemas.ts, as Zod
 * schemas — that's the single source of truth. This file just imports the
 * z.infer'd types and re-declares them as globals, so every test file can
 * keep referencing `Channel`, `VideoBroadcast`, etc. without an import. The
 * schemas.ts versions are still hand-maintained assumptions about the real
 * library's shape (the same trust level as the manual duck-typing checks
 * they replaced) — TypeScript verifies testapp's own code is internally
 * consistent with them; the Zod schemas are what verifies the real runtime
 * library actually matches, since nothing else can.
 *
 * Importing here turns this file into a module (it has a top-level import),
 * so the declarations below live inside `declare global` rather than being
 * bare top-level ambient declarations — otherwise they'd only be visible
 * within this file.
 */
import type {
    ApplicationManager as ApplicationManagerType,
    Bbc as BbcType,
    Channel as ChannelType,
    ChannelConfig as ChannelConfigType,
    Configuration as ConfigurationType,
    DisplayInfo as DisplayInfoType,
    OipfObjectFactory as OipfObjectFactoryType,
    OneSdk as OneSdkType,
    OwnerApplication as OwnerApplicationType,
    PrimaryDisplay as PrimaryDisplayType,
    VideoBroadcast as VideoBroadcastType,
    VideoMode as VideoModeType
} from 'harness/schemas';

declare global {
    type Channel = ChannelType;
    type VideoMode = VideoModeType;
    type PrimaryDisplay = PrimaryDisplayType;
    type DisplayInfo = DisplayInfoType;
    type OneSdk = OneSdkType;
    type ChannelConfig = ChannelConfigType;
    type VideoBroadcast = VideoBroadcastType;
    type OwnerApplication = OwnerApplicationType;
    type ApplicationManager = ApplicationManagerType;
    type Configuration = ConfigurationType;
    type Bbc = BbcType;
    type OipfObjectFactory = OipfObjectFactoryType;

    const bbc: Bbc;

    const oipfObjectFactory: OipfObjectFactory;

    const onesdk: OneSdk;

    function getPrimaryDisplay(): PrimaryDisplay;

    interface Window {
        oipfObjectFactory?: OipfObjectFactory;
        onesdk?: OneSdk;
    }

    // The library's OipfError (and similar) attach a human-readable `detail`
    // to thrown/rejected errors — see util.js's pretty().
    interface Error {
        detail?: string;
    }
}

declare module '*.css';
