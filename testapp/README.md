# OIPF BBC — Test Application

Integration harness for validating the `oipf-bbc` library on RDK Set-Top Boxes. It provides a navigable menu of test suites that can be run individually or as an automated sequence, with pass/fail reporting and a live log panel.

---

## Test suites

| Suite | What it tests |
|---|---|
| `configuration` | Device configuration context (language, country, subtitle and audio description flags) |
| `applicationManager` | Application lifecycle and owner application |
| `videoBroadcast` | Channel list, tuning, play state, audio/subtitle component selection |
| `displayInfo` | EDID display capabilities and supported video modes |

---

## npm scripts

All commands are run from the repository root.

### Serve locally (development)

```bash
npm run serve:testapp
```

Runs `webpack serve` (the `testapp` config in the root `webpack.config.js`) on **port 8137** by default (override with `PORT`). Open `http://localhost:8137/` in a browser or on the STB. Rebuilds on save and live-reloads the page.

### Build for deployment

```bash
# Standalone — relies on the library being injected by the platform
npm run build:testapp

# Self-contained — embeds the oipf-bbc library (run `npm run build` first)
npm run build:testapp:dev
```

Each runs a production `webpack` build (via `ts-loader`, so a type error fails the build the same way a syntax error would), bundling `testapp/src/index.ts`, its TypeScript dependency graph under `harness/`/`tests/`, and any npm packages they import — producing a minified JS bundle, a CSS file, and `index.html` under `testapp/dist/`. The `:dev` variant additionally copies the built `oipf-bbc` library (`dist/stb/`, so run `npm run build` first) into `testapp/dist/stb/` for a self-contained artifact; the standalone variant relies on the platform to inject the library instead.

### Validate syntax (no browser required)

```bash
npm run validate:testapp
```

Runs the repo's plain-Node build/deploy scripts under `scripts/` through `vm.Script` to catch syntax errors. `testapp/harness` and `testapp/tests` are ES modules now — they're compiled (and so syntax/resolution-checked) by the webpack build itself instead.

---

## Navigating the test harness

The harness is designed for remote-control navigation:

| Key | Action |
|---|---|
| Up / Down | Move between menu items |
| OK | Run selected test or expand a group |
| Back | Go up a level |
| Autorun | Run all tests in the current group sequentially |

Results are shown as **PASS** / **FAIL** with a detailed log for each test step.

---

## Build & Deploy

The `scripts/` directory at the repository root contains two shell scripts for building and deploying a signed Bolt package to an RDK device.

### Prerequisites

| Tool | Required by |
|---|---|
| Node.js + npm | `build-bolt-package.sh` |
| Docker (daemon running) | `build-bolt-package.sh` |
| SSH access to the device as `root` | `deploy-bolt-package.sh` |
| `curl` | `deploy-bolt-package.sh` |

---

### `scripts/build-bolt-package.sh`

Builds the OIPF library and the test app, then packages and signs both into a `.bolt` file ready for deployment.

```bash
./scripts/build-bolt-package.sh <version>
```

**Arguments**

| Argument | Required | Description |
|---|---|---|
| `version` | Yes | Semantic version in `x.y.z` format (e.g. `1.0.0`) |

**What it does — step by step**

| Step | Description |
|---|---|
| 1/4 | Runs `npm run build` to produce `dist/stb/` |
| 2/4 | Runs `npm run build:testapp` to produce `testapp/dist/` |
| 3/4 | Checks for the `oipf-bbc-bolt-builder` Docker image; builds it from `testapp/bolt/Dockerfile` if absent |
| 4/4 | Runs a container that: clones `bolt-engineering-certificates`, assembles the directory layout under `testapp/bolt/dist/`, creates a tarball, stamps the version into the manifest, runs `bolt pack`, and signs the result with `ralfpack` |

**Output**

```
testapp/bolt/dist/
├── com.rdkcentral.oipfBbcTestApp+<version>.bolt
└── com.rdkcentral.oipfBbcTestApp+<version>_signed.bolt   ← deploy this one
```

**Example**

```bash
./scripts/build-bolt-package.sh 1.2.0
```

---

### `scripts/deploy-bolt-package.sh`

Copies, installs, runs, stops, or removes the signed Bolt package on a target RDK device over SSH + JSON-RPC.

```bash
./scripts/deploy-bolt-package.sh <command> <version> [device-ip]
```

**Arguments**

| Argument | Required | Default | Description |
|---|---|---|---|
| `command` | Yes | — | One of `install`, `run`, `stop`, `remove` |
| `version` | Yes | — | Semantic version matching the built package (e.g. `1.0.0`) |
| `device-ip` | No | `192.168.105.28` | IP address of the target RDK device |

**Commands**

| Command | Description |
|---|---|
| `install` | Copies the signed `.bolt` to `/tmp/` on the device via `scp`, then calls `org.rdk.PackageManagerRDKEMS.install` over JSON-RPC. Validates the result by listing installed packages. |
| `run` | Launches the app via `org.rdk.AppManager.launchApp` |
| `stop` | Terminates and kills the app via `org.rdk.AppManager.terminateApp` + `org.rdk.AppManager.killApp` |
| `remove` | Uninstalls the package via `org.rdk.PackageManagerRDKEMS.uninstall` |

All commands first flush `iptables` on the device via SSH.

**Typical workflow**

```bash
# 1. Build the package
./scripts/build-bolt-package.sh 1.0.0

# 2. Install it on the device
./scripts/deploy-bolt-package.sh install 1.0.0 192.168.1.100

# 3. Launch the test app
./scripts/deploy-bolt-package.sh run 1.0.0 192.168.1.100

# 4. Stop the test app
./scripts/deploy-bolt-package.sh stop 1.0.0 192.168.1.100

# 5. Uninstall when done
./scripts/deploy-bolt-package.sh remove 1.0.0 192.168.1.100
```
