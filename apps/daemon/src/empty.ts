import type {
  BackgroundPolicySnapshot,
  HostPowerSnapshot,
  ResourceTelemetryHistory,
  ResourceTelemetrySnapshot,
  ServerProcessDiagnosticsResult,
  ServerProcessResourceHistoryResult,
  ServerTraceDiagnosticsResult,
  UsageSummary,
} from "@t3tools/contracts";
import { USAGE_CONTRACT_VERSION } from "@t3tools/contracts";
import * as Option from "effect/Option";

import { hostPowerSource } from "./git.ts";
import { nowIso, nowUtc } from "./runtime.ts";

const zeroAggregate = {
  processCount: 0,
  currentCpuPercent: 0,
  cpuTimeMs: 0,
  currentRssBytes: 0,
  peakRssBytes: 0,
  ioReadBytes: 0,
  ioWriteBytes: 0,
  ioReadBytesPerSecond: 0,
  ioWriteBytesPerSecond: 0,
  processStarts: 0,
  processExits: 0,
};

const healthSource = {
  status: "unavailable" as const,
  lastSampleAt: Option.none(),
  lastError: Option.none(),
};

export const hostPower = (): HostPowerSnapshot => ({
  source: hostPowerSource(),
  idle: "unknown",
  idleSeconds: null,
  locked: "unknown",
  suspended: false,
  onBattery: "unknown",
  lowPowerMode: "unknown",
  thermalState: "unknown",
  stale: true,
  updatedAt: nowUtc(),
});

export const backgroundPolicy = (): BackgroundPolicySnapshot => ({
  hostPower: hostPower(),
  leases: [],
  activeForegroundLeaseCount: 0,
  activeScopeKeys: [],
  shouldRunOpportunisticWork: true,
  updatedAt: nowUtc(),
});

const telemetryHealth = {
  native: healthSource,
  desktop: healthSource,
  sidecarVersion: Option.none(),
  sidecarPid: Option.none(),
  restartCount: 0,
  collectionDurationMicros: 0,
  scannedProcessCount: 0,
  retainedProcessCount: 0,
  inaccessibleProcessCount: 0,
};

export const resourceTelemetry = (): ResourceTelemetrySnapshot => {
  const readAt = nowUtc();
  return {
    readAt,
    sampleIntervalMs: 1000,
    processes: [],
    groups: {
      backend: zeroAggregate,
      electron: zeroAggregate,
      monitor: zeroAggregate,
      allT3: zeroAggregate,
    },
    power: hostPower(),
    speedLimitPercent: Option.none(),
    attribution: { readAt, entries: [] },
    health: telemetryHealth,
  };
};

export const resourceTelemetryHistory = (
  windowMs: number,
  bucketMs: number,
): ResourceTelemetryHistory => ({
  readAt: nowUtc(),
  windowMs,
  bucketMs,
  sampleIntervalMs: 1000,
  retainedSampleCount: 0,
  buckets: [],
  topProcesses: [],
  health: telemetryHealth,
});

export const processDiagnostics = (pid: number): ServerProcessDiagnosticsResult => ({
  serverPid: pid < 1 ? 1 : pid,
  readAt: nowUtc(),
  processCount: 1,
  totalRssBytes: 0,
  totalCpuPercent: 0,
  processes: [
    {
      pid: pid < 1 ? 1 : pid,
      startTimeMs: 0,
      ppid: 0,
      pgid: Option.none(),
      status: "running",
      cpuPercent: 0,
      rssBytes: 0,
      elapsed: "0s",
      command: "nero-daemon",
      depth: 0,
      childPids: [],
    },
  ],
  error: Option.none(),
});

export const processResourceHistory = (
  windowMs: number,
  bucketMs: number,
): ServerProcessResourceHistoryResult => ({
  readAt: nowUtc(),
  windowMs,
  bucketMs,
  sampleIntervalMs: 1000,
  retainedSampleCount: 0,
  totalCpuSecondsApprox: 0,
  buckets: [],
  topProcesses: [],
  error: Option.none(),
});

export const traceDiagnostics = (path: string): ServerTraceDiagnosticsResult => ({
  traceFilePath: path,
  scannedFilePaths: [],
  readAt: nowUtc(),
  recordCount: 0,
  parseErrorCount: 0,
  firstSpanAt: Option.none(),
  lastSpanAt: Option.none(),
  failureCount: 0,
  interruptionCount: 0,
  slowSpanThresholdMs: 1000,
  slowSpanCount: 0,
  logLevelCounts: {},
  topSpansByCount: [],
  slowestSpans: [],
  commonFailures: [],
  latestFailures: [],
  latestWarningAndErrorLogs: [],
  partialFailure: Option.none(),
  error: Option.none(),
});

export const usageSummary = (input: {
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly timeZone: string;
}): UsageSummary => ({
  contractVersion: USAGE_CONTRACT_VERSION,
  readAt: nowIso(),
  timeZone: input.timeZone,
  sinceDay: input.sinceDay as UsageSummary["sinceDay"],
  untilDay: input.untilDay as UsageSummary["untilDay"],
  buckets: [],
  sources: [],
  pricing: {
    status: "unavailable",
    source: "none",
    fetchedAt: null,
    knownModels: 0,
  },
  scanDurationMs: 0,
});
