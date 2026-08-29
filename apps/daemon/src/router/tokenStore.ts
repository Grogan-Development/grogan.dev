/**
 * Subscription credential store for the Nero Router. OAuth/OIDC tokens (OpenAI
 * Codex, xAI Grok) persist under `dataDir/router/` on the workspace dataset,
 * so they survive daemon restarts like every other state file. API-key
 * providers never touch this store — they read env directly.
 */
import * as Crypto from "node:crypto";
import * as Fs from "node:fs";
import * as Path from "node:path";

import { ensureDir, readJson, writeJsonAtomic } from "../runtime.ts";

export type OAuthTokenSet = {
  /** Microsoft-style JWT account id if the provider returns one (Codex does). */
  readonly accountId: string | undefined;
  readonly accessToken: string;
  readonly refreshToken: string | undefined;
  readonly expiresAtMs: number | undefined;
};

type StoreShape = {
  readonly version: 1;
  readonly codex: OAuthTokenSet | null;
  readonly grok: OAuthTokenSet | null;
};

const EMPTY: StoreShape = { version: 1, codex: null, grok: null };

const parse = (value: unknown): OAuthTokenSet | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.accessToken !== "string" || record.accessToken.length === 0) return null;
  return {
    accountId:
      typeof record.accountId === "string" && record.accountId.length > 0
        ? record.accountId
        : undefined,
    accessToken: record.accessToken,
    refreshToken: typeof record.refreshToken === "string" ? record.refreshToken : undefined,
    expiresAtMs: typeof record.expiresAtMs === "number" ? record.expiresAtMs : undefined,
  };
};

export class RouterTokenStore {
  private readonly filePath: string;
  private cache: StoreShape | undefined;

  constructor(dataDir: string) {
    this.filePath = Path.join(dataDir, "router", "tokens.json");
  }

  private load(): StoreShape {
    if (this.cache !== undefined) return this.cache;
    const raw = readJson(this.filePath);
    let store = EMPTY;
    if (typeof raw === "object" && raw !== null) {
      const record = raw as Record<string, unknown>;
      store = {
        version: 1,
        codex: parse(record.codex),
        grok: parse(record.grok),
      };
    }
    this.cache = store;
    return store;
  }

  private save(store: StoreShape): void {
    ensureDir(Path.dirname(this.filePath));
    writeJsonAtomic(this.filePath, store);
    this.cache = store;
  }

  get(provider: "codex" | "grok"): OAuthTokenSet | null {
    return this.load()[provider];
  }

  set(provider: "codex" | "grok", tokens: OAuthTokenSet): void {
    const store = this.load();
    this.save({ ...store, [provider]: tokens });
  }

  clear(provider: "codex" | "grok"): void {
    const store = this.load();
    this.save({ ...store, [provider]: null });
  }

  has(provider: "codex" | "grok"): boolean {
    return this.get(provider) !== null;
  }
}

/** Exchange/refresh helper shared by both OAuth providers. */
export const tokenEndpointRequest = async (
  endpoint: string,
  params: Readonly<Record<string, string>>,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> => {
  const body = new URLSearchParams(params).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`token endpoint returned non-JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    const record = json as Record<string, unknown>;
    const message =
      typeof record.error === "string"
        ? `${record.error}: ${String(record.error_description ?? "")}`
        : text.slice(0, 400);
    throw new Error(`token endpoint failed (HTTP ${response.status}): ${message}`);
  }
  return json as Record<string, unknown>;
};

/** PKCE pair (S256) for the browser login flows. */
export const pkcePair = (): { verifier: string; challenge: string } => {
  const verifier = Crypto.randomBytes(48).toString("base64url");
  const challenge = Crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};
