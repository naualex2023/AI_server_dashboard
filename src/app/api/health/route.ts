// Health endpoint: liveness + optional readiness probe.
//
// GET /api/health            -> fast liveness check (always 200 if alive)
// GET /api/health?probe=true -> also run the collectors and report whether
//                               data sources are responding (200/503)
//
// Designed for uptime monitors / load balancers: the default path never
// shells out, so it stays fast and cheap even under frequent polling.
import { exec } from "child_process";
import { promisify } from "util";
import { collectGpuMetrics } from "@/lib/collectors/gpu";
import { collectCpuMetrics } from "@/lib/collectors/cpu";
import { collectFanMetrics } from "@/lib/collectors/fans";

const execAsync = promisify(exec);

// Process start time — captured at module load, so `uptime` reflects how
// long the Node server process has been alive (not per-request).
const START_TIME = Date.now();
const MEMORY_AT_START = process.memoryUsage().rss;

/** Check whether a binary is on PATH without actually running it. */
async function toolAvailable(cmd: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${cmd}`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/** Build the JSON body shared by both the fast and probe paths. */
function buildBody(probed: boolean) {
  const now = Date.now();
  return {
    status: "ok",
    pid: process.pid,
    uptimeMs: now - START_TIME,
    uptimeSeconds: Math.round((now - START_TIME) / 1000),
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      startedRssMb: Math.round(MEMORY_AT_START / 1024 / 1024),
    },
    timestamp: now,
    probed,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantProbe = url.searchParams.get("probe") === "true";

  // --- Fast path: liveness only (no shell-outs) -----------------------
  // If we can respond at all, the Node process is alive. Report which
  // tools *appear* installed via `command -v` (cheap), but don't run them.
  const [nvidiaSmiExists, sensorsExists, ipmitoolExists] = await Promise.all([
    toolAvailable("nvidia-smi"),
    toolAvailable("sensors"),
    toolAvailable("ipmitool"),
  ]);

  const base = buildBody(false);
  const tools = {
    "nvidia-smi": nvidiaSmiExists,
    sensors: sensorsExists,
    ipmitool: ipmitoolExists,
  };

  if (!wantProbe) {
    return Response.json(
      { ...base, tools, collectorsRun: false },
      { status: 200 }
    );
  }

  // --- Probe path: actually run the collectors ------------------------
  // This mirrors what /api/stream does each tick. If the primary data
  // source (GPU) returns nothing despite the tool being installed, treat
  // the service as degraded (503) so a monitor can alert.
  const [gpus, cpu, fans] = await Promise.all([
    collectGpuMetrics(),
    collectCpuMetrics(),
    collectFanMetrics(),
  ]);

  const gpuOk = gpus.length > 0 || !nvidiaSmiExists; // ok if tool absent
  const cpuOk = cpu !== null || !sensorsExists;
  const fansOk = fans.length > 0 || !ipmitoolExists;
  const healthy = gpuOk && cpuOk && fansOk;

  const body = {
    ...buildBody(true),
    tools,
    collectorsRun: true,
    collectors: {
      gpuCount: gpus.length,
      cpu: cpu !== null,
      fanCount: fans.length,
      gpuOk,
      cpuOk,
      fansOk,
    },
  };

  return Response.json(body, {
    status: healthy ? 200 : 503,
  });
}