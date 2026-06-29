"use client";

import { cn } from "@/lib/utils";
import type { StatusLevel } from "@/lib/types";

const styles: Record<StatusLevel, string> = {
  ok: "bg-green-500/15 text-green-400 border-green-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
};

const labels: Record<StatusLevel, string> = {
  ok: "OK",
  warning: "WARN",
  critical: "CRIT",
};

export function StatusBadge({ status }: { status: StatusLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-semibold",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
