import * as Fs from "node:fs";
import * as Http from "node:http";
import * as Os from "node:os";
import * as Path from "node:path";
import * as Process from "node:process";

import { CommandId, EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";

import { daemonLayer } from "./app.ts";
import type { DaemonOptions } from "./runtime.ts";
import { NERO_MODEL, nowIso } from "./runtime.ts";

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const wait = (ms: number) =>
  Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)));

const httpRequest = (
  port: number,
  method: string,
  pathname: string,
  options: { readonly json?: unknown } = {},
): Promise<{ status: number; json: unknown; text: string }> =>
  new Promise((resolve, reject) => {
    const raw = options.json === undefined ? undefined : JSON.stringify(options.json);
    const request = Http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          "content-type": "application/json",
          ...(raw === undefined ? {} : { "content-length": String(Buffer.byteLength(raw)) }),
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

const launch = (options: DaemonOptions) =>
  Effect.gen(function* () {
    const { layer } = daemonLayer(options);
    const fiber = yield* Effect.forkChild(Layer.launch(layer));
    yield* wait(250);
    return fiber;
  });

const tmpDaemon = (port: number, extra: Partial<DaemonOptions> = {}) => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-harness-"));
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
      devBypass: true,
      accessToken: undefined,
      seatLockPath: Path.join(root, "seat.lock"),
      seatHoldBin: "nero-desktop",
      vncOrigin: "http://127.0.0.1:8444",
      openRouterApiKey: "test-openrouter-key",
      openRouterBaseUrl: "https://openrouter.ai/api/v1",
      openRouterTimeoutMs: 120_000,
      openRouterIdleMs: 45_000,
      hostUrl: undefined,
      hostToken: undefined,
      workspaceId: undefined,
      ...extra,
    } satisfies DaemonOptions,
  };
};

const allocatePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = Http.createServer();
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
    server.on("error", reject);
  });

type CapturedRequest = {
  readonly authorization: string | undefined;
  readonly body: unknown;
};

const sse = (events: ReadonlyArray<unknown>): string =>
  `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;

const textChunk = (content: string) => ({
  id: "chatcmpl-nero",
  object: "chat.completion.chunk",
  model: NERO_MODEL,
  choices: [{ index: 0, delta: { content }, finish_reason: null }],
});

const toolCallChunk = (id: string, name: string, args: string) => ({
  id: "chatcmpl-nero",
  object: "chat.completion.chunk",
  model: NERO_MODEL,
  choices: [
    {
      index: 0,
      delta: {
        tool_calls: [
          {
            index: 0,
            id,
            type: "function",
            function: { name, arguments: args },
          },
        ],
      },
      finish_reason: null,
    },
  ],
});

const finishChunk = (reason: string) => ({
  id: "chatcmpl-nero",
  object: "chat.completion.chunk",
  model: NERO_MODEL,
  choices: [{ index: 0, delta: {}, finish_reason: reason }],
});

type FakeReply = string | { readonly hang: true } | { readonly write: string; readonly hold: true };

const startFakeOpenRouter = (
  handler: (captured: CapturedRequest, index: number) => Promise<FakeReply> | FakeReply,
): Promise<{ port: number; captured: CapturedRequest[]; close: () => Promise<void> }> =>
  new Promise((resolve, reject) => {
    const captured: CapturedRequest[] = [];
    const hanging: Http.ServerResponse[] = [];
    const server = Http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk as Buffer));
      request.on("end", () => {
        void (async () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let body: unknown = raw;
          try {
            body = raw.length === 0 ? null : JSON.parse(raw);
          } catch {
            body = raw;
          }
          const item: CapturedRequest = {
            authorization: request.headers.authorization,
            body,
          };
          captured.push(item);
          try {
            const payload = await handler(item, captured.length - 1);
            if (typeof payload === "object" && "hang" in payload) {
              hanging.push(response);
              return;
            }
            response.writeHead(200, {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
            });
            if (typeof payload === "object" && "hold" in payload) {
              hanging.push(response);
              response.write(payload.write);
              return;
            }
            response.end(payload);
          } catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(
              JSON.stringify({ error: error instanceof Error ? error.message : "fail" }),
            );
          }
        })();
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Failed to bind fake OpenRouter."));
        return;
      }
      resolve({
        port: address.port,
        captured,
        close: () =>
          new Promise((resolveClose) => {
            for (const held of hanging) held.destroy();
            server.close(() => resolveClose());
          }),
      });
    });
    server.on("error", reject);
  });

const poll = async <T>(
  read: () => Promise<T> | T,
  pred: (value: T) => boolean,
  ms = 10_000,
): Promise<T> => {
  const deadline = Date.now() + ms;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (pred(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`timed out waiting for condition; last=${JSON.stringify(last)?.slice(0, 500)}`);
};

const startUserTurn = (port: number, threadId: string, text: string, commandId: string) =>
  httpRequest(port, "POST", "/api/orchestration/dispatch", {
    json: {
      type: "thread.turn.start",
      commandId: CommandId.make(commandId),
      threadId: ThreadId.make(threadId),
      message: {
        messageId: `msg-${commandId}`,
        role: "user",
        text,
        attachments: [],
      },
      runtimeMode: "full-access",
      interactionMode: "default",
      createdAt: nowIso(),
    },
  });

const createThread = (port: number, threadId: string) =>
  httpRequest(port, "POST", "/api/orchestration/dispatch", {
    json: {
      type: "thread.create",
      commandId: CommandId.make(`cmd-create-${threadId}`),
      threadId: ThreadId.make(threadId),
      projectId: ProjectId.make("workspace"),
      title: "Harness thread",
      modelSelection: { instanceId: "nero", model: NERO_MODEL },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: nowIso(),
    },
  });

describe("pi harness", () => {
  it.live("streams GLM-5.3-Flash via OpenRouter Baseten and executes a tool_call", () =>
    Effect.gen(function* () {
      let releaseFirst: (() => void) | undefined;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const fake = yield* Effect.promise(() =>
        startFakeOpenRouter(async (_captured, index) => {
          if (index === 0) {
            await firstGate;
            return sse([
              textChunk("Working"),
              textChunk(" now."),
              toolCallChunk(
                "call_marker",
                "bash",
                JSON.stringify({ command: "printf 'harness-ok' > marker.txt" }),
              ),
              finishChunk("tool_calls"),
            ]);
          }
          return sse([textChunk("Created "), textChunk("marker.txt."), finishChunk("stop")]);
        }),
      );
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, {
        openRouterBaseUrl: `http://127.0.0.1:${fake.port}/api/v1`,
        openRouterApiKey: "test-openrouter-key",
      });
      const fiber = yield* launch(tmp.options);
      const threadId = "thread-harness-1";
      yield* Effect.promise(() => createThread(port, threadId));
      const turn = yield* Effect.promise(() =>
        startUserTurn(port, threadId, "write a marker", "cmd-turn-1"),
      );
      expect(turn.status).toBe(200);

      try {
        const keepAwake = JSON.parse(
          Fs.readFileSync(Path.join(tmp.dataDir, "keep-awake.json"), "utf8"),
        ) as { liveTurns: unknown[] };
        expect(keepAwake.liveTurns).toHaveLength(1);
      } finally {
        releaseFirst?.();
      }

      const snapshot = yield* Effect.promise(() =>
        poll(
          () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
          (response) => JSON.stringify(response.json).includes("Created marker.txt"),
        ),
      );
      expect(snapshot.status).toBe(200);
      const encoded = JSON.stringify(snapshot.json);
      expect(encoded).toContain("Working now.");
      expect(encoded).toContain("Created marker.txt");
      expect(Fs.readFileSync(Path.join(tmp.workspaceRoot, "marker.txt"), "utf8")).toBe(
        "harness-ok",
      );

      expect(fake.captured.length).toBeGreaterThanOrEqual(2);
      const first = fake.captured[0];
      expect(first?.authorization).toBe("Bearer test-openrouter-key");
      expect(first?.body).toMatchObject({
        model: NERO_MODEL,
        stream: true,
        provider: { only: ["baseten"], allow_fallbacks: false },
      });
      expect(JSON.stringify(first?.body)).toContain('"name":"bash"');

      const idle = JSON.parse(
        Fs.readFileSync(Path.join(tmp.dataDir, "keep-awake.json"), "utf8"),
      ) as {
        liveTurns: unknown[];
      };
      expect(idle.liveTurns).toHaveLength(0);

      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => fake.close());
    }),
  );

  it.live("attaches shot PNGs on the subsequent OpenRouter turn (max 8)", () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() =>
        startFakeOpenRouter((_captured, index) => {
          if (index === 0) {
            return sse([
              textChunk("Shooting."),
              toolCallChunk("call_shot", "bash", JSON.stringify({ command: "nero-desktop shot" })),
              finishChunk("tool_calls"),
            ]);
          }
          return sse([textChunk("I see the seat."), finishChunk("stop")]);
        }),
      );

      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, {
        openRouterBaseUrl: `http://127.0.0.1:${fake.port}/api/v1`,
        openRouterApiKey: "test-openrouter-key",
      });
      const bin = Path.join(tmp.root, "bin");
      Fs.mkdirSync(bin, { recursive: true });
      const pngPath = Path.join(tmp.root, "dot.png");
      Fs.writeFileSync(pngPath, PNG_1x1);
      Fs.writeFileSync(
        Path.join(bin, "nero-desktop"),
        `#!/bin/sh
cmd="$1"
shift
if [ "$cmd" != "shot" ]; then
  echo "unknown $cmd" >&2
  exit 1
fi
out="-"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ "$out" = "-" ]; then
  cat ${JSON.stringify(pngPath)}
else
  cp ${JSON.stringify(pngPath)} "$out"
fi
`,
        { mode: 0o755 },
      );
      const previousPath = Process.env.PATH ?? "";
      Process.env.PATH = `${bin}${Path.delimiter}${previousPath}`;

      const fiber = yield* launch(tmp.options);
      try {
        const threadId = "thread-shot-1";
        yield* Effect.promise(() => createThread(port, threadId));
        yield* Effect.promise(() =>
          startUserTurn(port, threadId, "take a screenshot", "cmd-shot-1"),
        );

        const snapshot = yield* Effect.promise(() =>
          poll(
            () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
            (response) => JSON.stringify(response.json).includes("I see the seat."),
          ),
        );
        expect(JSON.stringify(snapshot.json)).toContain("I see the seat.");

        expect(fake.captured.length).toBeGreaterThanOrEqual(2);
        const followUp = JSON.stringify(fake.captured[1]?.body ?? {});
        expect(followUp).toContain("data:image/png;base64,");
        expect(followUp).toContain(PNG_1x1.toString("base64"));
        const firstTool = JSON.stringify(fake.captured[0]?.body ?? {});
        expect(firstTool).toContain("nero-desktop shot");
      } finally {
        Process.env.PATH = previousPath;
        yield* Fiber.interrupt(fiber);
        yield* Effect.promise(() => fake.close());
      }
    }),
  );

  it.live("interrupts a mid-stream turn and does not leave streaming:true", () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() =>
        startFakeOpenRouter(() => ({
          write: sse([textChunk("Working")]).replace("data: [DONE]\n\n", ""),
          hold: true,
        })),
      );
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, {
        openRouterBaseUrl: `http://127.0.0.1:${fake.port}/api/v1`,
        openRouterApiKey: "test-openrouter-key",
      });
      const fiber = yield* launch(tmp.options);
      const threadId = "thread-interrupt-1";
      yield* Effect.promise(() => createThread(port, threadId));
      yield* Effect.promise(() => startUserTurn(port, threadId, "hello", "cmd-int-1"));
      yield* Effect.promise(() =>
        poll(
          () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
          (response) => JSON.stringify(response.json).includes("Working"),
        ),
      );
      yield* Effect.promise(() =>
        httpRequest(port, "POST", "/api/orchestration/dispatch", {
          json: {
            type: "thread.turn.interrupt",
            commandId: CommandId.make("cmd-int-stop"),
            threadId: ThreadId.make(threadId),
            createdAt: nowIso(),
          },
        }),
      );
      const snapshot = yield* Effect.promise(() =>
        poll(
          () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
          (response) => {
            const body = JSON.stringify(response.json);
            if (!body.includes("Working")) return false;
            const thread = (response.json as { thread?: { messages?: { streaming?: boolean }[] } })
              .thread;
            return thread?.messages?.every((message) => message.streaming !== true) === true;
          },
        ),
      );
      const thread = (snapshot.json as { thread: { messages: { streaming: boolean }[] } }).thread;
      expect(thread.messages.every((message) => message.streaming === false)).toBe(true);
      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => fake.close());
    }),
  );

  it.live("a second turn settles the first and does not leave streaming:true", () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() =>
        startFakeOpenRouter((_captured, index) => {
          if (index === 0) return { hang: true };
          return sse([textChunk("Second turn done."), finishChunk("stop")]);
        }),
      );
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, {
        openRouterBaseUrl: `http://127.0.0.1:${fake.port}/api/v1`,
        openRouterApiKey: "test-openrouter-key",
      });
      const fiber = yield* launch(tmp.options);
      const threadId = "thread-supersede-1";
      yield* Effect.promise(() => createThread(port, threadId));
      yield* Effect.promise(() => startUserTurn(port, threadId, "first", "cmd-first"));
      yield* Effect.promise(() =>
        poll(
          () => fake.captured.length,
          (count) => count >= 1,
        ),
      );
      yield* Effect.promise(() => startUserTurn(port, threadId, "second", "cmd-second"));
      const snapshot = yield* Effect.promise(() =>
        poll(
          () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
          (response) => JSON.stringify(response.json).includes("Second turn done."),
        ),
      );
      const thread = (
        snapshot.json as {
          thread: { messages: { streaming: boolean }[]; session: { status: string } };
        }
      ).thread;
      expect(thread.messages.every((message) => message.streaming === false)).toBe(true);
      expect(thread.session.status).toBe("ready");
      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => fake.close());
    }),
  );

  it.live("times out a hung OpenRouter socket and clears keep-awake", () =>
    Effect.gen(function* () {
      const fake = yield* Effect.promise(() => startFakeOpenRouter(() => ({ hang: true })));
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, {
        openRouterBaseUrl: `http://127.0.0.1:${fake.port}/api/v1`,
        openRouterApiKey: "test-openrouter-key",
        openRouterTimeoutMs: 250,
        openRouterIdleMs: 150,
      });
      const fiber = yield* launch(tmp.options);
      const threadId = "thread-timeout-1";
      yield* Effect.promise(() => createThread(port, threadId));
      yield* Effect.promise(() => startUserTurn(port, threadId, "hang", "cmd-hang"));
      const snapshot = yield* Effect.promise(() =>
        poll(
          () => httpRequest(port, "GET", `/api/orchestration/threads/${threadId}`),
          (response) => {
            const body = JSON.stringify(response.json);
            return body.includes("timeout") || body.includes("OpenRouter");
          },
          8_000,
        ),
      );
      expect(JSON.stringify(snapshot.json)).toMatch(/timeout|OpenRouter/);
      const idle = yield* Effect.promise(() =>
        poll(
          () =>
            JSON.parse(Fs.readFileSync(Path.join(tmp.dataDir, "keep-awake.json"), "utf8")) as {
              liveTurns: unknown[];
            },
          (state) => state.liveTurns.length === 0,
        ),
      );
      expect(idle.liveTurns).toHaveLength(0);
      yield* Fiber.interrupt(fiber);
      yield* Effect.promise(() => fake.close());
    }),
  );

  it.live("clears stale keep-awake liveTurns on daemon start", () =>
    Effect.gen(function* () {
      const port = yield* Effect.promise(allocatePort);
      const tmp = tmpDaemon(port, { openRouterApiKey: undefined });
      Fs.mkdirSync(tmp.dataDir, { recursive: true });
      Fs.writeFileSync(
        Path.join(tmp.dataDir, "keep-awake.json"),
        `${JSON.stringify({
          version: 1,
          liveTurns: [{ threadId: "ghost", turnId: "trn_old", updatedAt: nowIso() }],
          updatedAt: nowIso(),
        })}\n`,
      );
      const fiber = yield* launch(tmp.options);
      const keepAwake = JSON.parse(
        Fs.readFileSync(Path.join(tmp.dataDir, "keep-awake.json"), "utf8"),
      ) as { liveTurns: unknown[] };
      expect(keepAwake.liveTurns).toEqual([]);
      yield* Fiber.interrupt(fiber);
    }),
  );
});
