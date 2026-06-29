"use client";

import type { FanMetric } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { THRESHOLDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function FanPanel({ fans }: { fans: FanMetric[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fan Speeds</CardTitle>
      </CardHeader>
      <CardContent>
        {fans.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No fan data. Is <code className="font-mono">ipmitool</code> available?
          </p>
        ) : (
          <ul className="space-y-3">
            {fans.map((fan) => {
              const pct = Math.min(
                100,
                (fan.rpm / THRESHOLDS.fan.rpmHigh) * 100
              );
              const low = fan.lowerLimit ?? THRESHOLDS.fan.rpmLow;
              const slow = fan.rpm > 0 && fan.rpm < low;
              return (
                <li key={fan.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate text-gray-400">{fan.name}</span>
                    <span
                      className={cn(
                        "font-mono",
                        slow ? "text-yellow-400" : "text-gray-100"
                      )}
                    >
                      {fan.rpm} RPM
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-gray-800">
                    <div
                      className={cn(
                        "h-full rounded",
                        slow ? "bg-yellow-500" : "bg-blue-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
