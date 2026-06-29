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

## Notes

- The dashboard is safe to run where the GPU tools are missing — collectors catch errors and return empty arrays, so the page renders placeholders instead of crashing.
- Keep port 3001 behind a firewall/VPN; add auth via an nginx reverse proxy with `auth_basic` for public exposure.