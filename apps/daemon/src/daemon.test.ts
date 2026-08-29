import * as Fs from "node:fs";
import * as Http from "node:http";
import * as Net from "node:net";
import * as Os from "node:os";
import * as Path from "node:path";

import {
  AuthAccessTokenType,
  AuthEnvironmentBootstrapTokenType,
  AuthTokenExchangeGrantType,
  CommandId,
  EnvironmentId,
  ProjectId,
  ThreadId,
  WS_METHODS,
} from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";

import { daemonLayer } from "./app.ts";
import type { DaemonOptions } from "./runtime.ts";
import { nowIso } from "./runtime.ts";

const allocatePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = Net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate a TCP port."));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });

const wait = (ms: number) =>
  Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)));

const httpRequest = (
  port: number,
  method: string,
  pathname: string,
  options: {
    readonly json?: unknown;
    readonly raw?: string;
    readonly headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; json: unknown; text: string }> =>
  new Promise((resolve, reject) => {
    const raw =
      options.raw ?? (options.json === undefined ? undefined : JSON.stringify(options.json));
    const contentType =
      options.headers?.["content-type"] ??
      (options.raw !== undefined ? "application/x-www-form-urlencoded" : "application/json");
    const request = Http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          "content-type": contentType,
          ...(raw === undefined ? {} : { "content-length": String(Buffer.byteLength(raw)) }),
          ...options.headers,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk as Buffer));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: unknown = text;
          try {
            json = text.length === 0 ? null : JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: response.statusCode ?? 0, json, text });
        });
      },
    );
    request.on("error", reject);
    if (raw !== undefined) request.write(raw);
    request.end();
  });

type RpcExit =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly exit: unknown };

const openRpc = (
  url: string,
): Promise<{
  request: (tag: string, payload: unknown) => Promise<RpcExit>;
  stream: (
    tag: string,
    payload: unknown,
    onValues: (values: unknown[]) => void,
  ) => { readonly requestId: string };
  close: () => void;
}> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map<string, (exit: RpcExit) => void>();
    const streams = new Map<string, (values: unknown[]) => void>();
    let nextId = 1;
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket open timed out."));
    }, 5_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve({
        request: (tag, payload) =>
          new Promise((resolveRequest) => {
            const id = String(nextId);
            nextId += 1;
            pending.set(id, resolveRequest);
            socket.send(
              JSON.stringify({
                _tag: "Request",
                id,
                tag,
                payload,
                headers: [],
              }),
            );
          }),
        stream: (tag, payload, onValues) => {
          const id = String(nextId);
          nextId += 1;
          streams.set(id, onValues);
          socket.send(
            JSON.stringify({
              _tag: "Request",
              id,
              tag,
              payload,
              headers: [],
            }),
          );
          return { requestId: id };
        },
        close: () => {
          socket.close();
        },
      });
    });
    socket.addEventListener("message", (event) => {
      const parsed = JSON.parse(String(event.data)) as unknown;
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      for (const message of messages) {
        if (message === null || typeof message !== "object" || !("_tag" in message)) continue;
        const tagged = message as {
          _tag: string;
          requestId?: string | number;
          values?: unknown[];
          exit?: { _tag: string; value?: unknown };
        };
        if (tagged._tag === "Chunk" && tagged.requestId !== undefined) {
          const id = String(tagged.requestId);
          streams.get(id)?.(tagged.values ?? []);
          socket.send(JSON.stringify({ _tag: "Ack", requestId: tagged.requestId }));
        }
        if (tagged._tag === "Exit" && tagged.requestId !== undefined) {
          const id = String(tagged.requestId);
          const done = pending.get(id);
          pending.delete(id);
          const exit = tagged.exit;
          if (exit?._tag === "Success") done?.({ ok: true, value: exit.value });
          else done?.({ ok: false, exit });
        }
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("WebSocket error."));
    });
  });

const rpcCall = async (url: string, tag: string, payload: unknown): Promise<unknown> => {
  const conn = await openRpc(url);
  try {
    const result = await conn.request(tag, payload);
    if (!result.ok) throw new Error(`RPC ${tag} failed: ${JSON.stringify(result.exit)}`);
    return result.value;
  } finally {
    conn.close();
  }
};

const launch = (options: DaemonOptions) =>
  Effect.gen(function* () {
    const { layer } = daemonLayer(options);
    const fiber = yield* Effect.forkChild(Layer.launch(layer));
    yield* wait(250);
    return fiber;
  });

const tmpDaemon = (port: number, extra: Partial<DaemonOptions> = {}) => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-daemon-"));
  const workspaceRoot = Path.join(root, "workspace");
  const dataDir = Path.join(root, "data");
  Fs.mkdirSync(workspaceRoot, { recursive: true });
  return {
    root,
    workspaceRoot,
    dataDir,
    options: {
      host: "127.0.0.1",
      port,
      workspaceRoot,
      homeDir: root,
      dataDir,
      environmentId: EnvironmentId.make("nero"),
      label: "Nero test",
      devBypass: false,
      accessToken: undefined,
      ...extra,
    } satisfies DaemonOptions,
  };
};

describe("nero daemon", () => {
  it.live("creates a thread and reads/writes files without a display", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { devBypass: true });
      const fiber = yield* launch(tmp.options);

      const health = yield* Effect.promise(() => httpRequest(port, "GET", "/healthz"));
      expect(health.status).toBe(200);
      expect(health.text).toBe("ok");

      const ticket = yield* Effect.promise(() =>
        httpRequest(port, "POST", "/api/auth/websocket-ticket"),
      );
      expect(ticket.status).toBe(200);
      expect(ticket.json).toMatchObject({ ticket: expect.any(String) });

      const wsUrl = `ws://127.0.0.1:${port}/ws`;
      const config = yield* Effect.promise(() => rpcCall(wsUrl, WS_METHODS.serverGetConfig, {}));
      expect(config).toMatchObject({
        cwd: tmp.workspaceRoot,
        providers: [expect.objectContaining({ instanceId: "nero", driver: "nero" })],
      });
      expect(
        (config as { providers: { models: { slug: string }[] }[] }).providers[0]?.models[0]?.slug,
      ).toBe("z-ai/glm-5.3-flash");

      const threadId = "thread-test-1";
      const created = yield* Effect.promise(() =>
        rpcCall(wsUrl, "orchestration.dispatchCommand", {
          type: "thread.create",
          commandId: CommandId.make("cmd-create"),
          threadId: ThreadId.make(threadId),
          projectId: ProjectId.make("workspace"),
          title: "Test thread",
          modelSelection: { instanceId: "nero", model: "z-ai/glm-5.3-flash" },
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: nowIso(),
        }),
      );
      expect(created).toMatchObject({ sequence: expect.any(Number) });

      const shell = yield* Effect.promise(() =>
        httpRequest(port, "GET", "/api/orchestration/shell"),
      );
      expect(shell.status).toBe(200);
      expect(shell.json).toMatchObject({
        threads: [expect.objectContaining({ id: threadId, title: "Test thread" })],
      });

      const written = yield* Effect.promise(() =>
        rpcCall(wsUrl, WS_METHODS.projectsWriteFile, {
          cwd: tmp.workspaceRoot,
          relativePath: "notes.txt",
          contents: "hello from nero",
        }),
      );
      expect(written).toMatchObject({ relativePath: "notes.txt" });
      expect(Fs.readFileSync(Path.join(tmp.workspaceRoot, "notes.txt"), "utf8")).toBe(
        "hello from nero",
      );

      const read = yield* Effect.promise(() =>
        rpcCall(wsUrl, WS_METHODS.projectsReadFile, {
          cwd: tmp.workspaceRoot,
          relativePath: "notes.txt",
        }),
      );
      expect(read).toMatchObject({
        relativePath: "notes.txt",
        contents: "hello from nero",
        truncated: false,
      });

      const turn = yield* Effect.promise(() =>
        rpcCall(wsUrl, "orchestration.dispatchCommand", {
          type: "thread.turn.start",
          commandId: CommandId.make("cmd-turn"),
          threadId: ThreadId.make(threadId),
          message: {
            messageId: "msg-user-1",
            role: "user",
            text: "hello",
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: nowIso(),
        }),
      );
      expect(turn).toMatchObject({ sequence: expect.any(Number) });

      const thread = yield* Effect.promise(() =>
        httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
      );
      expect(thread.status).toBe(200);
      expect(JSON.stringify(thread.json)).toContain("hello");
      expect(JSON.stringify(thread.json)).toContain("Nero v1 stub");

      yield* Fiber.interrupt(fiber);
    }),
  );

  it.live("rejects unauthenticated session mint, tickets, and /ws", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { devBypass: false, accessToken: undefined });
      const fiber = yield* launch(tmp.options);

      const ticket = yield* Effect.promise(() =>
        httpRequest(port, "POST", "/api/auth/websocket-ticket"),
      );
      expect(ticket.status).toBe(401);

      const wsHttp = yield* Effect.promise(() => httpRequest(port, "GET", "/ws"));
      expect(wsHttp.status).toBe(401);

      const browser = yield* Effect.promise(() =>
        httpRequest(port, "POST", "/api/auth/browser-session", { json: {} }),
      );
      expect(browser.status).toBe(401);

      const token = yield* Effect.promise(() => httpRequest(port, "POST", "/oauth/token"));
      expect(token.status).toBe(401);

      yield* Fiber.interrupt(fiber);
    }),
  );

  it.live("mints a one-use wsTicket from NERO_ACCESS_TOKEN", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { devBypass: false, accessToken: "caddy-secret" });
      const fiber = yield* launch(tmp.options);

      const exchanged = yield* Effect.promise(() =>
        httpRequest(port, "POST", "/oauth/token", {
          raw: new URLSearchParams({
            grant_type: AuthTokenExchangeGrantType,
            subject_token: "caddy-secret",
            subject_token_type: AuthEnvironmentBootstrapTokenType,
            requested_token_type: AuthAccessTokenType,
          }).toString(),
          headers: { "content-type": "application/x-www-form-urlencoded" },
        }),
      );
      expect(exchanged.status).toBe(200);
      const accessToken = (exchanged.json as { access_token: string }).access_token;
      expect(accessToken.length).toBeGreaterThan(0);

      const ticketRes = yield* Effect.promise(() =>
        httpRequest(port, "POST", "/api/auth/websocket-ticket", {
          headers: { authorization: `Bearer ${accessToken}` },
        }),
      );
      expect(ticketRes.status).toBe(200);
      const ticket = (ticketRes.json as { ticket: string }).ticket;

      const first = yield* Effect.promise(() =>
        rpcCall(
          `ws://127.0.0.1:${port}/ws?wsTicket=${encodeURIComponent(ticket)}`,
          WS_METHODS.serverProbe,
          {},
        ),
      );
      expect(first).toEqual({});

      const reuse = yield* Effect.promise(
        () =>
          new Promise<"failed" | "opened">((resolve) => {
            const socket = new WebSocket(
              `ws://127.0.0.1:${port}/ws?wsTicket=${encodeURIComponent(ticket)}`,
            );
            const timer = setTimeout(() => {
              socket.close();
              resolve("failed");
            }, 2_000);
            socket.addEventListener("open", () => {
              clearTimeout(timer);
              socket.close();
              resolve("opened");
            });
            socket.addEventListener("error", () => {
              clearTimeout(timer);
              resolve("failed");
            });
            socket.addEventListener("close", () => {
              clearTimeout(timer);
              resolve("failed");
            });
          }),
      );
      expect(reuse).toBe("failed");

      yield* Fiber.interrupt(fiber);
    }),
  );

  it.live("lists nested files and keeps the socket after an unknown RPC tag", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { devBypass: true });
      Fs.mkdirSync(Path.join(tmp.workspaceRoot, "src"), { recursive: true });
      Fs.writeFileSync(Path.join(tmp.workspaceRoot, "src", "lib.ts"), "export const x = 1;\n");
      const fiber = yield* launch(tmp.options);

      const wsUrl = `ws://127.0.0.1:${port}/ws`;
      const listed = (yield* Effect.promise(() =>
        rpcCall(wsUrl, WS_METHODS.projectsListEntries, { cwd: tmp.workspaceRoot }),
      )) as { entries: { path: string; kind: string }[] };
      expect(
        listed.entries.some((entry) => entry.path === "src" && entry.kind === "directory"),
      ).toBe(true);
      expect(
        listed.entries.some(
          (entry) => entry.path === Path.join("src", "lib.ts") && entry.kind === "file",
        ),
      ).toBe(true);

      const conn = yield* Effect.promise(() => openRpc(wsUrl));
      const unknown = yield* Effect.promise(() => conn.request("not.a.method", {}));
      expect(unknown.ok).toBe(false);
      const probe = yield* Effect.promise(() => conn.request(WS_METHODS.serverProbe, {}));
      expect(probe).toEqual({ ok: true, value: {} });
      conn.close();

      yield* Fiber.interrupt(fiber);
    }),
  );

  it.live("opens a PTY and attaches output without a display", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { devBypass: true });
      const fiber = yield* launch(tmp.options);
      const conn = yield* Effect.promise(() => openRpc(`ws://127.0.0.1:${port}/ws`));

      const opened = yield* Effect.promise(() =>
        conn.request(WS_METHODS.terminalOpen, {
          threadId: "thread-pty",
          terminalId: "term-1",
          cwd: tmp.workspaceRoot,
          cols: 80,
          rows: 24,
        }),
      );
      expect(opened, JSON.stringify(opened)).toMatchObject({ ok: true });

      const chunks: unknown[] = [];
      conn.stream(
        WS_METHODS.terminalAttach,
        {
          threadId: "thread-pty",
          terminalId: "term-1",
          cwd: tmp.workspaceRoot,
        },
        (values) => {
          chunks.push(...values);
        },
      );

      yield* Effect.promise(() =>
        conn.request(WS_METHODS.terminalWrite, {
          threadId: "thread-pty",
          terminalId: "term-1",
          data: "echo nero-pty-marker\n",
        }),
      );

      const seen = yield* Effect.promise(async () => {
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline) {
          if (JSON.stringify(chunks).includes("nero-pty-marker")) return true;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return false;
      });
      expect(seen).toBe(true);

      yield* Effect.promise(() =>
        conn.request(WS_METHODS.terminalClose, {
          threadId: "thread-pty",
          terminalId: "term-1",
        }),
      );
      conn.close();
      yield* Fiber.interrupt(fiber);
    }),
  );
});
