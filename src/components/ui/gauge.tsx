"use client";

import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number; // current value
  min?: number;
  max: number;
  label: string;
  unit?: string;
  className?: string;
  colorClass?: string; // tailwind text-* class for the arc
}

export function Gauge({
  value,
  min = 0,
  max,
  label,
  unit = "",
  className,
  colorClass = "text-blue-400",
}: GaugeProps) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = pct * circ;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width="92" height="92" viewBox="0 0 92 92" className="-rotate-90">
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-800"
        />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className={colorClass}
        />
      </svg>
      <div className="-mt-14 flex flex-col items-center">
        <span className="font-mono text-lg font-bold text-gray-100">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <span className="mt-6 text-xs text-gray-500">{label}</span>
    </div>
  );
}
