import * as Fs from "node:fs";
import * as Http from "node:http";
import * as Net from "node:net";
import * as Os from "node:os";
import * as Path from "node:path";

import { CommandId, EnvironmentId, ProjectId, ThreadId, WS_METHODS } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";

import { daemonLayer } from "./app.ts";
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

const httpJson = (
  port: number,
  method: string,
  pathname: string,
  body?: unknown,
): Promise<{ status: number; json: unknown; text: string }> =>
  new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = Http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          "content-type": "application/json",
          ...(payload === undefined ? {} : { "content-length": Buffer.byteLength(payload) }),
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
    if (payload !== undefined) request.write(payload);
    request.end();
  });

const rpcCall = (url: string, tag: string, payload: unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`RPC ${tag} timed out.`));
    }, 10_000);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          _tag: "Request",
          id: "1",
          tag,
          payload,
          headers: [],
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        const messages = Array.isArray(parsed) ? parsed : [parsed];
        for (const message of messages) {
          if (
            message !== null &&
            typeof message === "object" &&
            "_tag" in message &&
            (message as { _tag: string })._tag === "Exit"
          ) {
            const exit = (message as { exit: { _tag: string; value?: unknown; cause?: unknown } })
              .exit;
            clearTimeout(timer);
            socket.close();
            if (exit._tag === "Success") resolve(exit.value);
            else reject(new Error(`RPC ${tag} failed: ${JSON.stringify(exit)}`));
            return;
          }
        }
      } catch (error) {
        clearTimeout(timer);
        socket.close();
        reject(error);
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error calling ${tag}`));
    });
  });

describe("nero daemon", () => {
  it.live("creates a thread and reads/writes files without a display", () =>
    Effect.gen(function* () {
      const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-daemon-"));
      const workspaceRoot = Path.join(root, "workspace");
      const dataDir = Path.join(root, "data");
      Fs.mkdirSync(workspaceRoot, { recursive: true });
      const port = yield* Effect.promise(allocatePort);
      const { layer } = daemonLayer({
        host: "127.0.0.1",
        port,
        workspaceRoot,
        homeDir: root,
        dataDir,
        environmentId: EnvironmentId.make("nero"),
        label: "Nero test",
        devBypass: true,
        accessToken: undefined,
      });
      const fiber = yield* Effect.forkChild(Layer.launch(layer));
      yield* wait(250);

      const health = yield* Effect.promise(() => httpJson(port, "GET", "/healthz"));
      expect(health.status).toBe(200);
      expect(health.text).toBe("ok");

      const ticket = yield* Effect.promise(() =>
        httpJson(port, "POST", "/api/auth/websocket-ticket"),
      );
      expect(ticket.status).toBe(200);
      expect(ticket.json).toMatchObject({ ticket: expect.any(String) });

      const wsUrl = `ws://127.0.0.1:${port}/ws`;
      const config = yield* Effect.promise(() => rpcCall(wsUrl, WS_METHODS.serverGetConfig, {}));
      expect(config).toMatchObject({
        cwd: workspaceRoot,
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

      const shell = yield* Effect.promise(() => httpJson(port, "GET", "/api/orchestration/shell"));
      expect(shell.status).toBe(200);
      expect(shell.json).toMatchObject({
        threads: [expect.objectContaining({ id: threadId, title: "Test thread" })],
      });

      const written = yield* Effect.promise(() =>
        rpcCall(wsUrl, WS_METHODS.projectsWriteFile, {
          cwd: workspaceRoot,
          relativePath: "notes.txt",
          contents: "hello from nero",
        }),
      );
      expect(written).toMatchObject({ relativePath: "notes.txt" });
      expect(Fs.readFileSync(Path.join(workspaceRoot, "notes.txt"), "utf8")).toBe(
        "hello from nero",
      );

      const read = yield* Effect.promise(() =>
        rpcCall(wsUrl, WS_METHODS.projectsReadFile, {
          cwd: workspaceRoot,
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
        httpJson(port, "GET", `/api/orchestration/threads/${threadId}`),
      );
      expect(thread.status).toBe(200);
      expect(JSON.stringify(thread.json)).toContain("hello");
      expect(JSON.stringify(thread.json)).toContain("Nero v1 stub");

      yield* Fiber.interrupt(fiber);
    }),
  );
});
