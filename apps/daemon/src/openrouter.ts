import * as Http from "node:http";
import * as Https from "node:https";
import { URL } from "node:url";

import {
  NERO_MODEL,
  OPENROUTER_IDLE_MS,
  OPENROUTER_PROVIDER_ONLY,
  OPENROUTER_TIMEOUT_MS,
} from "./runtime.ts";

export type TextPart = {
  readonly type: "text";
  readonly text: string;
};

export type ImagePart = {
  readonly type: "image_url";
  readonly image_url: { readonly url: string };
};

export type ContentPart = TextPart | ImagePart;

export type ToolCall = {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
};

export type ChatMessage =
  | { readonly role: "system"; readonly content: string }
  | { readonly role: "user"; readonly content: string | ReadonlyArray<ContentPart> }
  | {
      readonly role: "assistant";
      readonly content: string | null;
      readonly tool_calls?: ReadonlyArray<ToolCall>;
    }
  | { readonly role: "tool"; readonly tool_call_id: string; readonly content: string };

export const OPENROUTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Run a shell command in the workspace root. Drive the graphical seat with `nero-desktop shot|click|type|key`. Start long jobs with `nero-run` so they keep the workspace awake after this turn.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run." },
          timeout_ms: {
            type: "number",
            description: "Optional timeout in milliseconds (default 120000, max 600000).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read",
      description: "Read a UTF-8 file under the workspace root.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path relative to the workspace root, or absolute inside it.",
          },
          offset: { type: "number", description: "1-indexed start line (optional)." },
          limit: { type: "number", description: "Max lines to return (optional)." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Write a UTF-8 file under the workspace root, creating parent directories.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit",
      description:
        "Replace `old_string` with `new_string` in a workspace file. `old_string` must be unique unless `replace_all` is true.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
          replace_all: { type: "boolean" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
] as const;

export const systemPrompt = (workspaceRoot: string): string =>
  `You are Nero, a Pi-like coding agent in a single shared workspace.

Workspace root: ${workspaceRoot}
File tools (read/write/edit) cannot leave that root. bash starts there.

Tools: bash, read, write, edit.
Seat CLI via bash:
  nero-desktop shot [--out PATH]
  nero-desktop click X Y [--button left|middle|right] [--double]
  nero-desktop type TEXT
  nero-desktop key KEY [KEY...]
shot captures a PNG; it is attached on the next model request (max 8 images).
Long jobs: \`nero-run COMMAND\` so the workspace stays awake after this turn.

Prefer tools over questions. Be concise.`;

export const chatCompletionsUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

export type StreamChatInput = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly signal: AbortSignal;
  readonly onText: (delta: string) => void;
  readonly timeoutMs?: number;
  readonly idleMs?: number;
};

export type StreamChatResult = {
  readonly content: string;
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly finishReason: string | null;
};

type AccTool = {
  id: string;
  name: string;
  arguments: string;
};

const applyToolDelta = (
  tools: AccTool[],
  delta: {
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  },
): void => {
  const index =
    typeof delta.index === "number" ? delta.index : tools.length === 0 ? 0 : tools.length - 1;
  const current = tools[index] ?? { id: "", name: "", arguments: "" };
  if (typeof delta.id === "string" && delta.id.length > 0) current.id = delta.id;
  if (typeof delta.function?.name === "string" && delta.function.name.length > 0) {
    current.name = delta.function.name;
  }
  if (typeof delta.function?.arguments === "string") {
    current.arguments += delta.function.arguments;
  }
  tools[index] = current;
};

const finalizedToolCalls = (tools: AccTool[]): ToolCall[] =>
  tools
    .filter((tool) => tool.name.length > 0)
    .map((tool, index) => ({
      id: tool.id.length > 0 ? tool.id : `call_${index + 1}`,
      type: "function" as const,
      function: { name: tool.name, arguments: tool.arguments },
    }));

export const streamChatCompletion = (input: StreamChatInput): Promise<StreamChatResult> =>
  new Promise((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const url = new URL(chatCompletionsUrl(input.baseUrl));
    const lib = url.protocol === "https:" ? Https : Http;
    const body = JSON.stringify({
      model: NERO_MODEL,
      stream: true,
      messages: input.messages,
      tools: OPENROUTER_TOOLS,
      tool_choice: "auto",
      provider: {
        only: [...OPENROUTER_PROVIDER_ONLY],
        allow_fallbacks: false,
      },
    });
    const timeoutMs = input.timeoutMs ?? OPENROUTER_TIMEOUT_MS;
    const idleMs = input.idleMs ?? OPENROUTER_IDLE_MS;
    let settled = false;
    let request: Http.ClientRequest | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const clearIdle = () => {
      if (idleTimer === undefined) return;
      clearTimeout(idleTimer);
      idleTimer = undefined;
    };
    const onAbort = () => {
      request?.destroy();
      settle(new Error("aborted"));
    };
    const settle = (error: Error | undefined, result?: StreamChatResult) => {
      if (settled) return;
      settled = true;
      clearIdle();
      input.signal.removeEventListener("abort", onAbort);
      if (error !== undefined) reject(error);
      else resolve(result ?? { content: "", toolCalls: [], finishReason: null });
    };
    const bumpIdle = () => {
      clearIdle();
      idleTimer = setTimeout(() => {
        request?.destroy();
        settle(new Error(`OpenRouter idle timeout after ${idleMs}ms`));
      }, idleMs);
    };
    input.signal.addEventListener("abort", onAbort);
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
        },
        ...(url.port.length > 0 ? { port: url.port } : {}),
      },
      (response) => {
        bumpIdle();
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "");
        if (status !== 200) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            bumpIdle();
            chunks.push(chunk as Buffer);
          });
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            settle(new Error(`OpenRouter HTTP ${status}: ${text.slice(0, 800)}`));
          });
          return;
        }
        if (contentType.includes("application/json") && !contentType.includes("event-stream")) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            bumpIdle();
            chunks.push(chunk as Buffer);
          });
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            settle(new Error(`OpenRouter JSON error: ${text.slice(0, 800)}`));
          });
          return;
        }
        let buffer = "";
        let content = "";
        let finishReason: string | null = null;
        const tools: AccTool[] = [];
        const finish = (error: Error | undefined) => {
          settle(
            error,
            error === undefined
              ? { content, toolCalls: finalizedToolCalls(tools), finishReason }
              : undefined,
          );
        };
        const openRouterError = (value: unknown): string | undefined => {
          if (value === null || typeof value !== "object") return undefined;
          const record = value as { error?: unknown };
          if (record.error === undefined) return undefined;
          if (typeof record.error === "string") return record.error;
          if (record.error !== null && typeof record.error === "object") {
            const message = (record.error as { message?: unknown }).message;
            if (typeof message === "string" && message.length > 0) return message;
          }
          return "OpenRouter stream error";
        };
        response.on("error", (error) => finish(error));
        response.on("data", (chunk) => {
          bumpIdle();
          buffer += (chunk as Buffer).toString("utf8");
          for (;;) {
            const nl = buffer.indexOf("\n");
            if (nl < 0) break;
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data.length === 0) continue;
            if (data === "[DONE]") {
              finish(undefined);
              return;
            }
            let parsed: unknown;
            try {
              parsed = JSON.parse(data) as unknown;
            } catch {
              continue;
            }
            const streamError = openRouterError(parsed);
            if (streamError !== undefined) {
              finish(new Error(streamError));
              return;
            }
            if (parsed === null || typeof parsed !== "object") continue;
            const choices = (parsed as { choices?: unknown }).choices;
            if (!Array.isArray(choices) || choices.length === 0) continue;
            const choice = choices[0];
            if (choice === null || typeof choice !== "object") continue;
            const record = choice as {
              finish_reason?: unknown;
              delta?: {
                content?: unknown;
                tool_calls?: unknown;
              };
            };
            if (typeof record.finish_reason === "string") finishReason = record.finish_reason;
            const delta = record.delta;
            if (delta === undefined) continue;
            if (typeof delta.content === "string" && delta.content.length > 0) {
              content += delta.content;
              try {
                input.onText(delta.content);
              } catch (error) {
                finish(error instanceof Error ? error : new Error("onText failed"));
                return;
              }
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const toolDelta of delta.tool_calls) {
                if (toolDelta !== null && typeof toolDelta === "object") {
                  applyToolDelta(tools, toolDelta as Parameters<typeof applyToolDelta>[1]);
                }
              }
            }
          }
        });
        response.on("end", () => finish(undefined));
      },
    );
    request = req;
    bumpIdle();
    req.on("timeout", () => {
      req.destroy();
      settle(new Error(`OpenRouter request timed out after ${timeoutMs}ms`));
    });
    req.on("error", (error) => {
      if (input.signal.aborted) settle(new Error("aborted"));
      else settle(error);
    });
    req.write(body);
    req.end();
  });
