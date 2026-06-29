"use client";

import { useSystemMetrics } from "@/lib/useSystemMetrics";
import { SystemBar } from "@/components/dashboard/SystemBar";
import { GpuGrid } from "@/components/dashboard/GpuGrid";
import { CpuPanel } from "@/components/dashboard/CpuPanel";
import { FanPanel } from "@/components/dashboard/FanPanel";
import { PowerSummary } from "@/components/dashboard/PowerSummary";
import { GpuTempChart } from "@/components/charts/GpuTempChart";
import { GpuUtilChart } from "@/components/charts/GpuUtilChart";
import { MemUsageChart } from "@/components/charts/MemUsageChart";
import { PowerDrawChart } from "@/components/charts/PowerDrawChart";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const { metrics, history, connected } = useSystemMetrics();
  const gpus = metrics?.gpus ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <SystemBar connected={connected} timestamp={metrics?.timestamp} />

      <main className="mx-auto max-w-[1600px] space-y-6 p-4">
        {metrics?.error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
            Error collecting metrics — some sources may be unavailable.
          </div>
        )}

        {/* GPU cards */}
        <GpuGrid gpus={gpus} history={history} />

        {/* History charts */}
        {gpus.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>GPU Temperature History</CardTitle>
              </CardHeader>
              <CardContent>
                <GpuTempChart history={history} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>GPU Utilization History</CardTitle>
              </CardHeader>
              <CardContent>
                <GpuUtilChart history={history} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lower section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CpuPanel cpu={metrics?.cpu ?? null} history={history} />
          <FanPanel fans={metrics?.fans ?? []} />
          <PowerSummary gpus={gpus} />
        </div>

        {/* Memory + power charts */}
        {gpus.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>VRAM Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <MemUsageChart gpus={gpus} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Power Draw</CardTitle>
              </CardHeader>
              <CardContent>
                <PowerDrawChart gpus={gpus} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
