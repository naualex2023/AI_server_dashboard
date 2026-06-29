"use client";

import type { SystemMetrics } from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

export function GpuUtilChart({ history }: { history: SystemMetrics[] }) {
  const data = history.map((h, i) => {
    const row: Record<string, number | null> = { i };
    h.gpus.forEach((g) => {
      row[`GPU ${g.index}`] = g.gpuUtilPct;
    });
    return row;
  });

  const keys = data[0]
    ? Object.keys(data[0]).filter((k) => k !== "i")
    : [];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis hide dataKey="i" />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={{ stroke: "#374151" }}
          />
          <Tooltip
            contentStyle={{
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 6,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {keys.map((k, idx) => (
            <Area
              key={k}
              type="monotone"
              dataKey={k}
              stackId="1"
              stroke={COLORS[idx % COLORS.length]}
              fill={COLORS[idx % COLORS.length]}
              fillOpacity={0.3}
              strokeWidth={1}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
