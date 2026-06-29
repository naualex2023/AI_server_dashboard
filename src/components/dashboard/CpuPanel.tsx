"use client";

import type { CpuMetrics, SystemMetrics } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn, tempStatus, statusColor } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function CpuPanel({
  cpu,
  history,
}: {
  cpu: CpuMetrics | null;
  history: SystemMetrics[];
}) {
  const entries = cpu ? Object.entries(cpu.chipTemps) : [];
  const pkg = entries.find(([k]) => k.toLowerCase().includes("package"))?.[1];

  const chartData = history
    .map((h, i) => ({
      i,
      temp: h.cpu
        ? Object.entries(h.cpu.chipTemps).find(([k]) =>
            k.toLowerCase().includes("package")
          )?.[1] ?? null
        : null,
    }))
    .filter((d) => d.temp !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU Temperatures</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No CPU data. Run <code className="font-mono">sensors -j</code> on the server.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-gray-100">
                {pkg !== undefined ? `${pkg}°C` : "--"}
              </span>
              <span className="text-xs text-gray-500">Package</span>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {entries.map(([name, temp]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="truncate text-gray-500">{name}</span>
                  <span
                    className={cn(
                      "ml-2 font-mono",
                      statusColor(tempStatus(temp, "cpu"))
                    )}
                  >
                    {temp}°C
                  </span>
                </div>
              ))}
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis hide dataKey="i" />
                  <YAxis domain={[20, 100]} hide />
                  <Tooltip
                    contentStyle={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: 6,
                    }}
                    formatter={(v: number) => [`${v}°C`, "CPU"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
