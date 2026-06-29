#!/usr/bin/env bash
# Installs system dependencies required by the monitoring collectors.
set -euo pipefail

echo "==> Installing lm-sensors and ipmitool..."
sudo apt update
sudo apt install -y lm-sensors ipmitool

echo "==> Detecting sensors (answer Yes to all)..."
sudo sensors-detect --auto 2>/dev/null || true

echo "==> Checking nvidia-smi..."
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "WARNING: nvidia-smi not found. Install NVIDIA drivers."
else
  echo "OK: nvidia-smi present."
fi

echo "==> Configuring passwordless sudo for ipmitool..."
SUDOERS_FILE="/etc/sudoers.d/ipmi-monitor"
WHOAMI="$(whoami)"
echo "$WHOAMI ALL=(root) NOPASSWD: /usr/bin/ipmitool sensor list" | sudo tee "$SUDOERS_FILE" >/dev/null
sudo chmod 0440 "$SUDOERS_FILE"

echo "==> Ensuring user is in 'video' group..."
sudo usermod -aG video "$WHOAMI" || true

echo "==> Done. You may need to re-login for group changes to take effect."
