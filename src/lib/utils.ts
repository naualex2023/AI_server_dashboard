// Utility for conditionally joining Tailwind class names.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { THRESHOLDS } from "./constants";
import type { StatusLevel } from "./types";

export function tempStatus(temp: number, kind: "gpu" | "cpu"): StatusLevel {
  const t = THRESHOLDS[kind];
  if (temp >= t.tempCritical) return "critical";
  if (temp >= t.tempWarning) return "warning";
  return "ok";
}

export function statusColor(status: StatusLevel): string {
  switch (status) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-yellow-400";
    default:
      return "text-green-400";
  }
}

export function statusBorder(status: StatusLevel): string {
  switch (status) {
    case "critical":
      return "border-l-red-500";
    case "warning":
      return "border-l-yellow-500";
    default:
      return "border-l-green-500";
  }
}

export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
