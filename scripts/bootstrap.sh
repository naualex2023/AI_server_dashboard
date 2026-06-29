#!/bin/bash
# ============================================================
# Bootstrap script for AI Server Monitor (gpu-monitor)
# ------------------------------------------------------------
# Run this ONCE on a fresh server to install Node, clone the repo,
# install dependencies, and (optionally) start under pm2.
#
# It is SELF-CONTAINED — it does NOT depend on any file in the repo
# (because the repo is not cloned yet on the first run).
#
# Usage (from a fresh server, no repo present):
#
#   curl -fsSL https://raw.githubusercontent.com/naualex2023/AI_server_dashboard/main/scripts/bootstrap.sh | bash
#
#   ...or after cloning manually:
#   bash scripts/bootstrap.sh
#
# Optional env vars:
#   INSTALL_DIR   where to clone (default: ~/AI_server_dashboard)
#   REPO_URL      git URL (default: https://github.com/naualex2023/AI_server_dashboard)
#   REPO_BRANCH   branch to clone (default: main)
#   USE_PM2       set to "1" to also build + start under pm2
# ============================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-$HOME/AI_server_dashboard}"
REPO_URL="${REPO_URL:-https://github.com/naualex2023/AI_server_dashboard.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
USE_PM2="${USE_PM2:-0}"

# Minimal versions (kept in sync with package.json engines)
MIN_NODE_MAJOR=18

echo "============================================"
echo " AI Server Monitor — first-time bootstrap"
echo "============================================"
echo "Install dir: $INSTALL_DIR"
echo "Repo:        $REPO_URL"
echo "Branch:      $REPO_BRANCH"
echo ""

# ------------------------------------------------------------
# 0. Helpers
# ------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
say()  { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
die()  { echo -e "${RED}[bootstrap]${NC} $*"; exit 1; }

# Compare MAJOR only against the minimum (good enough for bootstrap).
node_major_too_old() {
    local v
    v="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1 || echo 0)"
    [ -z "$v" ] && v=0
    [ "$v" -lt "$MIN_NODE_MAJOR" ]
}

# Ubuntu 22.04 ships an old Node 12 split across several packages whose dev
# headers (e.g. /usr/include/node/common.gypi) conflict with NodeSource's
# self-contained nodejs 20 package. If present, they must be removed FIRST,
# otherwise apt-get install nodejs aborts with:
#   "trying to overwrite '/usr/include/node/common.gypi', which is also in
#    package libnode-dev 12.22.9~dfsg-1ubuntu3.6"
purge_conflicting_ubuntu_node() {
    # Only relevant on Debian/Ubuntu.
    command -v dpkg >/dev/null 2>&1 || return 0

    local conflicts="libnode-dev libnode72 nodejs-doc"
    local installed=""
    local pkg
    for pkg in $conflicts; do
        if dpkg -l "$pkg" 2>/dev/null | grep -q "^ii"; then
            installed="$installed $pkg"
        fi
    done

    if [ -n "$installed" ]; then
        warn "Detected conflicting Ubuntu Node 12 packages:$installed"
        warn "Removing them so NodeSource Node 20 can install cleanly..."
        sudo apt-get remove -y $installed || true
        sudo apt-get autoremove -y || true
    fi
}

ensure_node() {
    if command -v node >/dev/null 2>&1 && ! node_major_too_old; then
        say "Node $(node -v) already satisfies >= v$MIN_NODE_MAJOR."
        return
    fi

    local cur="missing"
    command -v node >/dev/null 2>&1 && cur="$(node -v)"
    warn "Node $cur is too old or missing. Installing Node 20 via NodeSource apt..."

    if ! command -v apt-get >/dev/null 2>&1; then
        die "This bootstrap supports Debian/Ubuntu (apt). On other OSes install Node >= v$MIN_NODE_MAJOR manually, then re-run."
    fi

    # 1) Repair any half-configured apt state left by a previous failed install.
    sudo dpkg --configure -a >/dev/null 2>&1 || true
    sudo apt-get -f install -y >/dev/null 2>&1 || true

    # 2) Remove Ubuntu's bundled Node 12 packages BEFORE adding NodeSource,
    #    so their dev headers don't conflict with NodeSource's nodejs 20.
    purge_conflicting_ubuntu_node

    # 3) NodeSource installer for Node 20.x (system-wide, no nvm needed)
    curl -fsSL "https://deb.nodesource.com/setup_20.x" | sudo -E bash -

    # 4) Try a normal install; if it fails on a file-overwrite conflict,
    #    self-heal by force-overwriting the cached deb, then fix deps.
    if ! sudo apt-get install -y nodejs; then
        warn "apt-get install nodejs failed (likely a file-overwrite conflict). Applying force-overwrite fallback..."
        local deb
        deb="$(ls -t /var/cache/apt/archives/nodejs_*amd64.deb 2>/dev/null | head -1)"
        if [ -z "$deb" ]; then
            die "Could not find the nodejs deb in /var/cache/apt/archives. Install Node >= v$MIN_NODE_MAJOR manually and re-run."
        fi
        sudo dpkg -i --force-overwrite "$deb"
        sudo apt-get -f install -y
    fi

    # 5) Refresh PATH in case node was just installed
    hash -r 2>/dev/null || true

    if ! command -v node >/dev/null 2>&1; then
        die "Node install failed. Install Node >= v$MIN_NODE_MAJOR manually and re-run."
    fi
    say "Node $(node -v) installed."
}

# ------------------------------------------------------------
# 1. Node.js
# ------------------------------------------------------------
say "Step 1/4: Ensure Node.js..."
ensure_node

# ------------------------------------------------------------
# 2. git + clone (only if not already present)
# ------------------------------------------------------------
say "Step 2/4: Clone repository (if not present)..."
command -v git >/dev/null 2>&1 || sudo apt-get install -y git

if [ -d "$INSTALL_DIR/.git" ]; then
    say "Repo already exists at $INSTALL_DIR — leaving as-is."
    say "  (to update later, run: bash $INSTALL_DIR/scripts/update.sh)"
elif [ -d "$INSTALL_DIR" ]; then
    die "$INSTALL_DIR exists but is not a git repo. Move it aside or set INSTALL_DIR, then re-run."
else
    say "Cloning $REPO_URL -> $INSTALL_DIR ..."
    git clone -b "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Make sure ownership is correct (in case of sudo clone)
CURRENT_USER="$(whoami)"
DIR_OWNER="$(stat -c '%U' "$INSTALL_DIR" 2>/dev/null || echo unknown)"
if [ "$DIR_OWNER" != "$CURRENT_USER" ]; then
    warn "Fixing ownership ($DIR_OWNER -> $CURRENT_USER)..."
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$INSTALL_DIR"
fi
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

# ------------------------------------------------------------
# 3. Install dependencies
# ------------------------------------------------------------
say "Step 3/4: Install Node dependencies..."
if [ -f package-lock.json ]; then
    npm ci || npm install
else
    npm install
fi

# ------------------------------------------------------------
# 4. Build + (optional) pm2
# ------------------------------------------------------------
say "Step 4/4: Build..."
npm run build

PM2_APP_NAME="gpu-monitor"
if [ "$USE_PM2" = "1" ]; then
    command -v pm2 >/dev/null 2>&1 || npm install -g pm2
    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    pm2 start npm --name "$PM2_APP_NAME" -- start
    pm2 save 2>/dev/null || true
    say "Started under pm2 as '$PM2_APP_NAME'. (pm2 startup to enable on boot.)"
else
    say "USE_PM2 not set — skipping pm2. Start manually with: npm run start"
fi

echo ""
echo "============================================"
echo " Bootstrap complete!"
echo "============================================"
echo "Directory: $INSTALL_DIR"
echo "Node:      $(node -v)"
echo "Commit:    $(git log --oneline -1)"
echo ""
echo "Next steps:"
echo "  • Dev:       cd $INSTALL_DIR && npm run dev   (http://localhost:3001)"
echo "  • Prod:      cd $INSTALL_DIR && npm run start"
echo "  • Updates:   cd $INSTALL_DIR && bash scripts/update.sh"
echo "============================================"