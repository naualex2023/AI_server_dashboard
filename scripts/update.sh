#!/bin/bash
# ============================================================
# Update script for AI Server Monitor (gpu-monitor)
# Pulls latest changes from GitHub, checks Node version,
# reinstalls dependencies, and (if running under pm2) rebuilds
# and restarts the production app.
#
# Run:  bash scripts/update.sh
# ============================================================
set -euo pipefail

echo "============================================"
echo " AI Server Monitor (gpu-monitor) Update"
echo "============================================"

# Work from project root (detect from script location)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ---------------------
# 0. Fix ownership + git safe.directory
# ---------------------
CURRENT_USER="$(whoami)"
DIR_OWNER="$(stat -c '%U' "$PROJECT_DIR" 2>/dev/null || echo unknown)"
if [ "$DIR_OWNER" != "$CURRENT_USER" ]; then
    echo "Fixing directory ownership (currently owned by $DIR_OWNER)..."
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_DIR"
    echo "Ownership fixed."
fi

# Avoid "detected dubious ownership" with git
git config --global --add safe.directory "$PROJECT_DIR" 2>/dev/null || true

echo "Project directory: $PROJECT_DIR"
echo ""

# ---------------------
# 1. Node.js version check (fails fast with clear instructions)
# ---------------------
echo "[1/4] Checking Node.js version..."

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is not installed (or not on PATH)."
    echo "       Next.js 14 requires Node >= 18.17.0."
    echo "       Install it (no nvm needed):"
    echo "         curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "         sudo apt-get install -y nodejs"
    exit 1
fi

# check-node.mjs is written in ES5 so it parses even on old Node and prints
# the right install instructions (nvm vs apt) when the version is too old.
node scripts/check-node.mjs
echo "Node $(node -v) OK."
echo ""

# ---------------------
# 2. Pull latest changes from GitHub
# ---------------------
echo "[2/4] Pulling latest changes..."

# Refresh GitHub CLI auth if it expired (git would also reject the pull)
if command -v gh >/dev/null 2>&1; then
    if ! gh auth status >/dev/null 2>&1; then
        echo "GitHub authentication expired. Re-authenticating..."
        echo "A code will be displayed — open the URL in a browser on any device and enter it."
        gh auth login --hostname github.com --git-protocol https --web
    else
        echo "GitHub auth OK."
    fi
fi

echo "Current branch: $(git branch --show-current)"
echo "Current commit: $(git log --oneline -1)"
echo ""

# Stash local changes (e.g. .env.local tweaks) before pulling
STASHED=false
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    echo "Local changes detected — stashing..."
    git stash push -m "auto-stash before update $(date +%Y%m%d-%H%M%S)"
    STASHED=true
fi

git pull origin "$(git branch --show-current)"
echo "Updated to: $(git log --oneline -1)"

if [ "$STASHED" = true ]; then
    echo "Restoring local changes..."
    git stash pop || echo "NOTE: stash pop had conflicts — run 'git stash list' to inspect."
fi

echo ""

# ---------------------
# 3. Install / update Node dependencies
# ---------------------
echo "[3/4] Updating Node dependencies..."

if [ ! -f package.json ]; then
    echo "ERROR: package.json not found in $PROJECT_DIR"
    exit 1
fi

# Prefer npm ci (reproducible from lockfile) when possible; fall back to install.
if [ -f package-lock.json ]; then
    npm ci || npm install
else
    npm install
fi

echo ""

# ---------------------
# 4. Production: rebuild + restart pm2 (only if pm2 manages this app)
# ---------------------
echo "[4/4] Checking production process manager..."

PM2_APP_NAME="gpu-monitor"
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    echo "pm2 process '$PM2_APP_NAME' detected — rebuilding and restarting..."
    npm run build
    pm2 restart "$PM2_APP_NAME" --update-env
    pm2 save
    echo "pm2 app restarted."
else
    echo "Not running under pm2 (app '$PM2_APP_NAME' not found). Skipping rebuild."
    echo "  • For development:  npm run dev   (http://localhost:3001)"
    echo "  • For production:   npm run build && npm run start"
    echo "  • With pm2:         npm run build && pm2 start npm --name \"$PM2_APP_NAME\" -- start"
fi

echo ""
echo "============================================"
echo " Update Complete!"
echo "============================================"
echo "Commit:   $(git log --oneline -1)"
echo "Branch:   $(git branch --show-current)"
echo "Node:     $(node -v)"
echo "============================================"