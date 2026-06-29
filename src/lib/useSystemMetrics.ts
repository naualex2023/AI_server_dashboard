// React hook that subscribes to the /api/stream SSE feed and keeps history.
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { SystemMetrics } from "./types";
import { MAX_HISTORY, RECONNECT_MS } from "./constants";

export function useSystemMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [history, setHistory] = useState<SystemMetrics[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const evtSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const evtSource = new EventSource("/api/stream");
    evtSourceRef.current = evtSource;

    evtSource.onopen = () => setConnected(true);

    evtSource.onmessage = (event) => {
      const data: SystemMetrics = JSON.parse(event.data);
      setMetrics(data);
      setHistory((prev) => {
        const next = [...prev, data];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    };

    evtSource.onerror = () => {
      setConnected(false);
      evtSource.close();
      reconnectTimeout.current = setTimeout(connect, RECONNECT_MS);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      evtSourceRef.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return { metrics, history, connected };
}