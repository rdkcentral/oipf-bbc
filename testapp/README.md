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

Starts a local HTTP server on **port 8137** by default (override with `PORT`). Open `http://localhost:8137/testapp/` in a browser or on the STB.

### Build for deployment

```bash
# Standalone — relies on the library being injected by the platform
npm run build:testapp

# Self-contained — embeds the oipf-bbc library (run `npm run build` first)
npm run build:testapp:dev
```

Both commands produce a minified JS bundle and a CSS file under `testapp/dist/`.

### Validate syntax (no browser required)

```bash
npm run validate:testapp
```

Runs all testapp JavaScript through Node's `vm.Script` to catch syntax errors before deployment.

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
| `install` | Copies the signed `.bolt` to `/tmp/` on the device via `scp`, then calls `PackageManagerRDKEMS.install` over JSON-RPC. Validates the result by listing installed packages. |
| `run` | Launches the app via `AppManager.launchApp` |
| `stop` | Terminates and kills the app via `AppManager.terminateApp` + `AppManager.killApp` |
| `remove` | Uninstalls the package via `PackageManagerRDKEMS.uninstall` |

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
