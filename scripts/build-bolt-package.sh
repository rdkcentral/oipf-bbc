#!/usr/bin/env bash
set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────
APP_ID="com.rdkcentral.oipfBbcTestApp"
DOCKER_IMAGE="oipf-bbc-bolt-builder"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$SCRIPT_DIR")"

# ─── Version argument ─────────────────────────────────────────────────────────
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    echo "  Example: $0 1.0.0"
    exit 1
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in x.y.z format (got: '$VERSION')"
    exit 1
fi

# ─── Preflight ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "Error: Node.js is not installed or not in PATH."
    echo "  Install it from https://nodejs.org or via a version manager (nvm, fnm)."
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo "Error: npm is not installed or not in PATH."
    echo "  npm is bundled with Node.js — reinstalling Node should fix this."
    exit 1
fi

if ! command -v docker &>/dev/null; then
    echo "Error: Docker is not installed or not in PATH."
    echo "  Install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info &>/dev/null; then
    echo "Error: Docker is installed but the daemon is not running."
    echo "  Start Docker and try again."
    exit 1
fi

echo ""
echo "==================================================================="
echo "  Build Bolt Package"
echo "==================================================================="
echo "  App ID    : $APP_ID"
echo "  Version   : $VERSION"
echo "  Workspace : $WORKSPACE"
echo "==================================================================="
echo ""

# ─── Step 1: Build OIPF Library ───────────────────────────────────────────────
echo "── [1/4] Building OIPF library (npm run build) ──────────────────────────"
cd "$WORKSPACE"
npm run build
echo "    Done — output: dist/stb/"
echo ""

# ─── Step 2: Build Test Application ───────────────────────────────────────────
echo "── [2/4] Building Test Application (npm run build:testapp) ─────────────"
npm run build:testapp
echo "    Done — output: testapp/dist/"
echo ""

# ─── Step 3: Docker image ─────────────────────────────────────────────────────
echo "── [3/4] Checking Docker image ──────────────────────────────────────────"
if docker image inspect "$DOCKER_IMAGE" &>/dev/null; then
    echo "    Image '$DOCKER_IMAGE' already exists — skipping build."
else
    echo "    Image '$DOCKER_IMAGE' not found — building from testapp/bolt/Dockerfile ..."
    docker build \
        --tag "$DOCKER_IMAGE" \
        --file "$WORKSPACE/testapp/bolt/Dockerfile" \
        "$WORKSPACE/testapp/bolt"
    echo "    Image '$DOCKER_IMAGE' built successfully."
fi
echo ""

# ─── Step 4: Package inside container ─────────────────────────────────────────
echo "── [4/4] Packaging inside container ─────────────────────────────────────"
echo "    Mounting $WORKSPACE → /workspace"
echo "    Output  : testapp/bolt/dist/"
echo ""

docker run --rm \
    --user root \
    -i \
    -v "$WORKSPACE:/workspace" \
    -e APP_ID="$APP_ID" \
    -e VERSION="$VERSION" \
    "$DOCKER_IMAGE" \
    bash -euo pipefail << 'CONTAINER_SCRIPT'

CERTS_DIR="$HOME/bolt-engineering-certificates"
BOLT_DIR="/workspace/testapp/bolt/dist"
APP_SHARE_DIR="$BOLT_DIR/usr/share/$APP_ID"
MANIFEST_SRC="/workspace/testapp/bolt/${APP_ID}.json"
MANIFEST_COPY="$BOLT_DIR/${APP_ID}.json"
TARBALL="$BOLT_DIR/${APP_ID}.tgz"

# ── 4.1 Clone bolt-engineering-certificates ──────────────────────────────────
echo "    [4.1] Cloning bolt-engineering-certificates ..."
if [ -d "$CERTS_DIR/.git" ]; then
    git -C "$CERTS_DIR" pull --quiet
    echo "          Already cloned — pulled latest."
else
    git clone --depth=1 \
        https://github.com/rdkcentral/bolt-engineering-certificates \
        "$CERTS_DIR"
fi
echo "          Certificates ready at: $CERTS_DIR"

# ── 4.2 Create testapp/bolt/dist directory structure ───────────────────────
echo "    [4.2] Creating testapp/bolt/dist directory structure ..."
rm -rf "$BOLT_DIR"
mkdir -p "$APP_SHARE_DIR"
echo "          Created : $APP_SHARE_DIR"

# ── 4.3 Copy OIPF library files (dist/stb/*) ─────────────────────────────────
echo "    [4.3] Copying OIPF library (dist/stb/*) ..."
cp -r /workspace/dist/stb/. "$APP_SHARE_DIR/"
echo "          Done."

# ── 4.4 Copy Test App files (testapp/dist/*) ─────────────────────────────────
echo "    [4.4] Copying Test App (testapp/dist/*) ..."
cp -r /workspace/testapp/dist/. "$APP_SHARE_DIR/"
echo "          Done."

echo "          Contents of $APP_SHARE_DIR:"
ls -1 "$APP_SHARE_DIR" | sed 's/^/            /'

# ── 4.5 Create tarball of usr/ ───────────────────────────────────────────────
echo "    [4.5] Creating tarball of usr/ ..."
tar -czf "$TARBALL" -C "$BOLT_DIR" usr
echo "          Tarball: $TARBALL"

# ── 4.6 Prepare versioned manifest ───────────────────────────────────────────
echo "    [4.6] Preparing manifest with version $VERSION ..."
python3 - << PYEOF
import json
with open('$MANIFEST_SRC') as f:
    manifest = json.load(f)
manifest['version'] = '$VERSION'
with open('$MANIFEST_COPY', 'w') as f:
    json.dump(manifest, f, indent=2)
PYEOF
echo "          Manifest written to: $MANIFEST_COPY"

# ── 4.7 bolt pack ─────────────────────────────────────────────────────────────
echo "    [4.7] Running bolt pack ..."
cd "$BOLT_DIR"
bolt pack "$MANIFEST_COPY" "$TARBALL"
echo "          Pack done."

BOLT_FILE=$(ls "$BOLT_DIR"/*.bolt 2>/dev/null | grep -v '_signed' | head -1)
if [ -z "$BOLT_FILE" ]; then
    echo "ERROR: No .bolt file found in $BOLT_DIR after bolt pack."
    echo "       Directory listing:"
    ls -la "$BOLT_DIR"
    exit 1
fi
echo "          Generated package: $BOLT_FILE"

# ── 4.8 Copy to _signed variant ───────────────────────────────────────────────
echo "    [4.8] Copying to _signed variant ..."
SIGNED_BOLT="${BOLT_FILE%.bolt}_signed.bolt"
cp "$BOLT_FILE" "$SIGNED_BOLT"
echo "          Signed copy: $SIGNED_BOLT"

# ── 4.9 Sign with ralfpack ────────────────────────────────────────────────────
echo "    [4.9] Signing with ralfpack ..."
ralfpack sign \
    --pkcs12="$CERTS_DIR/certs/com.rdkcentral.ralf.p12" \
    --passphrase="RDKMRalf" \
    "$SIGNED_BOLT"
echo "          Signed: $SIGNED_BOLT"

CONTAINER_SCRIPT

echo ""
echo "==================================================================="
echo "  Build complete"
echo "  Output: $WORKSPACE/testapp/bolt/dist/"
ls -lh "$WORKSPACE/testapp/bolt/dist/"*.bolt 2>/dev/null | sed 's/^/    /' || echo "    (no .bolt files found)"
echo "==================================================================="
