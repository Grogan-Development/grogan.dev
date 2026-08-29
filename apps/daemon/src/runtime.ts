import * as Crypto from "node:crypto";
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";
import * as Process from "node:process";

import type { EnvironmentId } from "@t3tools/contracts";
import { EnvironmentId as EnvironmentIdSchema } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

// Overridable so the deployment can point routes at alternate endpoints
// (e.g. a Z.ai gateway). Keys are injected via the guest env; see
// router/ for the provider adapters and fallback policy.
export const NERO_MODEL = Process.env.NERO_MODEL ?? "glm-5.3-flash";
export const NERO_DRIVER = "nero";
export const NERO_INSTANCE_ID = "nero";
export const SESSION_COOKIE = "nero_session";
export const DAEMON_VERSION = "0.1.0";
// Z.ai: coding endpoint spends plan quota; the generic paas endpoint bills
// pay-as-you-go and is only a fallback after quota errors.
export const ZAI_CODING_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
export const ZAI_PAYG_BASE_URL = "https://api.z.ai/api/paas/v4";
export const BASETEN_BASE_URL = "https://inference.baseten.co/v1";
export const ROUTER_TIMEOUT_MS = 120_000;
export const ROUTER_IDLE_MS = 45_000;
export const MAX_SHOT_IMAGES = 8;
export const MAX_SHOT_BYTES = 10 * 1024 * 1024;

export type DaemonOptions = {
  readonly host: string;
  readonly port: number;
  readonly workspaceRoot: string;
  readonly homeDir: string;
  readonly dataDir: string;
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly devBypass: boolean;
  readonly accessToken: string | undefined;
  /** Exclusive flock path shared with `nero-desktop` click/type/key. */
  readonly seatLockPath: string;
  /** Binary for `nero-desktop hold` (same flock as agent inject). */
  readonly seatHoldBin: string;
  /** KasmVNC loopback origin, reverse-proxied at `/vnc/`. */
  readonly vncOrigin: string;
  /** Router credentials and endpoints (see src/router). */
  readonly zaiApiKey: string | undefined;
  readonly zaiCodingBaseUrl: string;
  readonly zaiPaygBaseUrl: string;
  readonly basetenApiKey: string | undefined;
  readonly basetenBaseUrl: string;
  /** OAuth login surface for the OpenAI Pro (Codex) subscription route. */
  readonly openaiClientId: string | undefined;
  readonly codexRedirectUri: string | undefined;
  /** OpenCode Zen gateway (GPT/Grok fallback; primary for Claude/Kimi/Gemini/DeepSeek). */
  readonly opencodeApiKey: string | undefined;
  readonly opencodeBaseUrl: string | undefined;
  readonly routerTimeoutMs: number;
  readonly routerIdleMs: number;
  /** Host control-plane base URL; set in guests for the keep-awake pulse. */
  readonly hostUrl: string | undefined;
  /** Guest→host shared secret for the job-heartbeat route. */
  readonly hostToken: string | undefined;
  /** This workspace's id on the host; required for the pulse. */
  readonly workspaceId: string | undefined;
};

export const nowUtc = (): DateTime.Utc => DateTime.nowUnsafe();

export const nowIso = (): string => DateTime.formatIso(nowUtc());

export const laterMs = (ms: number): DateTime.Utc =>
  DateTime.makeUnsafe(DateTime.toEpochMillis(nowUtc()) + ms);

let seq = 0;

export const nextToken = (prefix: string): string => {
  seq += 1;
  return `${prefix}_${DateTime.toEpochMillis(nowUtc()).toString(36)}_${seq.toString(36)}`;
};

/**
 * CSPRNG secret for anything an unauthenticated caller must not be able to
 * guess (websocket tickets, session tokens, pairing credentials). Never use
 * `nextToken` for these — it is a predictable timestamp+counter.
 */
export const nextSecret = (prefix: string): string =>
  `${prefix}_${Crypto.randomBytes(24).toString("base64url")}`;

export const platformOs = (): "darwin" | "linux" | "windows" | "unknown" => {
  switch (Process.platform) {
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
};

export const platformArch = (): "arm64" | "x64" | "other" => {
  switch (Process.arch) {
    case "arm64":
      return "arm64";
    case "x64":
      return "x64";
    default:
      return "other";
  }
};

const envFlag = (name: string): boolean => {
  const value = Process.env[name];
  return value === "1" || value === "true" || value === "yes";
};

const resolveDir = (value: string): string => Path.resolve(value);

export const loadOptionsFromEnv = (): DaemonOptions => {
  const homeDir = resolveDir(Process.env.NERO_HOME ?? Process.env.HOME ?? Path.join(Os.homedir()));
  const workspaceRoot = resolveDir(Process.env.NERO_WORKSPACE ?? homeDir);
  const defaultData =
    Process.env.NODE_ENV === "test"
      ? Path.join(Process.cwd(), "data")
      : Path.join(homeDir, ".nero");
  const dataDir = resolveDir(Process.env.NERO_DATA_DIR ?? defaultData);
  const port = Number.parseInt(Process.env.NERO_PORT ?? Process.env.PORT ?? "8787", 10);
  return {
    host: Process.env.NERO_HOST ?? "0.0.0.0",
    port: Number.isFinite(port) && port > 0 ? port : 8787,
    workspaceRoot,
    homeDir,
    dataDir,
    environmentId: EnvironmentIdSchema.make(Process.env.NERO_ENVIRONMENT_ID ?? "nero"),
    label: Process.env.NERO_LABEL ?? "Nero",
    devBypass: envFlag("NERO_DEV_BYPASS"),
    accessToken: Process.env.NERO_ACCESS_TOKEN,
    seatLockPath: Process.env.NERO_SEAT_LOCK ?? "/run/nero/seat.lock",
    seatHoldBin: Process.env.NERO_DESKTOP ?? "nero-desktop",
    vncOrigin: Process.env.NERO_VNC_ORIGIN ?? "http://127.0.0.1:8444",
    zaiApiKey: Process.env.ZAI_API_KEY,
    zaiCodingBaseUrl: Process.env.ZAI_BASE_URL ?? ZAI_CODING_BASE_URL,
    zaiPaygBaseUrl: Process.env.ZAI_PAYG_BASE_URL ?? ZAI_PAYG_BASE_URL,
    basetenApiKey: Process.env.BASETEN_API_KEY,
    basetenBaseUrl: Process.env.BASETEN_BASE_URL ?? BASETEN_BASE_URL,
    openaiClientId: Process.env.OPENAI_CLIENT_ID,
    codexRedirectUri: Process.env.NERO_CODEX_REDIRECT_URI,
    opencodeApiKey: Process.env.OPENCODE_API_KEY,
    opencodeBaseUrl: Process.env.OPENCODE_BASE_URL,
    routerTimeoutMs: ROUTER_TIMEOUT_MS,
    routerIdleMs: ROUTER_IDLE_MS,
    hostUrl: Process.env.NERO_HOST_URL,
    hostToken: Process.env.NERO_HOST_TOKEN,
    workspaceId: Process.env.NERO_WORKSPACE_ID,
  };
};

export const ensureDir = (dir: string): void => {
  Fs.mkdirSync(dir, { recursive: true });
};

export const writeJsonAtomic = (filePath: string, value: unknown): void => {
  ensureDir(Path.dirname(filePath));
  const tmp = `${filePath}.${Process.pid}.tmp`;
  Fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  Fs.renameSync(tmp, filePath);
};

export const readJson = (filePath: string): unknown | undefined => {
  try {
    return JSON.parse(Fs.readFileSync(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
};

export const djb2Hex = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0;
  }
  const hex = (hash >>> 0).toString(16);
  return hex.length === 0 ? "0" : hex;
};
