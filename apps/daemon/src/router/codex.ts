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

import type { StreamRequest } from "./catalog.ts";
import type { ChatMessage, StreamChatResult } from "./openaiCompat.ts";
import { streamResponses } from "./responsesCompat.ts";
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

export const streamCodexResponses = async (
  request: StreamRequest,
  options: CodexOptions,
  upstream: string,
): Promise<StreamChatResult> => {
  const tokens = await ensureCodexToken(options);
  return streamResponses({
    url: "https://chatgpt.com/backend-api/codex/responses",
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      ...(tokens.accountId === undefined ? {} : { "chatgpt-account-id": tokens.accountId }),
    },
    model: upstream,
    instructions: "",
    messages: request.messages,
    signal: request.signal,
    onText: request.onText,
    timeoutMs: request.timeoutMs,
    idleMs: request.idleMs,
    reasoningEffort: request.reasoningEffort,
    label: "Codex (ChatGPT Pro)",
  });
};
