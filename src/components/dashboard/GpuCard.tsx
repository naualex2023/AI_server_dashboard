"use client";

import type { GpuMetric, SystemMetrics } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { tempStatus, cn, formatMb } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-mono text-sm text-gray-100">{value}</div>
    </div>
  );
}

export function GpuCard({
  gpu,
  history,
}: {
  gpu: GpuMetric;
  history: SystemMetrics[];
}) {
  const status = tempStatus(gpu.tempC, "gpu");
  const memPct =
    gpu.memTotalMb > 0 ? Math.round((gpu.memUsedMb / gpu.memTotalMb) * 100) : 0;

  const chartData = history.map((h, i) => ({
    i,
    temp: h.gpus[gpu.index]?.tempC ?? null,
    util: h.gpus[gpu.index]?.gpuUtilPct ?? null,
  }));

  return (
    <Card className={cn("border-l-4 p-4", statusBorderFor(status))}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-gray-100">
          GPU {gpu.index} — {gpu.name}
        </h3>
        <StatusBadge status={status} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Temperature" value={`${gpu.tempC}°C`} />
        <Metric label="Utilization" value={`${gpu.gpuUtilPct}%`} />
        <Metric
          label="VRAM"
          value={`${formatMb(gpu.memUsedMb)} / ${formatMb(gpu.memTotalMb)} (${memPct}%)`}
        />
        <Metric
          label="Power"
          value={`${gpu.powerDrawW} / ${gpu.powerLimitW} W`}
        />
      </div>

      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`temp${gpu.index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis hide dataKey="i" />
            <YAxis domain={[30, 95]} hide />
            <Tooltip
              contentStyle={{
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 6,
              }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(v: number) => [`${v}°C`, "Temp"]}
            />
            <Area
              type="monotone"
              dataKey="temp"
              stroke="#ef4444"
              strokeWidth={2}
              fill={`url(#temp${gpu.index})`}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function statusBorderFor(status: "ok" | "warning" | "critical") {
  switch (status) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-yellow-500";
    default:
      return "border-l-green-500";
  }
}
