"use client";

import type { GpuMetric, SystemMetrics } from "@/lib/types";
import { GpuCard } from "./GpuCard";

export function GpuGrid({
  gpus,
  history,
}: {
  gpus: GpuMetric[];
  history: SystemMetrics[];
}) {
  if (gpus.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
        Waiting for GPU data… (is nvidia-smi available?)
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {gpus.map((gpu) => (
        <GpuCard key={gpu.index} gpu={gpu} history={history} />
      ))}
    </div>
  );
}
