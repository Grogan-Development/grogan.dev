import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import { createRequire } from "node:module";
import * as Os from "node:os";
import * as Process from "node:process";

import {
  TerminalCwdNotDirectoryError,
  TerminalCwdNotFoundError,
  TerminalSessionLookupError,
  type TerminalAttachInput,
  type TerminalAttachStreamEvent,
  type TerminalEvent,
  type TerminalOpenInput,
  type TerminalRestartInput,
  type TerminalSessionSnapshot,
  type TerminalSummary,
} from "@t3tools/contracts";

import { nowIso } from "./runtime.ts";

type PtyProcess = {
  readonly pid: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (exitCode: number | null, signal: number | null) => void) => void;
};

type NodePtyModule = {
  spawn: (
    file: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ) => {
    pid: number;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: (signal?: string) => void;
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: (event: { exitCode: number; signal?: number }) => void) => void;
  };
};

const nodeRequire = createRequire(import.meta.url);
let nodePty: NodePtyModule | undefined | null;

const loadNodePty = (): NodePtyModule | null => {
  if (nodePty !== undefined) return nodePty;
  try {
    nodePty = nodeRequire("node-pty") as NodePtyModule;
  } catch {
    nodePty = null;
  }
  return nodePty;
};

const defaultShell = (): string => {
  if (Process.platform === "win32") return Process.env.COMSPEC ?? "cmd.exe";
  return Process.env.SHELL ?? "/bin/bash";
};

const assertCwd = (cwd: string): void => {
  let stat: Fs.Stats;
  try {
    stat = Fs.statSync(cwd);
  } catch {
    throw new TerminalCwdNotFoundError({ cwd });
  }
  if (!stat.isDirectory()) {
    throw new TerminalCwdNotDirectoryError({ cwd });
  }
};

const spawnPty = (
  cwd: string,
  cols: number,
  rows: number,
  extraEnv: Record<string, string> | undefined,
  handlers: {
    readonly onData: (data: string) => void;
    readonly onExit: (exitCode: number | null, signal: number | null) => void;
  },
): PtyProcess => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(Process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.TERM = env.TERM ?? "xterm-256color";
  env.NERO_SEAT_LOCK = env.NERO_SEAT_LOCK ?? "/run/nero/seat.lock";
  if (extraEnv !== undefined) Object.assign(env, extraEnv);
  const pty = loadNodePty();
  if (pty !== null) {
    try {
      const proc = pty.spawn(defaultShell(), [], {
        name: "xterm-256color",
        cols,
        rows,
        cwd,
        env,
      });
      proc.onData(handlers.onData);
      proc.onExit((event) =>
        handlers.onExit(event.exitCode, event.signal === undefined ? null : event.signal),
      );
      return {
        pid: proc.pid,
        write: (data) => proc.write(data),
        resize: (c, r) => proc.resize(c, r),
        kill: () => proc.kill(),
        onData: (cb) => proc.onData(cb),
        onExit: (cb) =>
          proc.onExit((event) =>
            cb(event.exitCode, event.signal === undefined ? null : event.signal),
          ),
      };
    } catch {
      // Fall through to a pipe-backed shell when the native PTY cannot open.
    }
  }
  const child = ChildProcess.spawn(defaultShell(), [], {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pid = child.pid ?? 1;
  child.stdout?.on("data", (chunk: Buffer | string) => handlers.onData(String(chunk)));
  child.stderr?.on("data", (chunk: Buffer | string) => handlers.onData(String(chunk)));
  child.on("exit", (code, signal) => {
    const signalNumber =
      signal === null || signal === undefined
        ? null
        : (Os.constants.signals[signal as keyof typeof Os.constants.signals] ?? null);
    handlers.onExit(code, signalNumber);
  });
  return {
    pid,
    write: (data) => child.stdin?.write(data),
    resize: () => undefined,
    kill: () => child.kill(),
    onData: (cb) => {
      child.stdout?.on("data", (chunk: Buffer | string) => cb(String(chunk)));
      child.stderr?.on("data", (chunk: Buffer | string) => cb(String(chunk)));
    },
    onExit: (cb) => {
      child.on("exit", (code, signal) => {
        const signalNumber =
          signal === null || signal === undefined
            ? null
            : (Os.constants.signals[signal as keyof typeof Os.constants.signals] ?? null);
        cb(code, signalNumber);
      });
    },
  };
};

export type TerminalListener = (event: TerminalEvent | TerminalAttachStreamEvent) => void;

export type TerminalSession = {
  snapshot: TerminalSessionSnapshot;
  history: string;
  listeners: Set<TerminalListener>;
  pty: PtyProcess | undefined;
  sequence: number;
};

const sessionKey = (threadId: string, terminalId: string): string => `${threadId}::${terminalId}`;

export class TerminalHub {
  readonly sessions = new Map<string, TerminalSession>();
  readonly globalListeners = new Set<(event: TerminalEvent) => void>();
  readonly metadataListeners = new Set<
    (event: import("@t3tools/contracts").TerminalMetadataStreamEvent) => void
  >();

  private bump(session: TerminalSession): number {
    session.sequence += 1;
    session.snapshot = {
      ...session.snapshot,
      sequence: session.sequence,
      updatedAt: nowIso(),
    };
    return session.sequence;
  }

  private emit(session: TerminalSession, event: TerminalEvent): void {
    for (const listener of session.listeners) listener(event);
    for (const listener of this.globalListeners) listener(event);
    this.emitMetadata({ type: "upsert", terminal: this.summary(session) });
  }

  private emitMetadata(event: import("@t3tools/contracts").TerminalMetadataStreamEvent): void {
    for (const listener of this.metadataListeners) listener(event);
  }

  summary(session: TerminalSession): TerminalSummary {
    return {
      threadId: session.snapshot.threadId,
      terminalId: session.snapshot.terminalId,
      cwd: session.snapshot.cwd,
      worktreePath: session.snapshot.worktreePath,
      status: session.snapshot.status,
      pid: session.snapshot.pid,
      exitCode: session.snapshot.exitCode,
      exitSignal: session.snapshot.exitSignal,
      hasRunningSubprocess: session.snapshot.status === "running",
      label: session.snapshot.label,
      updatedAt: session.snapshot.updatedAt,
    };
  }

  list(): TerminalSummary[] {
    return [...this.sessions.values()].map((session) => this.summary(session));
  }

  get(threadId: string, terminalId: string): TerminalSession | undefined {
    return this.sessions.get(sessionKey(threadId, terminalId));
  }

  open(input: TerminalOpenInput): TerminalSessionSnapshot {
    const cols = input.cols ?? 80;
    const rows = input.rows ?? 24;
    const cwd = input.cwd;
    assertCwd(cwd);
    const existing = this.get(input.threadId, input.terminalId);
    if (existing?.pty !== undefined && existing.snapshot.status === "running") {
      existing.pty.resize(cols, rows);
      return existing.snapshot;
    }
    return this.spawn(
      input.threadId,
      input.terminalId,
      cwd,
      input.worktreePath ?? null,
      cols,
      rows,
      input.env,
    );
  }

  attach(input: TerminalAttachInput): TerminalSessionSnapshot {
    const existing = this.get(input.threadId, input.terminalId);
    if (existing !== undefined && existing.snapshot.status === "running") {
      return existing.snapshot;
    }
    if (input.restartIfNotRunning === false && existing !== undefined) {
      return existing.snapshot;
    }
    const cwd = input.cwd ?? existing?.snapshot.cwd;
    if (cwd === undefined) {
      throw new TerminalCwdNotFoundError({ cwd: input.cwd ?? "" });
    }
    return this.spawn(
      input.threadId,
      input.terminalId,
      cwd,
      input.worktreePath ?? existing?.snapshot.worktreePath ?? null,
      input.cols ?? 80,
      input.rows ?? 24,
      input.env,
    );
  }

  write(threadId: string, terminalId: string, data: string): void {
    const session = this.require(threadId, terminalId);
    session.pty?.write(data);
  }

  resize(threadId: string, terminalId: string, cols: number, rows: number): void {
    this.require(threadId, terminalId).pty?.resize(cols, rows);
  }

  clear(threadId: string, terminalId: string): void {
    const session = this.require(threadId, terminalId);
    session.history = "";
    session.snapshot = { ...session.snapshot, history: "" };
    const sequence = this.bump(session);
    this.emit(session, {
      type: "cleared",
      threadId,
      terminalId,
      sequence,
    });
  }

  restart(input: TerminalRestartInput): TerminalSessionSnapshot {
    const existing = this.get(input.threadId, input.terminalId);
    existing?.pty?.kill();
    return this.spawn(
      input.threadId,
      input.terminalId,
      input.cwd,
      input.worktreePath ?? null,
      input.cols,
      input.rows,
      input.env,
    );
  }

  close(
    threadId: string,
    terminalId: string | undefined,
    deleteHistory: boolean | undefined,
  ): void {
    if (terminalId === undefined) {
      for (const session of [...this.sessions.values()]) {
        if (session.snapshot.threadId === threadId) {
          this.close(threadId, session.snapshot.terminalId, deleteHistory);
        }
      }
      return;
    }
    const session = this.sessions.get(sessionKey(threadId, terminalId));
    if (session === undefined) return;
    session.pty?.kill();
    const sequence = this.bump(session);
    this.emit(session, { type: "closed", threadId, terminalId, sequence });
    this.emitMetadata({ type: "remove", threadId, terminalId });
    if (deleteHistory === true) {
      this.sessions.delete(sessionKey(threadId, terminalId));
    }
  }

  private require(threadId: string, terminalId: string): TerminalSession {
    const session = this.get(threadId, terminalId);
    if (session === undefined) {
      throw new TerminalSessionLookupError({ threadId, terminalId });
    }
    return session;
  }

  private spawn(
    threadId: string,
    terminalId: string,
    cwd: string,
    worktreePath: string | null,
    cols: number,
    rows: number,
    env: Record<string, string> | undefined,
  ): TerminalSessionSnapshot {
    assertCwd(cwd);
    const existing = this.get(threadId, terminalId);
    existing?.pty?.kill();
    const pending: string[] = [];
    let session: TerminalSession | undefined;
    const onData = (data: string) => {
      if (session === undefined) {
        pending.push(data);
        return;
      }
      session.history = `${session.history}${data}`.slice(-200_000);
      session.snapshot = { ...session.snapshot, history: session.history };
      const sequence = this.bump(session);
      this.emit(session, { type: "output", threadId, terminalId, sequence, data });
    };
    const onExit = (exitCode: number | null, exitSignal: number | null) => {
      if (session === undefined) return;
      session.pty = undefined;
      session.snapshot = {
        ...session.snapshot,
        status: "exited",
        pid: null,
        exitCode,
        exitSignal,
        updatedAt: nowIso(),
      };
      const sequence = this.bump(session);
      this.emit(session, { type: "exited", threadId, terminalId, sequence, exitCode, exitSignal });
    };
    const pty = spawnPty(cwd, cols, rows, env, { onData, onExit });
    const snapshot: TerminalSessionSnapshot = {
      threadId,
      terminalId,
      cwd,
      worktreePath,
      status: "running",
      pid: pty.pid,
      history: existing?.history ?? "",
      exitCode: null,
      exitSignal: null,
      label: defaultShell(),
      updatedAt: nowIso(),
      sequence: (existing?.sequence ?? 0) + 1,
    };
    session = {
      snapshot,
      history: snapshot.history,
      listeners: existing?.listeners ?? new Set(),
      pty,
      sequence: snapshot.sequence ?? 0,
    };
    this.sessions.set(sessionKey(threadId, terminalId), session);
    for (const data of pending) onData(data);
    this.emit(session, {
      type: "started",
      threadId,
      terminalId,
      sequence: session.sequence,
      snapshot,
    });
    return snapshot;
  }
}
