// Fan metrics collector via `ipmitool sensor list`.
import { exec } from "child_process";
import { promisify } from "util";
import type { FanMetric } from "../types";
import { IPMITOOL_COMMAND } from "../constants";

const execAsync = promisify(exec);

function parseFanOutput(raw: string): FanMetric[] {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      const rpmMatch = parts[1]?.match(/([\d.]+)/);
      const limitMatch = parts[7]?.match(/([\d.]+)/);
      const upperMatch = parts[8]?.match(/([\d.]+)/);
      return {
        name: parts[0] ?? "",
        rpm: rpmMatch ? Number(rpmMatch[1]) : 0,
        status: parts[2] ?? "na",
        lowerLimit: limitMatch ? Number(limitMatch[1]) : undefined,
        upperLimit: upperMatch ? Number(upperMatch[1]) : undefined,
      };
    });
}

export async function collectFanMetrics(): Promise<FanMetric[]> {
  try {
    const { stdout } = await execAsync(`${IPMITOOL_COMMAND} | grep -i fan`, {
      timeout: 8000,
      encoding: "utf-8",
    });
    return parseFanOutput(stdout);
  } catch (err) {
    console.error("[FAN] ipmitool failed:", err);
    return [];
  }
}
