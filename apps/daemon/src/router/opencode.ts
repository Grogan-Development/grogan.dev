/**
 * OpenCode Zen — the curated-models gateway from the OpenCode team
 * (https://opencode.ai/zen). Serves as the fallback for GPT/Grok and the
 * primary route for Claude/Kimi/Gemini/DeepSeek. One API key
 * (OPENCODE_API_KEY from opencode.ai/auth billing); models span three
 * transports, so the catalog route decides the endpoint:
 *
 * - openai     → {base}/chat/completions   (kimi-k3, deepseek-v4-pro, gemini-*)
 * - responses  → {base}/responses          (gpt-5.6-*, grok-4.6)
 * - anthropic  → {base}/messages           (claude-fable-5 and friends)
 *
 * The OpenCode Go subscription ($10/mo) is the same gateway at
 * {base-with-/zen/go/v1} with balance fallback — set OPENCODE_BASE_URL to
 * switch, no code change.
 */
import { maxOutputTokens, type CatalogRoute, type StreamRequest } from "./catalog.ts";
import { streamAnthropic } from "./anthropicCompat.ts";
import { NERO_TOOLS } from "./catalog.ts";
import { streamOpenAICompat, type StreamChatResult } from "./openaiCompat.ts";
import { streamResponses } from "./responsesCompat.ts";

export type OpenCodeOptions = {
  readonly apiKey: string | undefined;
  /** Default https://opencode.ai/zen/v1; Go subscribers point at .../zen/go/v1. */
  readonly baseUrl: string | undefined;
};

export const isOpenCodeConfigured = (options: OpenCodeOptions): boolean =>
  options.apiKey !== undefined && options.apiKey.length > 0;

export const streamOpenCode = (
  request: StreamRequest,
  route: CatalogRoute,
  options: OpenCodeOptions,
): Promise<StreamChatResult> => {
  const base = (options.baseUrl ?? "https://opencode.ai/zen/v1").replace(/\/+$/, "");
  switch (route.transport) {
    case "openai":
      return streamOpenAICompat({
        url: `${base}/chat/completions`,
        headers: { authorization: `Bearer ${options.apiKey ?? ""}`, accept: "text/event-stream" },
        body: {
          model: route.upstream,
          stream: true,
          messages: request.messages,
          tools: NERO_TOOLS,
          tool_choice: "auto",
        },
        signal: request.signal,
        onText: request.onText,
        timeoutMs: request.timeoutMs,
        idleMs: request.idleMs,
        label: `OpenCode Zen (${route.upstream})`,
      });
    case "responses":
      return streamResponses({
        url: `${base}/responses`,
        headers: { authorization: `Bearer ${options.apiKey ?? ""}` },
        model: route.upstream,
        instructions: "",
        messages: request.messages,
        signal: request.signal,
        onText: request.onText,
        timeoutMs: request.timeoutMs,
        idleMs: request.idleMs,
        label: `OpenCode Zen (${route.upstream})`,
      });
    case "anthropic":
      return streamAnthropic({
        url: `${base}/messages`,
        apiKey: options.apiKey ?? "",
        model: route.upstream,
        maxTokens: maxOutputTokens(route),
        messages: request.messages,
        signal: request.signal,
        onText: request.onText,
        timeoutMs: request.timeoutMs,
        idleMs: request.idleMs,
        label: `OpenCode Zen (${route.upstream})`,
      });
  }
};
