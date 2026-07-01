# oipf-bbc

A JavaScript library that implements the [OIPF](https://www.oipf.tv/) (Open IPTV Forum) interface on top of [Firebolt](https://rdkcentral.github.io/firebolt/) for RDK-based Set-Top Boxes. It provides a compatibility layer that lets broadcast TV applications written against the OIPF specification run on RDK platforms without modification.

## What it does

The library bridges two APIs:

- **Firebolt** — the underlying RDK platform API (WebSocket JSON-RPC)
- **OIPF** — the standard DOM object model expected by broadcast HbbTV/OIPF applications

It intercepts `document.getElementById` calls for known OIPF object types and returns fully initialised OIPF-compliant objects backed by Firebolt. Applications can also create objects explicitly via the `oipfObjectFactory` or access services directly through the `bbc` and `onesdk` namespaces.

---

## Build

```bash
# Production (minified, console statements stripped)
npm run build

# Development (with debug symbols)
npm run build:lib:dev

# Watch mode
npm run watch
```

Built output lands in `dist/stb/`:

```
dist/stb/
├── oipf-bbc.js     # Minified JS bundle (window-scoped)
└── oipf-bbc.css    # Extracted CSS
```

---

## Usage

### Method 1 — DOM objects (standard OIPF)

The library patches `document.getElementById` so that elements with the recognised OIPF `type` attributes are returned as initialised OIPF objects. This is the standard approach for HbbTV/OIPF applications.

```html
<object id="vb"     type="video/broadcast"></object>
<object id="appMgr" type="application/oipfApplicationManager"></object>
<object id="cfg"    type="application/oipfConfiguration"></object>

<script>
  const vb  = document.getElementById('vb');
  const cfg = document.getElementById('cfg');

  vb.bindToCurrentChannel();

  const channels = vb.getChannelConfig().channelList;
  const lang     = cfg.configuration.preferedAudioLanguage;
</script>
```

### Method 2 — Factory API

```javascript
const vb  = oipfObjectFactory.createVideoBroadcastObject();
const cfg = oipfObjectFactory.createConfigurationObject();
const app = oipfObjectFactory.createApplicationManagerObject();
```

### Method 3 — Namespaces

```javascript
// EDID information (async; resolves with { edid })
onesdk.getDisplayInfo().then(({ edid }) => {
  console.log(edid);
});

// Cached primary display info (size + supported modes)
const display = getPrimaryDisplay();
// Broadcast state
const channel   = bbc.videoBroadcast.currentChannel;
const playState = bbc.videoBroadcast.playState;

// Device configuration
const country = bbc.oipfConfiguration.configuration.countryId;
```

---

## API Reference

### `oipfObjectFactory`

| Method | Returns | Description |
|---|---|---|
| `createVideoBroadcastObject()` | `VideoBroadcast` | Create a video broadcast object |
| `createApplicationManagerObject()` | `ApplicationManager` | Create an application manager object |
| `createConfigurationObject()` | `Configuration` | Create a device configuration object |

---

### `VideoBroadcast`

Corresponds to `<object type="video/broadcast">`.

#### Methods

| Method | Returns | Description |
|---|---|---|
| `bindToCurrentChannel()` | `void` | Tune to the currently active channel |

---

### `ApplicationManager`

Corresponds to `<object type="application/oipfApplicationManager">`.

| Method | Returns | Description |
|---|---|---|
| `getOwnerApplication()` | `Application` | Returns the owner application context |

---

### `Application`

Returned by `ApplicationManager.getOwnerApplication()`. Represents the current application context.

#### Methods

| Method | Returns | Description |
|---|---|---|
| `show()` | `void` | No-op stub (retained for OIPF compatibility) |
| `createApplication(url)` | `void` | Launch a BBC application by URL; resolves the URL to a Firebolt app ID and exits to that app |
| `destroyApplication()` | `void` | Close the current application context (`window.close()`) |

#### Properties

| Property | Type | Description |
|---|---|---|
| `privateData` | `PrivateData` | Access to application-private controls such as the key set |

---

### `PrivateData`

Accessed via `application.privateData`.

#### Properties

| Property | Type | Description |
|---|---|---|
| `keyset` | `KeySet` | Controls which remote-control keys are routed to the application |

---

### `KeySet`

Accessed via `application.privateData.keyset`.

#### Methods

| Method | Returns | Description |
|---|---|---|
| `setValue(mask)` | `number` | Set the active key mask; returns the effective mask after ANDing with the platform master mask. Pass `null` to restore the full master mask. |

```javascript
const app = appMgr.getOwnerApplication();

// Enable only navigation and colour keys
app.privateData.keyset.setValue(0x10 | 0x1 | 0x2 | 0x4 | 0x8);

// Restore all keys permitted by the platform
app.privateData.keyset.setValue(null);
```

The `mask` value is a bitwise OR of one or more of the following constants:

| Constant | Hex | Keys included |
|---|---|---|
| RED | `0x1` | Red colour key |
| GREEN | `0x2` | Green colour key |
| YELLOW | `0x4` | Yellow colour key |
| BLUE | `0x8` | Blue colour key |
| NAVIGATION | `0x10` | Up, Down, Left, Right, Enter, Back |
| MEDIA | `0x20` | Play, Pause, Stop, Fast-forward, Rewind, Play/Pause |
| SCROLL | `0x40` | Page Up, Page Down |
| INFO | `0x80` | Info key |
| NUMERIC | `0x100` | Digits 0–9 |
| ALPHA | `0x200` | All letter keys |
| SPACE | `0x400` | Space key |
| BACKSPACE | `0x800` | Backspace key |
| SEARCH | `0x1000` | Search key |
| SUBTITLE | `0x2000` | Subtitle key |
| TELETEXT | `0x4000` | Teletext key |
| HELP | `0x8000` | Help key |
| CONTEXT | `0x10000` | Context key |
| ALL | `0xFFFFFFFF` | All keys permitted by the platform |

The returned value may differ from the requested mask because it is ANDed with the platform's master key mask — keys the platform has not granted to the application cannot be enabled regardless of the requested value.

---

### `Configuration`

Corresponds to `<object type="application/oipfConfiguration">`.

Accessed via the `configuration` property:

```javascript
const cfg = oipfObjectFactory.createConfigurationObject();
const { preferedAudioLanguage, countryId, subtitlesEnabled } = cfg.configuration;
```

| Property | Type | Description |
|---|---|---|
| `preferedAudioLanguage` | `string` | ISO 639-2 preferred audio language code |
| `preferedSubtitleLanguage` | `string` | ISO 639-2 preferred subtitle language code |
| `countryId` | `string` | ISO 3166-1 alpha-3 country code (e.g. `"GBR"`, `"BEL"`) |
| `subtitlesEnabled` | `boolean` | Whether subtitles are enabled |
| `audioDescriptionEnabled` | `boolean` | Whether audio description is enabled |

---

### `onesdk`

| Symbol | Type | Description |
|---|---|---|
| `getDisplayInfo()` | `Function → Promise<{edid: string}>` | Resolves with `{ edid }` (Base64-encoded EDID string) |
| `VERSION` | `string` | Library version string (includes git hash) |

### `getPrimaryDisplay()`

Returns a cached `DisplayInfo` object (physical size + supported video modes) populated during library initialisation.

### `DisplayInfo`
| Property | Type | Description |
|---|---|---|
| `physicalWidth` | `number` | Display width in centimetres |
| `physicalHeight` | `number` | Display height in centimetres |
| `videoModes` | `Array` | List of supported video modes |

Each `videoMode` entry:

```javascript
{
  width:       number,   // pixels
  height:      number,   // pixels
  framerate:   number,
  colorimetry: string[]  // e.g. ['bt_709', 'bt_2020']
}
```

---

### `bbc`

Direct service access for cases where the DOM object model is not needed.

```javascript
bbc.videoBroadcast.currentChannel
bbc.videoBroadcast.playState
bbc.oipfConfiguration.configuration
bbc.oipfApplicationManager.getOwnerApplication()
```

---

### `OipfError`

All errors thrown by the library use this class.

| Property | Type | Description |
|---|---|---|
| `type` | `number \| string` | Numeric or alphanumeric error ID |
| `printable` | `string` | Human-readable error code |
| `additionalCode` | `string?` | Upstream server error code if available |
| `category` | `string` | `'displayed'`, `'hidden'`, or `'retry'` |

---

## Unit tests

```bash
npm test
```

Uses Mocha + Chai. Test files live under `test/`.

---

## Test application

`testapp/` is an integration harness that exercises every part of the library on a real device. See [testapp/README.md](testapp/README.md) for full details on running the harness, building a Bolt package, and deploying to a device.
