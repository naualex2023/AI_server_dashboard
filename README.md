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