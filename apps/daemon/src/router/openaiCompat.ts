/**
 * Shared OpenAI-chat-completions streaming client. Every OpenAI-compatible
 * Nero Router provider (Z.ai, Baseten, Grok OIDC) streams through here; only
 * the endpoint, credential header, model slug, and body extras differ.
 */
import * as Http from "node:http";
import * as Https from "node:https";
import { URL } from "node:url";

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

export type StreamChatResult = {
  readonly content: string;
  readonly toolCalls: ReadonlyArray<ToolCall>;
  readonly finishReason: string | null;
};

export type OpenAICompatStreamInput = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Record<string, unknown>;
  readonly signal: AbortSignal;
  readonly onText: (delta: string) => void;
  readonly timeoutMs: number;
  readonly idleMs: number;
  /** Label used in error messages (e.g. "Z.ai", "Baseten"). */
  readonly label: string;
};

export class RouterHttpStatusError extends Error {
  readonly status: number;
  constructor(label: string, status: number, body: string) {
    super(`${label} HTTP ${status}: ${body.slice(0, 800)}`);
    this.name = "RouterHttpStatusError";
    this.status = status;
  }
}

export const isRouterQuotaError = (error: unknown): boolean => {
  if (error instanceof RouterHttpStatusError) {
    return error.status === 429 || error.status === 402 || error.status === 403;
  }
  const message = error instanceof Error ? error.message : "";
  return /\b(429|quota|insufficient|exhausted|credit)\b/i.test(message);
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

export const streamOpenAICompat = (input: OpenAICompatStreamInput): Promise<StreamChatResult> =>
  new Promise((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const url = new URL(input.url);
    const lib = url.protocol === "https:" ? Https : Http;
    const body = JSON.stringify(input.body);
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
        settle(new Error(`${input.label} idle timeout after ${input.idleMs}ms`));
      }, input.idleMs);
    };
    input.signal.addEventListener("abort", onAbort);
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        timeout: input.timeoutMs,
        headers: {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
          ...input.headers,
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
            settle(
              new RouterHttpStatusError(
                input.label,
                status,
                Buffer.concat(chunks).toString("utf8"),
              ),
            );
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
            settle(
              new Error(
                `${input.label} JSON error: ${Buffer.concat(chunks).toString("utf8").slice(0, 800)}`,
              ),
            );
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
        const streamError = (value: unknown): string | undefined => {
          if (value === null || typeof value !== "object") return undefined;
          const record = value as { error?: unknown };
          if (record.error === undefined) return undefined;
          if (typeof record.error === "string") return record.error;
          if (record.error !== null && typeof record.error === "object") {
            const message = (record.error as { message?: unknown }).message;
            if (typeof message === "string" && message.length > 0) return message;
          }
          return `${input.label} stream error`;
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
            const errorMessage = streamError(parsed);
            if (errorMessage !== undefined) {
              finish(new Error(errorMessage));
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
      settle(new Error(`${input.label} request timed out after ${input.timeoutMs}ms`));
    });
    req.on("error", (error) => {
      if (input.signal.aborted) settle(new Error("aborted"));
      else settle(error);
    });
    req.write(body);
    req.end();
  });
