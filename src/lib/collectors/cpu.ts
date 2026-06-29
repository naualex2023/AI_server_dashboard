// CPU metrics collector via `sensors -j` (lm-sensors).
import { exec } from "child_process";
import { promisify } from "util";
import type { CpuMetrics } from "../types";

const execAsync = promisify(exec);

// `sensors -j` emits almost-JSON with trailing commas before } or ] — fix them.
function parseSensors(raw: string): CpuMetrics {
  const fixed = raw.replace(/,\s*([}\]])/g, "$1");
  const data = JSON.parse(fixed) as Record<
    string,
    Record<string, Record<string, number>>
  >;

  const temps: Record<string, number> = {};
  for (const [, readings] of Object.entries(data)) {
    for (const [key, val] of Object.entries(readings)) {
      if (key === "Adapter") continue;
      // Pick the first *_input temperature field in each group.
      if (val && typeof val === "object") {
        const inputKey = Object.keys(val).find((k) => k.endsWith("_input"));
        if (inputKey && typeof val[inputKey] === "number") {
          temps[key] = val[inputKey];
        }
      }
    }
  }
  return { chipTemps: temps, timestamp: Date.now() };
}

export async function collectCpuMetrics(): Promise<CpuMetrics | null> {
  try {
    const { stdout } = await execAsync("sensors -j", {
      timeout: 5000,
      encoding: "utf-8",
    });
    return parseSensors(stdout);
  } catch (err) {
    console.error("[CPU] sensors failed:", err);
    return null;
  }
}
