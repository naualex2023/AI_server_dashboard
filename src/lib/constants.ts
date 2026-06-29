// Thresholds, polling intervals, and shared configuration.

export const THRESHOLDS = {
  gpu: {
    tempWarning: 75, // °C — yellow threshold
    tempCritical: 85, // °C — red threshold
    utilWarning: 90, // %  — high utilization
  },
  cpu: {
    tempWarning: 75,
    tempCritical: 90,
  },
  fan: {
    rpmLow: 720, // RPM — lower limit (from ipmitool)
    rpmHigh: 20000,
  },
} as const;

// Polling cadence for the SSE data stream.
export const POLL_INTERVAL_MS = 2000;

// Number of historical points kept on the client (120 pts × 2s = 4 min).
export const MAX_HISTORY = 120;

// Reconnect delay when the EventSource stream errors out.
export const RECONNECT_MS = 3000;

// Allow overriding the ipmitool invocation (e.g. with sudo) via env.
export const IPMITOOL_COMMAND =
  process.env.IPMITOOL_COMMAND ?? "sudo ipmitool sensor list";

// Allow mocking the data collectors when system tools are unavailable.
export const USE_MOCK_DATA =
  (process.env.USE_MOCK_DATA ?? "false").toLowerCase() === "true";