"use client";

import type { GpuMetric } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function MemUsageChart({ gpus }: { gpus: GpuMetric[] }) {
  const data = gpus.map((g) => ({
    name: `GPU ${g.index}`,
    used: Math.round(g.memUsedMb / 1024),
    free: Math.round(g.memFreeMb / 1024),
  }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#374151" }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#374151" }}
          />
          <Tooltip
            cursor={{ fill: "#1f2937" }}
            contentStyle={{
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 6,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="used" stackId="a" fill="#60a5fa" name="Used (GB)" />
          <Bar dataKey="free" stackId="a" fill="#374151" name="Free (GB)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
