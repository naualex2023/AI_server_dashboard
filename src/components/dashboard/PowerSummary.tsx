"use client";

import type { GpuMetric } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

export function PowerSummary({ gpus }: { gpus: GpuMetric[] }) {
  const total = gpus.reduce((sum, g) => sum + (g.powerDrawW || 0), 0);
  const limit = gpus.reduce((sum, g) => sum + (g.powerLimitW || 0), 0);
  const data = gpus.map((g) => ({
    name: `GPU ${g.index}`,
    draw: g.powerDrawW,
    limit: g.powerLimitW,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-gray-100">
            {total.toFixed(1)} W
          </span>
          <span className="text-xs text-gray-500">/ {limit.toFixed(0)} W limit</span>
        </div>
        <div className="mb-4 h-2 w-full overflow-hidden rounded bg-gray-800">
          <div
            className="h-full rounded bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
            style={{ width: `${limit > 0 ? Math.min(100, (total / limit) * 100) : 0}%` }}
          />
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
                {data.map((_, i) => (
                  <Cell key={i} fill="#60a5fa" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
