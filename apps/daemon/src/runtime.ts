import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";
import * as Process from "node:process";

import type { EnvironmentId } from "@t3tools/contracts";
import { EnvironmentId as EnvironmentIdSchema } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export const NERO_MODEL = "z-ai/glm-5.3-flash";
export const NERO_DRIVER = "nero";
export const NERO_INSTANCE_ID = "nero";
export const SESSION_COOKIE = "nero_session";
export const DAEMON_VERSION = "0.1.0";

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
