import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";
import * as Process from "node:process";

import { readProjectFile, resolveContained, writeProjectFile } from "./files.ts";
import { MAX_SHOT_BYTES, nextToken } from "./runtime.ts";

const DEFAULT_BASH_TIMEOUT_MS = 120_000;
const MAX_BASH_TIMEOUT_MS = 600_000;
const TOOL_OUTPUT_CAP = 32_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const BASH_ENV_ALLOW = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "DISPLAY",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
]);

const BASH_ENV_DENY = new Set([
  "ZAI_API_KEY",
  "BASETEN_API_KEY",
  "NERO_ACCESS_TOKEN",
  // Host control-plane wiring: the host token authorizes job-heartbeat for
  // ANY workspace id, so it must never reach agent bash.
  "NERO_HOST_TOKEN",
  "NERO_HOST_URL",
  "NERO_WORKSPACE_ID",
]);

export type ShotImage = {
  readonly mimeType: "image/png";
  readonly base64: string;
  readonly name: string;
};

export type ToolResult = {
  readonly text: string;
  readonly shots: ReadonlyArray<ShotImage>;
  readonly failed: boolean;
};

export type ToolContext = {
  readonly workspaceRoot: string;
  readonly homeDir: string;
  readonly signal: AbortSignal;
};

const truncate = (value: string): string => {
  if (value.length <= TOOL_OUTPUT_CAP) return value;
  return `${value.slice(0, TOOL_OUTPUT_CAP)}\n… truncated (${value.length} chars)`;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

export const parseToolArguments = (raw: string): Record<string, unknown> => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  const parsed: unknown = JSON.parse(trimmed);
  const record = asRecord(parsed);
  if (record === undefined) throw new Error("Tool arguments must be a JSON object.");
  return record;
};

const stringArg = (args: Record<string, unknown>, key: string): string | undefined => {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
};

const numberArg = (args: Record<string, unknown>, key: string): number | undefined => {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

export const isPngBuffer = (buffer: Buffer): boolean =>
  buffer.length >= PNG_MAGIC.length && buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);

export const shotFromPng = (buffer: Buffer, name: string): ShotImage | undefined => {
  if (!isPngBuffer(buffer)) return undefined;
  if (buffer.byteLength > MAX_SHOT_BYTES) return undefined;
  return {
    mimeType: "image/png",
    base64: buffer.toString("base64"),
    name,
  };
};

export const isNeroDesktopShotCommand = (command: string): boolean =>
  /\bnero-desktop(?:\s+\S+)*\s+shot\b/.test(command) || /\bnero-desktop\s+shot\b/.test(command);

export const parseShotOutPath = (command: string, cwd: string): string | undefined => {
  if (!isNeroDesktopShotCommand(command)) return undefined;
  const match = /--out(?:=|\s+)(\S+)/.exec(command);
  if (match === null) return undefined;
  const out = match[1];
  if (out === undefined || out === "-") return undefined;
  return Path.resolve(cwd, out);
};

export const rewriteShotCommand = (
  command: string,
  cwd: string,
): { readonly command: string; readonly outPath: string | undefined } => {
  if (!isNeroDesktopShotCommand(command))
    return { command, outPath: parseShotOutPath(command, cwd) };
  const existing = parseShotOutPath(command, cwd);
  if (existing !== undefined) return { command, outPath: existing };
  const dir = Path.join(cwd, ".nero-shots");
  Fs.mkdirSync(dir, { recursive: true });
  const outPath = Path.join(dir, `${nextToken("shot")}.png`);
  if (/--out(?:=|\s+)\S+/.test(command)) {
    return { command: command.replace(/--out(?:=|\s+)\S+/, `--out ${outPath}`), outPath };
  }
  return { command: command.replace(/\bshot\b/, `shot --out ${outPath}`), outPath };
};

export const bashEnv = (ctx: ToolContext): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(Process.env)) {
    if (value === undefined) continue;
    if (BASH_ENV_DENY.has(key)) continue;
    const allowNero = key.startsWith("NERO_") && key !== "NERO_ACCESS_TOKEN";
    if (!BASH_ENV_ALLOW.has(key) && !allowNero) continue;
    env[key] = value;
  }
  env.HOME = ctx.homeDir;
  env.PWD = ctx.workspaceRoot;
  env.NERO_WORKSPACE = ctx.workspaceRoot;
  delete env.ZAI_API_KEY;
  delete env.BASETEN_API_KEY;
  delete env.NERO_ACCESS_TOKEN;
  return env;
};

const fail = (text: string): ToolResult => ({ text, shots: [], failed: true });

const ok = (text: string, shots: ReadonlyArray<ShotImage> = []): ToolResult => ({
  text,
  shots,
  failed: false,
});

const readLines = (
  content: string,
  offset: number | undefined,
  limit: number | undefined,
): string => {
  if (offset === undefined && limit === undefined) return content;
  const lines = content.split("\n");
  const start = Math.max(0, (offset ?? 1) - 1);
  const end = limit === undefined ? lines.length : start + Math.max(0, Math.floor(limit));
  const slice = lines.slice(start, end);
  const numbered = slice.map((line, index) => `${start + index + 1}|${line}`);
  return numbered.join("\n");
};

const executeRead = (ctx: ToolContext, args: Record<string, unknown>): ToolResult => {
  const path = stringArg(args, "path");
  if (path === undefined || path.length === 0) return fail("read: `path` is required.");
  try {
    const result = readProjectFile({ cwd: ctx.workspaceRoot, relativePath: path });
    const offset = numberArg(args, "offset");
    const limit = numberArg(args, "limit");
    const body = readLines(result.contents, offset, limit);
    const suffix = result.truncated ? "\n… file truncated at 1MB" : "";
    return ok(truncate(body + suffix));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "read failed.");
  }
};

const executeWrite = (ctx: ToolContext, args: Record<string, unknown>): ToolResult => {
  const path = stringArg(args, "path");
  const content = stringArg(args, "content");
  if (path === undefined || path.length === 0) return fail("write: `path` is required.");
  if (content === undefined) return fail("write: `content` is required.");
  try {
    writeProjectFile({ cwd: ctx.workspaceRoot, relativePath: path, contents: content });
    return ok(`Wrote ${path} (${content.length} bytes).`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "write failed.");
  }
};

const executeEdit = (ctx: ToolContext, args: Record<string, unknown>): ToolResult => {
  const path = stringArg(args, "path");
  const oldString = stringArg(args, "old_string");
  const newString = stringArg(args, "new_string");
  const replaceAll = args.replace_all === true;
  if (path === undefined || path.length === 0) return fail("edit: `path` is required.");
  if (oldString === undefined) return fail("edit: `old_string` is required.");
  if (newString === undefined) return fail("edit: `new_string` is required.");
  if (oldString.length === 0) return fail("edit: `old_string` must not be empty.");
  const contained = resolveContained(ctx.workspaceRoot, path);
  if (!contained.ok) return fail("edit: path is outside the workspace root.");
  let existing: string;
  try {
    existing = Fs.readFileSync(contained.path, "utf8");
  } catch (error) {
    return fail(error instanceof Error ? `edit: ${error.message}` : "edit: failed to read file.");
  }
  const occurrences = existing.split(oldString).length - 1;
  if (occurrences === 0) return fail("edit: `old_string` not found.");
  if (!replaceAll && occurrences > 1) {
    return fail(`edit: old_string found ${occurrences} times; pass replace_all or uniquely match.`);
  }
  const next = replaceAll
    ? existing.split(oldString).join(newString)
    : existing.replace(oldString, newString);
  try {
    writeProjectFile({ cwd: ctx.workspaceRoot, relativePath: path, contents: next });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "edit: write failed.");
  }
  return ok(`Edited ${path} (${occurrences} replacement${occurrences === 1 ? "" : "s"}).`);
};

const isNeroRunCommand = (command: string): boolean => /\bnero-run\b/.test(command);

const killBashTree = (child: ChildProcess.ChildProcess, command: string): void => {
  if (isNeroRunCommand(command)) return;
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    Process.kill(-pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
};

const runBash = (
  ctx: ToolContext,
  command: string,
  timeoutMs: number,
): Promise<{ stdout: Buffer; stderr: Buffer; code: number | null }> =>
  new Promise((resolve, reject) => {
    if (ctx.signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const child = ChildProcess.spawn("bash", ["-c", command], {
      cwd: ctx.workspaceRoot,
      env: bashEnv(ctx),
      stdio: ["ignore", "pipe", "pipe"],
      detached: !isNeroRunCommand(command),
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const take = (target: Buffer[], chunk: Buffer, kind: "stdout" | "stderr") => {
      const cap = TOOL_OUTPUT_CAP * 4;
      if (kind === "stdout") {
        if (stdoutBytes >= cap) return;
        stdoutBytes += chunk.byteLength;
      } else {
        if (stderrBytes >= cap) return;
        stderrBytes += chunk.byteLength;
      }
      target.push(chunk);
    };
    child.stdout?.on("data", (chunk) => take(stdout, chunk as Buffer, "stdout"));
    child.stderr?.on("data", (chunk) => take(stderr, chunk as Buffer, "stderr"));
    let settled = false;
    const finish = (code: number | null, error?: Error) => {
      if (settled) return;
      settled = true;
      ctx.signal.removeEventListener("abort", onAbort);
      if (timer !== undefined) clearTimeout(timer);
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        code,
      });
    };
    const onAbort = () => {
      killBashTree(child, command);
      finish(null, new Error("aborted"));
    };
    ctx.signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      killBashTree(child, command);
      finish(null, new Error(`bash timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });

const executeBash = async (
  ctx: ToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> => {
  const command = stringArg(args, "command");
  if (command === undefined || command.trim().length === 0)
    return fail("bash: `command` is required.");
  const requested = numberArg(args, "timeout_ms");
  const timeoutMs = Math.min(
    MAX_BASH_TIMEOUT_MS,
    Math.max(1, requested === undefined ? DEFAULT_BASH_TIMEOUT_MS : Math.floor(requested)),
  );
  const prepared = rewriteShotCommand(command, ctx.workspaceRoot);
  try {
    const result = await runBash(ctx, prepared.command, timeoutMs);
    const shots: ShotImage[] = [];
    if (prepared.outPath !== undefined) {
      try {
        const fileShot = shotFromPng(
          Fs.readFileSync(prepared.outPath),
          Path.basename(prepared.outPath),
        );
        if (fileShot !== undefined) shots.push(fileShot);
      } catch {
        // shot --out path missing; bash output still returned
      }
    }
    const stdoutText = result.stdout.toString("utf8");
    const stderrText = result.stderr.toString("utf8");
    const parts = [
      `exit ${result.code ?? "killed"}`,
      stdoutText.length > 0 ? `stdout:\n${stdoutText}` : "stdout: (empty)",
      stderrText.length > 0 ? `stderr:\n${stderrText}` : undefined,
      shots.length > 0 ? "[png screenshot attached on the next model request]" : undefined,
    ].filter((part): part is string => part !== undefined);
    return {
      text: truncate(parts.join("\n")),
      shots,
      failed: result.code !== 0,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "aborted") throw error;
    return fail(error instanceof Error ? error.message : "bash failed.");
  }
};

export const executeTool = async (
  name: string,
  rawArguments: string,
  ctx: ToolContext,
): Promise<ToolResult> => {
  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(rawArguments);
  } catch (error) {
    return fail(`Invalid tool arguments: ${error instanceof Error ? error.message : "json"}`);
  }
  switch (name) {
    case "bash":
      return executeBash(ctx, args);
    case "read":
      return executeRead(ctx, args);
    case "write":
      return executeWrite(ctx, args);
    case "edit":
      return executeEdit(ctx, args);
    default:
      return fail(`Unknown tool ${name}.`);
  }
};

export const toolActivityMeta = (
  name: string,
  args: Record<string, unknown>,
): {
  readonly itemType: "command_execution" | "file_change" | "image_view";
  readonly requestKind: "command" | "file-read" | "file-change";
  readonly title: string;
  readonly detail: string;
  readonly command?: string;
  readonly path?: string;
} => {
  if (name === "bash") {
    const command = stringArg(args, "command") ?? "";
    return {
      itemType: "command_execution",
      requestKind: "command",
      title: "bash",
      detail: command,
      command,
    };
  }
  const path = stringArg(args, "path") ?? "";
  if (name === "read") {
    return {
      itemType: "file_change",
      requestKind: "file-read",
      title: "read",
      detail: path,
      path,
    };
  }
  return {
    itemType: "file_change",
    requestKind: "file-change",
    title: name,
    detail: path,
    path,
  };
};
