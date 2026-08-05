# STB Remote Control

A small web UI tool geneated with Claude for controlling an RDK set-top box over its
Thunder JSON-RPC endpoint (`:9998/jsonrpc`). It lets you:

1. See installed/loaded applications, their bolt package version and
   lifecycle status
2. Launch or uninstall applications
3. Set or remove focus on running applications
4. Inject remote-control key presses (D-pad, OK, numbers, Back, Home,
   Red/Green/Yellow/Blue) through an on-screen RC that looks like a
   Horizon / Virgin Media Stream remote
5. Reboot the device from a power button on the on-screen remote (visible
   once connected)

It talks to these plugins:

| Plugin | Methods used |
| --- | --- |
| `org.rdk.AppManager` | `getInstalledApps`, `getLoadedApps`, `launchApp`, `closeApp`, `terminateApp`, `killApp` |
| `org.rdk.PackageManagerRDKEMS` (default) or `org.rdk.AppPackageManager` | `listPackages`, `uninstall` |
| `org.rdk.RDKWindowManager` | `setFocus`, `injectKey` |
| `org.rdk.PowerManager` | `reboot` |

Firmware versions differ on which plugin name exposes package management:
older builds use `org.rdk.PackageManagerRDKEMS` (the default here), newer
ones renamed it to `org.rdk.AppPackageManager`. Pick which one to use from
the **Package plugin** dropdown in the top right of the header — both
expose the same `listPackages`/`uninstall` methods. Switching it while
connected re-fetches the app list. The Applications hint text always shows
which one is active.

See [`apis/AppManager/IAppManager.h`](../../apis/AppManager/IAppManager.h) and
[`apis/RDKWindowManager/IRDKWindowManager.h`](../../apis/RDKWindowManager/IRDKWindowManager.h)
for the full interface definitions.

## Why there's a server.js

The STB is normally on a different IP than the machine running the browser,
and Thunder's JSON-RPC endpoint doesn't send CORS headers — so a browser
calling it directly from a page on another origin gets blocked.

`server.js` is a tiny dependency-free Node proxy: it serves `index.html` and
forwards `POST /rpc` calls to the STB's `/jsonrpc` endpoint server-side (a
plain HTTP call is not subject to CORS). The browser only ever talks to
`localhost`, so no CORS issue arises regardless of which IP the box is on.

## Running it

```bash
node server.js            # starts on http://localhost:8777
node server.js 9000        # or pick a different local port
```

Then open the printed URL (e.g. `http://localhost:8777`) in a browser.

## Using the Remote Control

1. **Host / Port** — enter the STB's IP in **Host**, e.g. `192.168.1.50`.
   **Port** defaults to `9998` (Thunder's default) so you don't need to
   re-type it every time; change it only if your device listens elsewhere.
2. **Token** (optional) — if your device requires a SecurityAgent bearer
   token for JSON-RPC calls, paste it here; it's sent as
   `Authorization: Bearer <token>`. The **Package plugin** dropdown in the
   top right picks between `PackageManagerRDKEMS` and `AppPackageManager`
   (see above).
3. Click **Connect** to reach the device and load its app list; use
   **Refresh** afterwards to re-poll without re-typing anything (or check
   **auto** to poll every 4s). Both buttons do the same fetch — they're
   just split so refreshing doesn't read as "reconnecting". Once connected,
   **Connect** turns into **Disconnect**, which resets the panel back to
   its initial state.
4. **Applications** — each row shows the app, its bolt package **version**
   (from `listPackages`), instance ID (if running) and lifecycle state,
   with buttons for Launch / Focus / Close / Terminate / Kill as applicable,
   plus **Uninstall** (shown once per app and asks for confirmation; if no
   version was reported it shows an alert instead of calling uninstall,
   since the package plugin's `uninstall` method requires one).
5. **Remote Control** — pick a running app in the focus dropdown (or
   use **Set Focus** / **Remove Focus**), then press the on-screen remote.
   Key presses are injected via `injectKey`, which is applied to whichever
   app currently has focus — so focus the target app first. Physical
   keyboard arrows, digits, Enter, Backspace and Escape also drive the
   remote. **Back** (↩) sends keycode `8` and **Esc** (⎋) sends keycode
   `27` as separate buttons, since different apps listen for either one
   as "back". A **⏻** power button sits in the top-right corner of the
   remote and appears once the status dot turns green; it asks for
   confirmation, then calls `org.rdk.PowerManager.reboot`.
6. **JSON-RPC Log** — every request/response (and any errors) is shown at
   the bottom for debugging.

## Notes

- Key codes are defined in the `KEYMAP` constant near the top of the
  `<script>` block in `index.html`. They use common RDK/CEA codes (arrows
  37–40, OK 13, Back/Backspace 8, Escape 27, Home 36, digits 48–57,
  colour keys 403–406). If your platform maps keys differently, edit that
  object — the log panel shows exactly which code was sent on every press.
- Nothing is persisted; host/port/token are only kept in the page for the
  current session.
