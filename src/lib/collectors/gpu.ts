// GPU metrics collector via `nvidia-smi`.
import { exec } from "child_process";
import { promisify } from "util";
import type { GpuMetric } from "../types";

const execAsync = promisify(exec);

const GPU_QUERY = [
  "index",
  "name",
  "temperature.gpu",
  "utilization.gpu",
  "utilization.memory",
  "memory.used",
  "memory.total",
  "memory.free",
  "power.draw",
  "power.limit",
  "fan.speed",
].join(",");

function parseGpuCsv(csv: string): GpuMetric[] {
  return csv
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.split(",").map((s) => s.trim());
      return {
        index: Number(p[0]),
        name: p[1],
        tempC: Number(p[2]),
        gpuUtilPct: Number(p[3]),
        memUtilPct: Number(p[4]),
        memUsedMb: Number(p[5]),
        memTotalMb: Number(p[6]),
        memFreeMb: Number(p[7]),
        powerDrawW: Number(p[8]),
        powerLimitW: Number(p[9]),
        fanSpeedPct: Number(p[10]),
      };
    });
}

export async function collectGpuMetrics(): Promise<GpuMetric[]> {
  try {
    const { stdout } = await execAsync(
      `nvidia-smi --query-gpu=${GPU_QUERY} --format=csv,noheader,nounits`,
      { timeout: 5000, encoding: "utf-8" }
    );
    return parseGpuCsv(stdout);
  } catch (err) {
    console.error("[GPU] nvidia-smi failed:", err);
    return [];
  }
}
