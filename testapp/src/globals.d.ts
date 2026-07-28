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
 * These are hand-maintained assumptions about the real library's shape, kept
 * deliberately minimal (only what the harness/tests actually use) — the same
 * trust level as the manual duck-typing checks this replaces. TypeScript
 * verifies testapp's own code is internally consistent; it can't verify these
 * declarations against the real runtime library.
 */

interface Channel {
    ccid: string;
}

interface VideoMode {
    width: number;
    height: number;
    framerate: number;
    colorimetry: string[];
}

interface PrimaryDisplay {
    physicalWidth: number;
    physicalHeight: number;
    videoModes: VideoMode[];
}

interface DisplayInfo {
    edid: string;
}

interface OneSdk {
    VERSION: string;
    getDisplayInfo(): Promise<DisplayInfo>;
}

// Array-like results (e.g. channel lists, component lists) come back from the
// OIPF interfaces as DOMish collections, not real arrays — length + item(),
// not .map()/.forEach(). See videoBroadcast.js's isArrayLike().
interface OipfCollection<T> {
    readonly length: number;
    item(index: number): T;
}

interface ChannelConfig {
    channelList: OipfCollection<Channel>;
}

interface VideoBroadcast {
    // Spec (OIPF DAE v2.3 §7.13.1.3) declares getChannelConfig() and
    // bindToCurrentChannel() synchronous. The real lib backs them with
    // Firebolt calls, so they're genuinely async here — an intentional
    // platform adaptation, not a spec-conformance bug.
    getChannelConfig(): Promise<ChannelConfig | null>;
    bindToCurrentChannel(): Promise<Channel | null | undefined>;
    setChannel(channel: Channel): void;
    getComponents(): Promise<OipfCollection<unknown> | null | undefined>;
    selectComponent(component: unknown): void;
    stop(): void | Promise<void>;
    readonly currentChannel: Channel | null | undefined;
    readonly playState: number;
    addEventListener?(type: string, listener: (event: { state?: number }) => void): void;
    // Set at runtime by videoBroadcast.js to avoid attaching a duplicate
    // PlayStateChange listener when a cached instance is reopened.
    __playStateLogged?: boolean;
}

interface Keyset {
    setValue(mask: number): number;
}

interface OwnerApplication {
    show(): void;
    createApplication(url: string): void;
    destroyApplication(): void;
    privateData: {
        keyset: Keyset;
    };
}

interface ApplicationManager {
    getOwnerApplication(document: Document): OwnerApplication | null;
}

interface Configuration {
    configuration: unknown;
}

declare const bbc: {
    oipfApplicationManager: ApplicationManager;
    videoBroadcast: VideoBroadcast;
    oipfConfiguration: Configuration;
};

declare const oipfObjectFactory: {
    createApplicationManagerObject(): ApplicationManager;
    createVideoBroadcastObject(): VideoBroadcast;
    createConfigurationObject(): Configuration;
    isObjectSupported(mimeType: string): boolean;
};

declare const onesdk: OneSdk;

declare function getPrimaryDisplay(): PrimaryDisplay;

interface Window {
    oipfObjectFactory?: typeof oipfObjectFactory;
    onesdk?: OneSdk;
}

// The library's OipfError (and similar) attach a human-readable `detail` to
// thrown/rejected errors — see util.js's pretty().
interface Error {
    detail?: string;
}

declare module '*.css';
