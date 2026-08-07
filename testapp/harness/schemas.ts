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
 * Zod schemas for the OIPF interfaces the harness/tests rely on. This module
 * is the single source of truth for their shape: src/globals.d.ts imports the
 * z.infer'd types from here and re-declares them as ambient globals (so test
 * files can keep referencing `Channel`, `VideoBroadcast`, etc. without an
 * import), and the schemas themselves are used at runtime to validate that
 * the real, dynamically-loaded/platform-injected library actually matches
 * what globals.d.ts assumes — nothing else can check that.
 *
 * Sections below mirror the harness's own test files (configuration.ts,
 * applicationManager.ts, videoBroadcast.ts, displayInfo.ts) plus the two
 * facades the library exposes as globals (harness/loader.ts).
 */
import { z } from 'zod';

// -----------------------------------------------------------------------------
// Display / onesdk (testapp/tests/displayInfo.ts)
// -----------------------------------------------------------------------------

export const VideoModeSchema = z.object({
    width: z.number(),
    height: z.number(),
    framerate: z.number(),
    colorimetry: z.array(z.string())
});
export type VideoMode = z.infer<typeof VideoModeSchema>;

export const PrimaryDisplaySchema = z.object({
    physicalWidth: z.number(),
    physicalHeight: z.number(),
    videoModes: z.array(VideoModeSchema)
});
export type PrimaryDisplay = z.infer<typeof PrimaryDisplaySchema>;

export const DisplayInfoSchema = z.object({
    edid: z.instanceof(Uint8Array)
});
export type DisplayInfo = z.infer<typeof DisplayInfoSchema>;

export const VersionSchema = z.string().min(1);

export const OneSdkSchema = z.object({
    VERSION: VersionSchema,
    getDisplayInfo: z.function({ input: [], output: z.promise(DisplayInfoSchema) })
});
export type OneSdk = z.infer<typeof OneSdkSchema>;

// -----------------------------------------------------------------------------
// Video Broadcast (testapp/tests/videoBroadcast.ts)
// -----------------------------------------------------------------------------

export const ChannelSchema = z.object({
    ccid: z.string()
});
export type Channel = z.infer<typeof ChannelSchema>;

// Array-like results (e.g. channel/component lists) come back from the OIPF
// interfaces as DOMish collections, not real arrays — length + item(), not
// .map()/.forEach(). item()'s return isn't checked here: invoking it to
// validate would call into the real library, which isn't what a shape check
// should do — so it's typed `unknown` rather than a per-collection generic.
export const OipfCollectionShapeSchema = z.object({
    length: z.number(),
    item: z.function({ input: [z.number()], output: z.unknown() })
});

export const ChannelConfigSchema = z.object({
    channelList: OipfCollectionShapeSchema
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

const PlayStateChangeEventSchema = z.object({
    state: z.number().optional()
});

// OIPF play states: 0 UNREALIZED, 1 CONNECTING, 2 PRESENTING, 3 STOPPED.
export const PlayStateSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const VideoBroadcastSchema = z.object({
    // Spec (OIPF DAE v2.3 §7.13.1.3) declares getChannelConfig() and
    // bindToCurrentChannel() synchronous. The real lib backs them with
    // Firebolt calls, so they're genuinely async here — an intentional
    // platform adaptation, not a spec-conformance bug.
    getChannelConfig: z.function({ input: [], output: z.promise(ChannelConfigSchema.nullable()) }),
    bindToCurrentChannel: z.function({ input: [], output: z.promise(ChannelSchema.nullable().optional()) }),
    setChannel: z.function({ input: [ChannelSchema], output: z.void() }),
    getComponents: z.function({ input: [], output: z.promise(OipfCollectionShapeSchema.nullable().optional()) }),
    selectComponent: z.function({ input: [z.unknown()], output: z.void() }),
    stop: z.function({ input: [], output: z.union([z.void(), z.promise(z.void())]) }),
    currentChannel: ChannelSchema.nullable().optional(),
    playState: PlayStateSchema,
    addEventListener: z
        .function({
            input: [z.string(), z.function({ input: [PlayStateChangeEventSchema], output: z.void() })],
            output: z.void()
        })
        .optional(),
    // Set at runtime by videoBroadcast.js to avoid attaching a duplicate
    // PlayStateChange listener when a cached instance is reopened.
    __playStateLogged: z.boolean().optional()
});
export type VideoBroadcast = z.infer<typeof VideoBroadcastSchema>;

// -----------------------------------------------------------------------------
// Application Manager (testapp/tests/applicationManager.ts)
// -----------------------------------------------------------------------------

export const KeysetSchema = z.object({
    setValue: z.function({ input: [z.number()], output: z.number() })
});
export type Keyset = z.infer<typeof KeysetSchema>;

export const OwnerApplicationSchema = z.object({
    show: z.function({ input: [], output: z.void() }),
    createApplication: z.function({ input: [z.string()], output: z.void() }),
    destroyApplication: z.function({ input: [], output: z.void() }),
    privateData: z.object({
        keyset: KeysetSchema
    })
});
export type OwnerApplication = z.infer<typeof OwnerApplicationSchema>;

export const ApplicationManagerSchema = z.object({
    // Spec (OIPF DAE v2.3 §7.2.1.3): getOwnerApplication(Document document);
    // returns null if the document isn't part of an application.
    getOwnerApplication: z.function({ input: [z.instanceof(Document)], output: OwnerApplicationSchema.nullable() })
});
export type ApplicationManager = z.infer<typeof ApplicationManagerSchema>;

// -----------------------------------------------------------------------------
// Configuration (testapp/tests/configuration.ts)
// -----------------------------------------------------------------------------

export const ConfigurationSchema = z.object({
    configuration: z.unknown()
});
export type Configuration = z.infer<typeof ConfigurationSchema>;

// -----------------------------------------------------------------------------
// Library facades (testapp/harness/loader.ts) — the two globals the real
// library exposes, validated once at startup before any test runs, so a
// malformed injected library surfaces as one clear fatal instead of a pile
// of per-case "not a function" failures.
// -----------------------------------------------------------------------------

export const BbcSchema = z.object({
    oipfApplicationManager: ApplicationManagerSchema,
    videoBroadcast: VideoBroadcastSchema,
    oipfConfiguration: ConfigurationSchema
});
export type Bbc = z.infer<typeof BbcSchema>;

export const OipfObjectFactorySchema = z.object({
    createApplicationManagerObject: z.function({ input: [], output: ApplicationManagerSchema }),
    createVideoBroadcastObject: z.function({ input: [], output: VideoBroadcastSchema }),
    createConfigurationObject: z.function({ input: [], output: ConfigurationSchema }),
    isObjectSupported: z.function({ input: [z.string()], output: z.boolean() })
});
export type OipfObjectFactory = z.infer<typeof OipfObjectFactorySchema>;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Throws a plain Error carrying zod's message, matching the harness
// convention of test cases throwing plain Errors rather than a ZodError.
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, value: unknown, label: string): z.infer<T> {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new Error(label + ': ' + result.error.message);
    }
    return result.data;
}
