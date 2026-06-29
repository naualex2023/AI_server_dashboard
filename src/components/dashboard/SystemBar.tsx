"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SystemBarProps {
  connected: boolean;
  timestamp?: number;
}

export function SystemBar({ connected, timestamp }: SystemBarProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const updated = timestamp ? new Date(timestamp).toLocaleTimeString() : "--";
  const ago = timestamp ? Math.max(0, Math.round((now - timestamp) / 1000)) : 0;

  return (
    <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full",
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )}
          />
          <h1 className="font-mono text-sm font-bold tracking-wide text-gray-100">
            AI SERVER MONITOR
          </h1>
          <span className="text-xs text-gray-500">
            {connected ? "connected" : "reconnecting…"}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono text-gray-400">
          <div>
            <span className="text-gray-600">updated </span>
            {updated}
            <span className="text-gray-600"> ({ago}s ago)</span>
          </div>
        </div>
      </div>
    </header>
  );
}
