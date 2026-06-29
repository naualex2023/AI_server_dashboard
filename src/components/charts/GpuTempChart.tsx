"use client";

import type { SystemMetrics } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

export function GpuTempChart({ history }: { history: SystemMetrics[] }) {
  const data = history.map((h, i) => {
    const row: Record<string, number | null> = { i };
    h.gpus.forEach((g) => {
      row[`GPU ${g.index}`] = g.tempC;
    });
    return row;
  });

  const keys = data[0]
    ? Object.keys(data[0]).filter((k) => k !== "i")
    : [];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis hide dataKey="i" />
          <YAxis
            domain={[30, 95]}
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
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
