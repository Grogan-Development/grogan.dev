/**
 * OpenAI Pro subscription (Codex OAuth). The OAuth session is the product —
 * codex models are not reachable with an API key on subscription quota.
 *
 * Auth: PKCE browser flow against auth.openai.com with the public Codex CLI
 * client id. Nero owns its token store (`router/tokenStore.ts`); never touch
 * a local `~/.codex/auth.json` (refresh tokens are single-use/rotating).
 * The redirect URI must be registered for the client id — loopback by default
 * for local dev; production sets NERO_CODEX_REDIRECT_URI to this daemon's
 * public callback (`https://nero.grogan.dev/w/:id/api/router/codex/callback`).
 *
 * Transport: the ChatGPT backend Responses API (`/backend-api/codex/responses`),
 * SSE events mapped onto the same StreamChatResult the OpenAI-compat
 * providers produce.
 */
import * as Crypto from "node:crypto";

import { upstreamModelSlug, type StreamRequest } from "./catalog.ts";
import type { ChatMessage, StreamChatResult, ToolCall } from "./openaiCompat.ts";
import {
  pkcePair,
  tokenEndpointRequest,
  type OAuthTokenSet,
  type RouterTokenStore,
} from "./tokenStore.ts";

export const OPENAI_ISSUER = "https://auth.openai.com";
/** Public Codex CLI client id (OAuth native, PKCE, no secret). */
export const OPENAI_CODEX_CLIENT_ID = "app_EMoioeeaVU8ZYJDLa3h";

export type CodexOptions = {
  readonly clientId: string | undefined;
  readonly redirectUri: string | undefined;
  readonly tokenStore: RouterTokenStore;
};

export const isCodexConfigured = (options: CodexOptions): boolean =>
  options.tokenStore.has("codex");

type PendingLogin = { verifier: string; state: string; expiresAtMs: number };

export class CodexLoginManager {
  private pending: PendingLogin | undefined;
  private readonly options: CodexOptions;
  private readonly redirectUri: string;

  constructor(options: CodexOptions, redirectUri: string) {
    this.options = options;
    this.redirectUri = redirectUri;
  }

  /** URL the human opens in their browser (same browser holds the nero session). */
  begin(): string {
    const clientId = this.options.clientId;
    if (clientId === undefined || clientId.length === 0) {
      throw new Error("Codex login is not configured (set OPENAI_CLIENT_ID).");
    }
    const { verifier, challenge } = pkcePair();
    const state = Crypto.randomBytes(24).toString("base64url");
    this.pending = { verifier, state, expiresAtMs: Date.now() + 10 * 60_000 };
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: this.redirectUri,
      scope: "openid profile email offline_access",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      // Codex CLI parity: ChatGPT-plan auth, not platform API keys.
      prompt: "login",
    });
    return `${OPENAI_ISSUER}/oauth/authorize?${params.toString()}`;
  }

  async complete(code: string, state: string): Promise<OAuthTokenSet> {
    const pending = this.pending;
    this.pending = undefined;
    if (pending === undefined || pending.state !== state || pending.expiresAtMs < Date.now()) {
      throw new Error("Codex login state mismatch — start the login again.");
    }
    const clientId = this.options.clientId;
    if (clientId === undefined) throw new Error("Codex login is not configured.");
    const json = await tokenEndpointRequest(`${OPENAI_ISSUER}/oauth/token`, {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: this.redirectUri,
      code_verifier: pending.verifier,
    });
    const tokens = tokenSetFromResponse(json);
    this.options.tokenStore.set("codex", tokens);
    return tokens;
  }
}

const tokenSetFromResponse = (json: Record<string, unknown>): OAuthTokenSet => ({
  accountId:
    typeof json.chatgpt_account_id === "string" ? (json.chatgpt_account_id as string) : undefined,
  accessToken: String(json.access_token ?? ""),
  refreshToken: typeof json.refresh_token === "string" ? (json.refresh_token as string) : undefined,
  expiresAtMs:
    typeof json.expires_in === "number" ? Date.now() + json.expires_in * 1000 : undefined,
});

const refreshThresholdMs = 5 * 60_000;

/** Refresh the subscription token when it is missing or near expiry. */
export const ensureCodexToken = async (options: CodexOptions): Promise<OAuthTokenSet> => {
  const current = options.tokenStore.get("codex");
  if (current === null) throw new Error("Codex is not signed in — start the login flow first.");
  const expired =
    current.expiresAtMs === undefined || current.expiresAtMs < Date.now() + refreshThresholdMs;
  if (!expired || current.refreshToken === undefined) return current;
  const clientId = options.clientId;
  if (clientId === undefined) throw new Error("Codex token refresh is not configured.");
  const json = await tokenEndpointRequest(`${OPENAI_ISSUER}/oauth/token`, {
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
    client_id: clientId,
  });
  const tokens = tokenSetFromResponse(json);
  options.tokenStore.set("codex", tokens);
  return tokens;
};

// ——— Responses transport ———

type ResponsesInputItem = Record<string, unknown>;

/** Map our chat transcript onto Responses input items. */
export const toResponsesInput = (
  messages: ReadonlyArray<ChatMessage>,
): ReadonlyArray<ResponsesInputItem> => {
  const items: ResponsesInputItem[] = [];
  for (const message of messages) {
    switch (message.role) {
      case "system":
      case "user": {
        const text =
          typeof message.content === "string"
            ? message.content
            : message.content
                .map((part) => {
                  if (part.type === "text") return part.text;
                  // Responses takes images as input_image parts; data URLs work.
                  return `[image] ${part.image_url.url}`;
                })
                .join("\n\n");
        items.push({
          role: message.role,
          type: "message",
          content: [{ type: "input_text", text }],
        });
        break;
      }
      case "assistant": {
        if (message.content !== null && message.content.length > 0) {
          items.push({
            role: "assistant",
            type: "message",
            content: [{ type: "output_text", text: message.content }],
          });
        }
        for (const call of message.tool_calls ?? []) {
          items.push({
            type: "function_call",
            call_id: call.id,
            name: call.function.name,
            arguments: call.function.arguments,
          });
        }
        break;
      }
      case "tool": {
        items.push({
          type: "function_call_output",
          call_id: message.tool_call_id,
          output: message.content,
        });
        break;
      }
    }
  }
  return items;
};

/**
 * Stream the Responses API — the event grammar differs from chat-completions,
 * so this has its own SSE reader.
 */
export const streamCodexResponses = async (
  request: StreamRequest,
  options: CodexOptions,
): Promise<StreamChatResult> => {
  const tokens = await ensureCodexToken(options);
  const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      ...(tokens.accountId === undefined ? {} : { "chatgpt-account-id": tokens.accountId }),
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: upstreamModelSlug("codex", request.model),
      instructions: messagesSystemText(request.messages),
      input: toResponsesInput(messagesWithoutSystem(request.messages)),
      stream: true,
      store: false,
      // Codex subscription tool calls arrive as function_call items.
      tool_choice: "auto",
      parallel_tool_calls: false,
    }),
    signal: request.signal,
  });
  if (!response.ok || response.body === null) {
    const text = response.body === null ? "" : await response.text();
    throw new Error(`Codex HTTP ${response.status}: ${text.slice(0, 800)}`);
  }

  const tools = new Map<number, { callId: string; name: string; arguments: string }>();
  let content = "";
  let finishReason: string | null = null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onEvent = (name: string, payload: Record<string, unknown>): void => {
    if (name === "response.output_text.delta" && typeof payload.delta === "string") {
      content += payload.delta;
      request.onText(payload.delta);
      return;
    }
    if (name === "response.output_item.added") {
      const item = payload.item as Record<string, unknown> | undefined;
      if (item !== undefined && item.type === "function_call") {
        const index = typeof payload.output_index === "number" ? payload.output_index : tools.size;
        tools.set(index, {
          callId: typeof item.call_id === "string" ? item.call_id : `call_${index + 1}`,
          name: typeof item.name === "string" ? item.name : "",
          arguments: typeof item.arguments === "string" ? item.arguments : "",
        });
      }
      return;
    }
    if (name === "response.function_call_arguments.delta") {
      const index = typeof payload.output_index === "number" ? payload.output_index : 0;
      const current = tools.get(index) ?? { callId: `call_${index + 1}`, name: "", arguments: "" };
      if (typeof payload.delta === "string") current.arguments += payload.delta;
      tools.set(index, current);
      return;
    }
    if (name === "response.completed" || name === "response.incomplete") {
      const resp = payload.response as Record<string, unknown> | undefined;
      if (resp !== undefined && typeof resp.status === "string") {
        finishReason = resp.status === "completed" ? "stop" : resp.status;
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
      const record = parsed as Record<string, unknown>;
      if (typeof record.type === "string") {
        onEvent(record.type, record);
      }
    }
  }

  const toolCalls: ToolCall[] = [...tools.values()]
    .filter((tool) => tool.name.length > 0)
    .map((tool) => ({
      id: tool.callId,
      type: "function",
      function: { name: tool.name, arguments: tool.arguments },
    }));
  return { content, toolCalls, finishReason };
};

const messagesSystemText = (messages: ReadonlyArray<ChatMessage>): string => {
  for (const message of messages) {
    if (message.role === "system") return message.content;
  }
  return "";
};

const messagesWithoutSystem = (messages: ReadonlyArray<ChatMessage>): ReadonlyArray<ChatMessage> =>
  messages.filter((message) => message.role !== "system");
