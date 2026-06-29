"use client";

import type { GpuMetric } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function PowerDrawChart({ gpus }: { gpus: GpuMetric[] }) {
  const data = gpus.map((g) => ({
    name: `GPU ${g.index}`,
    draw: g.powerDrawW,
    limit: g.powerLimitW,
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
            formatter={(v: number) => [`${v} W`, "Draw"]}
          />
          <Bar dataKey="draw" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.limit > 0 && d.draw / d.limit > 0.9 ? "#ef4444" : "#a855f7"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
