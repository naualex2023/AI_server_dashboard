# AI Server Monitor — GPU/CPU Monitoring Dashboard

A real-time web dashboard that consolidates **4× Tesla P40 GPU + CPU + fan** monitoring into a single page on **port 3001**, replacing `watch nvidia-smi`, `watch watch_rpm.sh`, and `watch sensors`.

Built with **Next.js 14 (App Router)**, **Tailwind CSS**, **Recharts**, and **Server-Sent Events (SSE)**.

## Features

- **GPU cards** — temperature, utilization, VRAM, power, with a live mini temp-chart per card and OK/WARN/CRIT status badges.
- **CPU panel** — per-core temperatures + package temp history line chart (via `sensors -j`).
- **Fan panel** — RPM bars with slow/normal color coding (via `ipmitool`).
- **Power summary** — total draw vs. limit, per-GPU bar chart.
- **History charts** — multi-GPU temperature & utilization trends, VRAM usage, power draw.
- **Resilient collectors** — if a tool (`nvidia-smi`, `sensors`, `ipmitool`) is unavailable, the dashboard keeps running and shows empty states.

## Node.js version requirement

**Next.js 14 requires Node.js ≥ 18.17.0.** Running it on an older Node
(12/14/16, which is the default on Ubuntu 20.04/22.04 servers) fails with:

```
SyntaxError: Unexpected token '?'
    at wrapSafe (internal/modules/cjs/loader.js:915:16)
```

because those Node versions predate optional chaining (`?.`)/nullish coalescing
(`??`) used in Next.js's compiled output. A guard (`npm run check-node`) runs
automatically before `dev`/`build`/`start` and will print the fix instructions
below if the Node version is too old.

### Install a modern Node — pick ONE

**Option A — NodeSource apt (system-wide, recommended for servers without nvm):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

**Option B — nvm (per-user):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# close & reopen the terminal (or: source ~/.bashrc), then:
nvm install 20
nvm use 20
```

After installing, continue with Quick start.

## Quick start

```bash
# 1. Install Node deps
npm install

# 2. (One-time) install system monitoring tools on the server
bash scripts/setup.sh

# 3. Develop
npm run dev        # http://localhost:3001

# 4. Production
npm run build
npm run start      # http://localhost:3001
```

## Architecture

```
nvidia-smi / sensors -j / ipmitool
        │
        ▼
 collectors (gpu.ts, cpu.ts, fans.ts)
        │
        ▼
 /api/stream  ──SSE──▶  useSystemMetrics()  ──▶  Dashboard UI
```

- **Data sources:** `nvidia-smi --query-gpu`, `sensors -j`, `ipmitool sensor list`.
- **Transport:** Server-Sent Events, polled every 2s server-side.
- **Configurable:** `IPMITOOL_COMMAND` env var (default `sudo ipmitool sensor list`) lets you adjust the fan-data invocation.

## Configuration

| File | Purpose |
|------|---------|
| `.env.local` | `PORT=3001` (scripts already use `-p 3001`) |
| `src/lib/constants.ts` | Thresholds, poll interval, history length, ipmitool command |
| `src/app/api/stream/route.ts` | SSE endpoint |
| `src/lib/collectors/*` | System metric collectors |

## System prerequisites

On the AI server:

```bash
sudo apt install -y lm-sensors ipmitool
sudo sensors-detect --auto

# Passwordless sudo for ipmitool (see scripts/setup.sh):
# your_user ALL=(root) NOPASSWD: /usr/bin/ipmitool sensor list
```

NVIDIA driver + `nvidia-smi` must be present, and the app user should be in the `video` group.

## Production with pm2

```bash
npm run build
pm2 start npm --name "gpu-monitor" -- start
pm2 save && pm2 startup
```

## First-time install on a server (bootstrap)

`scripts/bootstrap.sh` is **self-contained** — it does *not* depend on any other
file in the repo, so it can be run on a fresh server where the repo isn't
cloned yet. It installs Node 20 (via NodeSource apt — no nvm needed), clones
the repo, installs deps, and builds.

**One-liner on a fresh server** (no repo present):

```bash
curl -fsSL https://raw.githubusercontent.com/naualex2023/AI_server_dashboard/main/scripts/bootstrap.sh | bash
```

**Or, to also start under pm2:**

```bash
curl -fsSL https://raw.githubusercontent.com/naualex2023/AI_server_dashboard/main/scripts/bootstrap.sh | USE_PM2=1 bash
```

**Or after a manual clone:**

```bash
git clone https://github.com/naualex2023/AI_server_dashboard.git ~/AI_server_dashboard
cd ~/AI_server_dashboard
bash scripts/bootstrap.sh
```

Env vars: `INSTALL_DIR` (default `~/AI_server_dashboard`), `REPO_BRANCH` (default `main`), `USE_PM2=1`.

## Updating the deployment (server)

After the first-time bootstrap, pull the latest code and bring the app back up in one go:

```bash
cd ~/AI_server_dashboard
bash scripts/update.sh
```

> **Why a separate script?** `update.sh` lives *inside* the repo and uses the
> repo's own `scripts/check-node.mjs` guard. `bootstrap.sh` is self-contained so
> it can run *before* the repo exists. Bootstrap once → update forever after.

`update.sh` does the following, step by step:

1. **Fixes directory ownership** (in case the repo was cloned with `sudo`) and marks it as a git *safe.directory*.
2. **Checks the Node version** via `scripts/check-node.mjs` — fails fast with install instructions (apt for servers, nvm for dev) before the cryptic `Unexpected token '?'` can appear.
3. **Refreshes GitHub CLI auth** if expired, then **stashes local changes** (e.g. `.env.local`), `git pull`s, and restores the stash.
4. **Reinstalls dependencies** — `npm ci` when a lockfile exists, otherwise `npm install`.
5. **Rebuilds + restarts pm2** *only if* a `gpu-monitor` pm2 process exists; otherwise prints the dev/prod/pm2 commands to run manually.

Run it on the server after every `git push` — no Node expertise required.

## Project structure

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   └── api/stream/route.ts        # SSE endpoint
├── lib/
│   ├── types.ts, constants.ts, utils.ts
│   ├── useSystemMetrics.ts        # client SSE hook
│   └── collectors/{gpu,cpu,fans}.ts
└── components/
    ├── dashboard/  # SystemBar, GpuCard, GpuGrid, CpuPanel, FanPanel, PowerSummary
    ├── charts/     # GpuTempChart, GpuUtilChart, MemUsageChart, PowerDrawChart
    └── ui/         # card, gauge, status-badge
```

## Troubleshooting

### `SyntaxError: Unexpected token '?'` when running `npm run dev`/`start`

Cause: Next.js 14 is being run on Node.js older than 18.17.0 (common on Ubuntu servers). Fix: see **Node.js version requirement** above, or just run `bash scripts/bootstrap.sh` / `bash scripts/update.sh` — the built-in guard will print exact instructions.

### `dpkg: error ... trying to overwrite '/usr/include/node/common.gypi', which is also in package libnode-dev`

Cause: Ubuntu 22.04 ships an old Node 12 split into packages (`libnode-dev`, `libnode72`, `nodejs-doc`) whose dev headers conflict with NodeSource's self-contained `nodejs` 20 package. The install aborts mid-way and leaves apt in a half-configured state.

`scripts/bootstrap.sh` now **detects and purges these conflicting packages automatically** before installing Node 20, and has a **force-overwrite fallback** if a conflict still slips through. But if you hit this manually, recover with:

```bash
sudo dpkg --configure -a
sudo apt-get -f install -y
sudo apt-get remove -y libnode-dev libnode72 nodejs-doc nodejs
sudo apt-get autoremove -y
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

## Notes

- The dashboard is safe to run where the GPU tools are missing — collectors catch errors and return empty arrays, so the page renders placeholders instead of crashing.
- Keep port 3001 behind a firewall/VPN; add auth via an nginx reverse proxy with `auth_basic` for public exposure.
