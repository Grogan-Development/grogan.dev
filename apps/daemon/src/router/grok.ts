/**
 * Grok subscriptions via xAI OIDC. The subscription session (Grok Build's own
 * auth path — first-party, open source) is what serves Grok Heavy; the
 * pay-per-token api.x.ai catalog only serves non-heavy models.
 *
 * Bring-up is import-first: the human logs into the Grok CLI locally, drops
 * the resulting `~/.grok/auth.json` contents into the workspace, and the
 * daemon imports the OIDC tokens (keyed `issuer::client_id`, rotating refresh
 * tokens, JWT-expiry tracked). Nero owns the imported copy in its token store;
 * the CLI file itself is never written back to.
 */
import { NERO_TOOLS, upstreamModelSlug, type StreamRequest } from "./catalog.ts";
import { streamOpenAICompat, type StreamChatResult } from "./openaiCompat.ts";
import { tokenEndpointRequest, type OAuthTokenSet, type RouterTokenStore } from "./tokenStore.ts";

export type GrokOptions = {
  readonly tokenStore: RouterTokenStore;
  /** Override for the OpenAI-compatible endpoint. */
  readonly baseUrl: string | undefined;
};

export const isGrokConfigured = (options: GrokOptions): boolean => options.tokenStore.has("grok");

export type GrokAuthFileEntry = {
  readonly issuer: string;
  readonly clientId: string | undefined;
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
  readonly expiresAtMs: number | undefined;
};

/**
 * Parse `~/.grok/auth.json` contents. Tokens are keyed `issuer::client_id` —
 * pick the entry with a refresh token (falling back to the first entry).
 */
export const parseGrokAuthFile = (raw: unknown): GrokAuthFileEntry => {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Grok auth file is not an object.");
  }
  const record = raw as Record<string, unknown>;
  const pick = (value: unknown): GrokAuthFileEntry | null => {
    if (typeof value !== "object" || value === null) return null;
    const entry = value as Record<string, unknown>;
    const accessToken =
      typeof entry.access_token === "string"
        ? entry.access_token
        : typeof entry.accessToken === "string"
          ? entry.accessToken
          : undefined;
    if (accessToken === undefined || accessToken.length === 0) return null;
    const refreshToken =
      typeof entry.refresh_token === "string"
        ? entry.refresh_token
        : typeof entry.refreshToken === "string"
          ? entry.refreshToken
          : undefined;
    const expiresAtMs =
      typeof entry.expires_at === "number"
        ? entry.expires_at < 10_000_000_000
          ? entry.expires_at * 1000
          : entry.expires_at
        : typeof entry.expiresAtMs === "number"
          ? entry.expiresAtMs
          : undefined;
    return {
      issuer: typeof entry.issuer === "string" ? entry.issuer : "https://auth.x.ai",
      clientId:
        typeof entry.client_id === "string"
          ? entry.client_id
          : typeof entry.clientId === "string"
            ? entry.clientId
            : undefined,
      accessToken,
      refreshToken,
      expiresAtMs,
    };
  };
  for (const value of Object.values(record)) {
    const parsed = pick(value);
    if (parsed?.refreshToken !== undefined) return parsed;
  }
  const nested = record.tokens ?? record.accounts;
  if (typeof nested === "object" && nested !== null) {
    for (const value of Object.values(nested as Record<string, unknown>)) {
      const parsed = pick(value);
      if (parsed?.refreshToken !== undefined) return parsed;
    }
  }
  for (const value of Object.values(record)) {
    const parsed = pick(value);
    if (parsed !== null) return parsed;
  }
  throw new Error("No OIDC token entry found in the Grok auth file.");
};

export const importGrokAuth = (options: GrokOptions, raw: unknown): OAuthTokenSet => {
  const entry = parseGrokAuthFile(raw);
  const tokens: OAuthTokenSet = {
    accountId: undefined,
    accessToken: entry.accessToken,
    refreshToken: entry.refreshToken,
    expiresAtMs: entry.expiresAtMs,
  };
  options.tokenStore.set("grok", tokens);
  return tokens;
};

/** OIDC discovery for the issuer's token endpoint (cached per issuer). */
const tokenEndpointForIssuer = async (issuer: string): Promise<string> => {
  const response = await fetch(`${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Standard fallback path when discovery is unavailable.
    return `${issuer.replace(/\/+$/, "")}/oauth/token`;
  }
  const json = (await response.json()) as { token_endpoint?: unknown };
  return typeof json.token_endpoint === "string" ? json.token_endpoint : `${issuer}/oauth/token`;
};

const refreshThresholdMs = 5 * 60_000;

let issuerTokenEndpointCache: { issuer: string; endpoint: string } | undefined;

export const ensureGrokToken = async (options: GrokOptions): Promise<OAuthTokenSet> => {
  const current = options.tokenStore.get("grok");
  if (current === null) {
    throw new Error(
      "Grok is not signed in — import your Grok CLI auth.json first (NERO_GROK_AUTH_FILE or the import endpoint).",
    );
  }
  const expired =
    current.expiresAtMs === undefined || current.expiresAtMs < Date.now() + refreshThresholdMs;
  if (!expired || current.refreshToken === undefined) return current;

  // The imported file records the issuer; the client id is embedded in the
  // stored key in the CLI, but a plain refresh needs only the tokens.
  const issuer = "https://auth.x.ai";
  const endpoint =
    issuerTokenEndpointCache?.issuer === issuer
      ? issuerTokenEndpointCache.endpoint
      : await tokenEndpointForIssuer(issuer);
  issuerTokenEndpointCache = { issuer, endpoint };
  const json = await tokenEndpointRequest(endpoint, {
    grant_type: "refresh_token",
    refresh_token: current.refreshToken,
  });
  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Grok token refresh returned no access_token — re-import the auth file.");
  }
  const tokens: OAuthTokenSet = {
    accountId: current.accountId,
    accessToken,
    refreshToken:
      typeof json.refresh_token === "string"
        ? (json.refresh_token as string)
        : current.refreshToken,
    expiresAtMs:
      typeof json.expires_in === "number"
        ? Date.now() + json.expires_in * 1000
        : current.expiresAtMs,
  };
  options.tokenStore.set("grok", tokens);
  return tokens;
};

export const streamGrok = async (
  request: StreamRequest,
  options: GrokOptions,
): Promise<StreamChatResult> => {
  const tokens = await ensureGrokToken(options);
  const baseUrl = (options.baseUrl ?? "https://api.x.ai/v1").replace(/\/+$/, "");
  return streamOpenAICompat({
    url: `${baseUrl}/chat/completions`,
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
      accept: "text/event-stream",
    },
    body: {
      model: upstreamModelSlug("grok", request.model),
      stream: true,
      messages: request.messages,
      tools: NERO_TOOLS,
      tool_choice: "auto",
    },
    signal: request.signal,
    onText: request.onText,
    timeoutMs: request.timeoutMs,
    idleMs: request.idleMs,
    label: "Grok (xAI OIDC)",
  });
};
