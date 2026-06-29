#!/bin/bash
# ============================================================
# Install + enable a systemd service for AI Server Monitor
# (gpu-monitor) so it starts on boot and auto-restarts on crash.
# ------------------------------------------------------------
# This is the zero-dependency alternative to pm2: systemd is
# already present on Ubuntu/Debian, so nothing extra needs to be
# installed. Run it AFTER `npm run build` has produced `.next/`.
#
# Usage (from the repo root, as the user that should own the app):
#   bash scripts/install-systemd.sh
#
# What it does:
#   1. Detects the current user + repo directory.
#   2. Resolves the absolute `node` and `npm` paths (so systemd,
#      which has a minimal PATH, can still launch the app — this
#      is the #1 cause of "service fails to start" when nvm is
#      used).
#   3. Writes /etc/systemd/system/gpu-monitor.service.
#   4. Reloads systemd, enables + starts the service.
#
# To uninstall later:
#   sudo systemctl disable --now gpu-monitor
#   sudo rm /etc/systemd/system/gpu-monitor.service
#   sudo systemctl daemon-reload
# ============================================================
set -euo pipefail

SERVICE_NAME="gpu-monitor"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# --- colors / helpers -------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
say()  { echo -e "${GREEN}[systemd]${NC} $*"; }
warn() { echo -e "${YELLOW}[systemd]${NC} $*"; }
die()  { echo -e "${RED}[systemd]${NC} $*" >&2; exit 1; }

# --- preflight checks -------------------------------------------------
# Must run as a normal user (we sudo the write to /etc/systemd ourselves).
[ "$(id -u)" -eq 0 ] && die "Run this as the app user, NOT root. It will sudo internally where needed."

# Must be inside the repo (package.json + .next present).
[ -f "package.json" ] || die "Run this from the repo root (where package.json lives). Got: $(pwd)"
[ -d ".next" ]        || die "No .next/ build found. Run 'npm run build' first."

REPO_DIR="$(pwd)"
APP_USER="$(whoami)"
APP_GROUP="$(id -gn)"

# Resolve absolute node + npm paths. systemd units run with a minimal PATH,
# so a bare "npm" can fail (especially under nvm). Pin the real paths.
NODE_BIN="$(command -v node)" || die "node not found on PATH."
NPM_BIN="$(command -v npm)"   || die "npm not found on PATH."
NODE_BIN="$(readlink -f "$NODE_BIN")"
NPM_BIN="$(readlink -f "$NPM_BIN")"

# Sanity: Node version meets the repo minimum (>= 18).
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "$NODE_MAJOR" -ge 18 ] || die "Node $(node -v) is too old (need >= 18). Fix before installing the service."

say "Repo:       $REPO_DIR"
say "User:       $APP_USER"
say "Node:       $(node -v) -> $NODE_BIN"
say "npm:        $NPM_BIN"

# --- write the unit file ----------------------------------------------
# Note: we do NOT hardcode port 3001 here because package.json's
# "start" script already passes `-p 3001` to `next start`.
say "Writing $UNIT_FILE ..."
sudo tee "$UNIT_FILE" >/dev/null <<EOF
[Unit]
Description=AI Server Monitor (gpu-monitor)
Documentation=https://github.com/naualex2023/AI_server_dashboard
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_GROUP
WorkingDirectory=$REPO_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=$NPM_BIN run start
Restart=on-failure
RestartSec=5
# Give Next.js a moment to bind port 3001 before systemd considers it started.
TimeoutStartSec=60

[Install]
WantedBy=multi-user.target
EOF

# --- enable + start ---------------------------------------------------
say "Reloading systemd, enabling + starting $SERVICE_NAME ..."
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

# --- verify -----------------------------------------------------------
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    say "✓ $SERVICE_NAME is active (running) and enabled on boot."
else
    warn "Service did not reach 'active' state. Showing status + last logs:"
    systemctl status "$SERVICE_NAME" --no-pager -l || true
    journalctl -u "$SERVICE_NAME" --no-pager -n 30 || true
    die "Install failed. Common causes: wrong ExecStart path (nvm), missing .next build, or port 3001 already in use."
fi

# Confirm port 3001 is actually listening (Next binds from the "start" script).
if ss -ltnp 2>/dev/null | grep -q ':3001'; then
    say "✓ Port 3001 is listening."
else
    warn "Port 3001 not seen yet — the app may still be starting. Check: ss -ltnp | grep :3001"
fi

echo ""
echo "============================================"
echo " systemd install complete!"
echo "============================================"
echo "Service:  $SERVICE_NAME.service"
echo "Autostart: enabled (survives reboot)"
echo ""
echo "Useful commands:"
echo "  systemctl status  $SERVICE_NAME"
echo "  systemctl restart $SERVICE_NAME"
echo "  journalctl -u $SERVICE_NAME -f       # tail logs"
echo "============================================"