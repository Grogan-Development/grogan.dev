/**
 * Baseten — fast mode. Per-token spend (`zai-org/GLM-5.3-Flash`, OpenAI-compat,
 * native inline images). Routed ONLY when the user explicitly picks the fast
 * model — never an automatic fallback, per the router policy.
 */
import { streamOpenAICompat, type StreamChatResult } from "./openaiCompat.ts";
import { NERO_TOOLS, type StreamRequest } from "./catalog.ts";

export type BasetenOptions = {
  readonly apiKey: string | undefined;
  readonly baseUrl: string;
};

export const isBasetenConfigured = (options: BasetenOptions): boolean =>
  options.apiKey !== undefined && options.apiKey.length > 0;

export const streamBaseten = (
  request: StreamRequest,
  options: BasetenOptions,
  upstream: string,
): Promise<StreamChatResult> =>
  streamOpenAICompat({
    url: `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    headers: {
      authorization: `Bearer ${options.apiKey ?? ""}`,
      accept: "text/event-stream",
    },
    body: {
      model: upstream,
      stream: true,
      messages: request.messages,
      tools: NERO_TOOLS,
      tool_choice: "auto",
    },
    signal: request.signal,
    onText: request.onText,
    timeoutMs: request.timeoutMs,
    idleMs: request.idleMs,
    label: "Baseten",
  });
