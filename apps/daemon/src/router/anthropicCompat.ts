/**
 * Anthropic Messages streaming client (`/v1/messages` style). Used for
 * OpenCode Zen's Anthropic-compatible models (claude-fable-5 et al.), which
 * the Zen docs route exclusively through `/messages`, not chat/completions.
 *
 * Maps our chat transcript onto messages content blocks and parses the SSE
 * event grammar (content_block_delta text/input_json, message_delta
 * stop_reason) into the same StreamChatResult the other transports produce.
 */
import * as Http from "node:http";
import * as Https from "node:https";
import { URL } from "node:url";

import { NERO_TOOLS, type StreamRequest } from "./catalog.ts";
import type { ChatMessage, StreamChatResult, ToolCall } from "./openaiCompat.ts";

export type AnthropicStreamInput = {
  readonly url: string;
  readonly apiKey: string;
  /** Anthropic-style APIs require an explicit version header. */
  readonly version?: string;
  readonly model: string;
  readonly maxTokens: number;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly signal: AbortSignal;
  readonly onText: (delta: string) => void;
  readonly timeoutMs: number;
  readonly idleMs: number;
  readonly label: string;
  /** Reasoning level ("low" | "medium" | "high"); omitted = provider default. */
  readonly reasoningEffort?: string | undefined;
};

type ContentBlock =
  | { readonly type: "text"; readonly text: string }
  | {
      readonly type: "tool_use";
      readonly id: string;
      readonly name: string;
      readonly input: unknown;
    };

type MessageParam = {
  readonly role: "user" | "assistant";
  readonly content: string | ReadonlyArray<ContentBlock | Record<string, unknown>>;
};

/** Map the chat transcript (system + roles + tool calls/results) to messages. */
export const toAnthropicMessages = (
  messages: ReadonlyArray<ChatMessage>,
): { system: string; messages: ReadonlyArray<MessageParam> } => {
  let system = "";
  const out: Array<{
    role: "user" | "assistant";
    content: Array<ContentBlock | Record<string, unknown>>;
  }> = [];
  const push = (role: "user" | "assistant", block: ContentBlock | Record<string, unknown>) => {
    const last = out.at(-1);
    if (last !== undefined && last.role === role) last.content.push(block);
    else out.push({ role, content: [block] });
  };
  for (const message of messages) {
    switch (message.role) {
      case "system":
        system = message.content;
        break;
      case "user": {
        if (typeof message.content === "string") {
          push("user", { type: "text", text: message.content });
        } else {
          const text = message.content
            .map((part) => (part.type === "text" ? part.text : `[image] ${part.image_url.url}`))
            .join("\n\n");
          push("user", { type: "text", text });
        }
        break;
      }
      case "assistant": {
        if (message.content !== null && message.content.length > 0) {
          push("assistant", { type: "text", text: message.content });
        }
        for (const call of message.tool_calls ?? []) {
          let input: unknown = {};
          try {
            input = JSON.parse(call.function.arguments) as unknown;
          } catch {
            input = {};
          }
          push("assistant", { type: "tool_use", id: call.id, name: call.function.name, input });
        }
        break;
      }
      case "tool":
        push("user", {
          type: "tool_result",
          tool_use_id: message.tool_call_id,
          content: message.content,
        });
        break;
    }
  }
  return { system, messages: out };
};

export const streamAnthropic = (input: AnthropicStreamInput): Promise<StreamChatResult> =>
  new Promise((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const { system, messages } = toAnthropicMessages(input.messages);
    const url = new URL(input.url);
    const lib = url.protocol === "https:" ? Https : Http;
    const thinkingBudget = { low: 4096, medium: 10_240, high: 24_576 }[
      input.reasoningEffort ?? "none"
    ];
    const body = JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      ...(system.length > 0 ? { system } : {}),
      messages,
      tools: NERO_TOOLS.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      })),
      ...(thinkingBudget === undefined
        ? {}
        : { thinking: { type: "enabled", budget_tokens: thinkingBudget } }),
      stream: true,
    });
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
          "x-api-key": input.apiKey,
          "anthropic-version": input.version ?? "2023-06-01",
          accept: "text/event-stream",
        },
        ...(url.port.length > 0 ? { port: url.port } : {}),
      },
      (response) => {
        bumpIdle();
        const status = response.statusCode ?? 0;
        if (status !== 200) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            bumpIdle();
            chunks.push(chunk as Buffer);
          });
          response.on("end", () => {
            settle(
              new Error(
                `${input.label} HTTP ${status}: ${Buffer.concat(chunks).toString("utf8").slice(0, 800)}`,
              ),
            );
          });
          return;
        }
        let buffer = "";
        let content = "";
        let finishReason: string | null = null;
        const tools = new Map<number, { id: string; name: string; arguments: string }>();
        const finish = (error: Error | undefined) => {
          settle(
            error,
            error === undefined
              ? {
                  content,
                  toolCalls: [...tools.values()]
                    .filter((tool) => tool.name.length > 0)
                    .map(
                      (tool): ToolCall => ({
                        id: tool.id,
                        type: "function",
                        function: { name: tool.name, arguments: tool.arguments },
                      }),
                    ),
                  finishReason,
                }
              : undefined,
          );
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
            let parsed: unknown;
            try {
              parsed = JSON.parse(data) as unknown;
            } catch {
              continue;
            }
            if (parsed === null || typeof parsed !== "object") continue;
            const event = parsed as { type?: string; [key: string]: unknown };
            switch (event.type) {
              case "content_block_start": {
                const block = event.content_block as
                  | { type?: string; id?: string; name?: string }
                  | undefined;
                if (block?.type === "tool_use") {
                  const index = typeof event.index === "number" ? event.index : tools.size;
                  tools.set(index, {
                    id: typeof block.id === "string" ? block.id : `toolu_${index + 1}`,
                    name: typeof block.name === "string" ? block.name : "",
                    arguments: "",
                  });
                }
                break;
              }
              case "content_block_delta": {
                const delta = event.delta as
                  | { type?: string; text?: string; partial_json?: string }
                  | undefined;
                if (
                  delta?.type === "text_delta" &&
                  typeof delta.text === "string" &&
                  delta.text.length > 0
                ) {
                  content += delta.text;
                  try {
                    input.onText(delta.text);
                  } catch (error) {
                    finish(error instanceof Error ? error : new Error("onText failed"));
                    return;
                  }
                } else if (
                  delta?.type === "input_json_delta" &&
                  typeof delta.partial_json === "string"
                ) {
                  const index = typeof event.index === "number" ? event.index : 0;
                  const current = tools.get(index);
                  if (current !== undefined) current.arguments += delta.partial_json;
                }
                break;
              }
              case "message_delta": {
                const delta = event.delta as { stop_reason?: unknown } | undefined;
                if (delta !== undefined && typeof delta.stop_reason === "string") {
                  finishReason =
                    delta.stop_reason === "tool_use" ? "tool_calls" : delta.stop_reason;
                }
                break;
              }
              case "message_stop":
                finish(undefined);
                return;
              case "error": {
                const err = event.error as { message?: unknown } | undefined;
                finish(new Error(String(err?.message ?? `${input.label} stream error`)));
                return;
              }
              default:
                break;
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
