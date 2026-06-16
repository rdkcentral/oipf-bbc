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

import { getDisplaySize, getDisplayVideoResolutions, getDisplayColorimetry } from 'util/display';

const DisplayInfo = {
    physicalWidth: 0,
    physicalHeight: 0,
    videoModes: []
};

// Firebolt reports colorimetry as `bt709` / `bt2020` (matching HDMI/CTA-861
// and HEVC VUI conventions). BBC OIPF consumers expect the underscored form.
const COLORIMETRY_FIREBOLT_TO_OIPF = {
    bt709: 'bt_709',
    bt2020: 'bt_2020'
};

function mapColorimetry(values) {
    return values.reduce((acc, value) => {
        const mapped = COLORIMETRY_FIREBOLT_TO_OIPF[value];
        if (mapped) acc.push(mapped);
        else console.warn(`displayService: ignoring unrecognised colorimetry "${value}"`);
        return acc;
    }, []);
}

// Standard digital widths for the SD (non-16:9) heights Firebolt can report.
// CEA-861 defines both NTSC 480-line and PAL 576-line SD formats as 720 wide,
// so they can't be derived from the 16:9 formula below.
const SD_HEIGHT_TO_WIDTH = {
    480: 720,
    576: 720
};

/**
 * Resolves a `<height>` token to a `{ width, height }` pair.
 * SD heights (480/576) use their standard 720-wide digital dimensions; all
 * other heights are assumed 16:9 (the CEA-861 default for HD/UHD formats —
 * both progressive and interlaced).
 * Returns null if the height is neither a known SD height nor yields an
 * integer 16:9 width — that catches non-16:9 / typo heights without silently
 * producing fractional dimensions.
 *
 * Typical inputs and their derived dimensions:
 *   480  → 720×480    (SD, NTSC)
 *   576  → 720×576    (SD, PAL)
 *   720  → 1280×720   (HD)
 *   1080 → 1920×1080  (Full HD)
 *   2160 → 3840×2160  (4K UHD)
 */
function dimensionsForHeight(heightStr) {
    const height = Number(heightStr);
    if (!Number.isFinite(height) || height <= 0) return null;

    if (SD_HEIGHT_TO_WIDTH[height]) {
        return { width: SD_HEIGHT_TO_WIDTH[height], height };
    }

    const width = (height * 16) / 9;
    if (!Number.isInteger(width)) return null;

    return { width, height };
}

/**
 * Parses a Firebolt `Display.videoResolutions` entry into width/height/framerate.
 *
 * @param {string} resolution - A resolution string in `<height>[p|i]<framerate>`
 *   form, as returned by Firebolt `Display.videoResolutions`. SD heights use
 *   their standard 720-wide dimensions; other heights derive width from a 16:9
 *   assumption.
 *   Examples:
 *     - '480p60'   → { width: 720,  height: 480,  framerate: 60 }
 *     - '720p50'   → { width: 1280, height: 720,  framerate: 50 }
 *     - '1080i60'  → { width: 1920, height: 1080, framerate: 60 }
 *     - '2160p50'  → { width: 3840, height: 2160, framerate: 50 }
 *
 * @returns {{width: number, height: number, framerate: number}|null} the parsed
 *   mode, or null if `resolution` doesn't match the `<height>[p|i]<framerate>`
 *   pattern or no width can be derived for the height. Bad entries are skipped
 *   by the caller rather than aborting the whole list.
 */
function parseVideoResolution(resolution) {
    const match = /^(\d+)[pi](\d+)$/.exec(resolution);
    if (!match) {
        console.warn(`displayService: ignoring unrecognised videoResolution "${resolution}"`);
        return null;
    }

    const dims = dimensionsForHeight(match[1]);
    if (!dims) {
        console.warn(`displayService: cannot derive width for videoResolution "${resolution}"`);
        return null;
    }

    return {
        width: dims.width,
        height: dims.height,
        framerate: Number(match[2])
    };
}

async function loadSize() {
    try {
        const size = await getDisplaySize();
        DisplayInfo.physicalWidth = size.width;
        DisplayInfo.physicalHeight = size.height;
    } catch (e) {
        console.error('error fetching physical screen size', e);
    }
}

async function loadVideoModes() {
    try {
        const [resolutions, colorimetry] = await Promise.all([getDisplayVideoResolutions(), getDisplayColorimetry()]);
        const oipfColorimetry = mapColorimetry(colorimetry);
        DisplayInfo.videoModes = resolutions
            .map(parseVideoResolution)
            .filter(Boolean)
            .map(mode => ({
                ...mode,
                colorimetry: oipfColorimetry.slice()
            }));
    } catch (e) {
        console.error('error fetching supported resolutions', e);
    }
}

export async function init() {
    await Promise.all([loadSize(), loadVideoModes()]);
}

export function getPrimaryDisplay() {
    return DisplayInfo;
}
