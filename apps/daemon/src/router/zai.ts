/**
 * Z.ai — the main route. The **coding** endpoint spends GLM Coding Plan quota
 * (5h/weekly windows); the generic paas endpoint silently bills pay-as-you-go
 * credits, so it is only a fallback after quota errors. Vision (glm-5.3-flash)
 * takes plain OpenAI-style image parts here.
 */
import { isRouterQuotaError, streamOpenAICompat, type StreamChatResult } from "./openaiCompat.ts";
import { NERO_TOOLS, upstreamModelSlug, type StreamRequest } from "./catalog.ts";

export type ZaiOptions = {
  readonly apiKey: string | undefined;
  /** Coding-plan endpoint (default https://api.z.ai/api/coding/paas/v4). */
  readonly codingBaseUrl: string;
  /** Pay-as-you-go endpoint used only after quota errors. */
  readonly paygBaseUrl: string;
};

export const isZaiConfigured = (options: ZaiOptions): boolean =>
  options.apiKey !== undefined && options.apiKey.length > 0;

export const streamZai = async (
  request: StreamRequest,
  options: ZaiOptions,
  endpoint: "coding" | "payg",
): Promise<StreamChatResult> => {
  const apiKey = options.apiKey ?? "";
  const baseUrl = (endpoint === "coding" ? options.codingBaseUrl : options.paygBaseUrl).replace(
    /\/+$/,
    "",
  );
  return streamOpenAICompat({
    url: `${baseUrl}/chat/completions`,
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "text/event-stream",
    },
    body: {
      model: upstreamModelSlug("zai", request.model),
      stream: true,
      messages: request.messages,
      tools: NERO_TOOLS,
      tool_choice: "auto",
    },
    signal: request.signal,
    onText: request.onText,
    timeoutMs: request.timeoutMs,
    idleMs: request.idleMs,
    label: endpoint === "coding" ? "Z.ai (coding plan)" : "Z.ai (pay-as-you-go)",
  });
};

/** True when the caller should fall through to the next provider in the chain. */
export const isZaiQuotaError = (error: unknown): boolean => isRouterQuotaError(error);
