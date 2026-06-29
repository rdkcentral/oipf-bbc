#!/usr/bin/env bash
set -euo pipefail


# ─── Arguments ────────────────────────────────────────────────────────────────
COMMAND="${1:-}"
VERSION="${2:-}"
DEVICE_IP="${3:-192.168.105.28}"

usage() {
    echo "Usage: $0 <command> <version> [device-ip]"
    echo "  Commands : install | run | stop | remove"
    echo "  Example  : $0 install 1.0.0 192.168.105.28"
    exit 1
}

if [[ -z "$COMMAND" || -z "$VERSION" ]]; then
    usage
fi

case "$COMMAND" in
    install|run|stop|remove) ;;
    *) echo "Error: Unknown command '$COMMAND'"; usage ;;
esac

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in x.y.z format (got: '$VERSION')"
    exit 1
fi

# ─── Constants ────────────────────────────────────────────────────────────────
APP_ID="com.rdkcentral.oipfBbcTestApp"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$SCRIPT_DIR")"
BOLT_DIR="$WORKSPACE/testapp/bolt/dist"
SIGNED_BOLT="$BOLT_DIR/${APP_ID}+${VERSION}_signed.bolt"
BOLT_PACKAGE_NAME="$(basename "$SIGNED_BOLT")"
JSONRPC_URL="http://${DEVICE_IP}:9998/jsonrpc"

echo ""
echo "==================================================================="
echo "  Bolt Package Manager"
echo "==================================================================="
echo "  Command   : $COMMAND"
echo "  App ID    : $APP_ID"
echo "  Version   : $VERSION"
echo "  Device IP : $DEVICE_IP"
echo "==================================================================="
echo ""

# ─── Helper ───────────────────────────────────────────────────────────────────

jsonrpc() {
    curl -fsS -X POST "$JSONRPC_URL" \
        --header 'Content-Type: application/json' \
        --data "$1"
}

# ─── Common: clear iptables ───────────────────────────────────────────────────
echo "── Clearing iptables on device ──────────────────────────────────────────"
ssh -o StrictHostKeyChecking=no "root@${DEVICE_IP}" "/usr/sbin/iptables -F"
echo "    Done."
echo ""

# ─── Commands ─────────────────────────────────────────────────────────────────

cmd_install() {
    echo "── [1/3] Copying package to device ─────────────────────────────────────"
    if [[ ! -f "$SIGNED_BOLT" ]]; then
        echo "Error: Signed bolt package not found: $SIGNED_BOLT"
        echo "       Build it first with: ./scripts/build-bolt-package.sh $VERSION"
        exit 1
    fi
    scp -O "$SIGNED_BOLT" "root@${DEVICE_IP}:/tmp/"
    echo "    Done."
    echo ""

    echo "── [2/3] Installing package ─────────────────────────────────────────────"
    jsonrpc "{ \"jsonrpc\":\"2.0\", \"id\":501, \"method\":\"org.rdk.PackageManagerRDKEMS.install\", \"params\":{ \"packageId\":\"${APP_ID}\", \"version\":\"${VERSION}\", \"fileLocator\":\"/tmp/${BOLT_PACKAGE_NAME}\" } }"
    sleep 5
    echo ""
    echo "    Done."
    echo ""

    echo "── [3/3] Validating installed packages ──────────────────────────────────"
    jsonrpc '{"jsonrpc":"2.0","id":505,"method":"org.rdk.PackageManagerRDKEMS.listPackages"}'
    sleep 5
    echo ""
}

cmd_run() {
    echo "── [1/1] Launching app ──────────────────────────────────────────────────"
    jsonrpc "{\"jsonrpc\":\"2.0\",\"id\":700,\"method\":\"org.rdk.AppManager.launchApp\",\"params\":{\"appId\":\"${APP_ID}\",\"intent\":\"{\\\"action\\\":\\\"launch\\\",\\\"context\\\":{\\\"source\\\":\\\"manual\\\"}}\",\"launchArgs\":\"{}\"}}"
    sleep 5
    echo ""
    echo "    Done."
    echo ""
}

cmd_stop() {
    echo "── [1/2] Terminating app ────────────────────────────────────────────────"
    jsonrpc "{\"jsonrpc\":\"2.0\",\"id\":700,\"method\":\"org.rdk.AppManager.terminateApp\",\"params\":{\"appId\":\"${APP_ID}\"}}"
    sleep 5
    echo ""
    echo "    Done."
    echo ""

    echo "── [2/2] Killing app ────────────────────────────────────────────────────"
    jsonrpc "{\"jsonrpc\":\"2.0\",\"id\":700,\"method\":\"org.rdk.AppManager.killApp\",\"params\":{\"appId\":\"${APP_ID}\"}}"
    sleep 5
    echo ""
    echo "    Done."
    echo ""
}

cmd_remove() {
    echo "── [1/1] Uninstalling package ───────────────────────────────────────────"
    jsonrpc "{ \"jsonrpc\":\"2.0\", \"id\":501, \"method\":\"org.rdk.PackageManagerRDKEMS.uninstall\", \"params\":{ \"packageId\":\"${APP_ID}\", \"version\":\"${VERSION}\" } }"
    sleep 5
    echo ""
    echo "    Done."
    echo ""
}

# ─── Dispatch ─────────────────────────────────────────────────────────────────
case "$COMMAND" in
    install) cmd_install ;;
    run)     cmd_run ;;
    stop)    cmd_stop ;;
    remove)  cmd_remove ;;
esac

echo "==================================================================="
echo "  $COMMAND complete"
echo "==================================================================="
