// Shared TypeScript interfaces for the monitoring dashboard.

export interface GpuMetric {
  index: number;
  name: string;
  tempC: number;
  gpuUtilPct: number;
  memUtilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  memFreeMb: number;
  powerDrawW: number;
  powerLimitW: number;
  fanSpeedPct: number;
}

export interface CpuMetrics {
  chipTemps: Record<string, number>;
  timestamp: number;
}

export interface FanMetric {
  name: string;
  rpm: number;
  status: string; // 'ok' | 'na' | 'nr'
  lowerLimit?: number;
  upperLimit?: number;
}

export interface SystemMetrics {
  timestamp: number;
  gpus: GpuMetric[];
  cpu: CpuMetrics | null;
  fans: FanMetric[];
  error?: boolean;
}

export type StatusLevel = "ok" | "warning" | "critical";