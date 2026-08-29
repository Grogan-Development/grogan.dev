/**
 * Nero Router — the one routing layer for all model traffic: Z.ai (main,
 * coding plan → PAYG fallback), Baseten (behind the GLM chain), OpenCode Zen
 * (GPT/Grok fallback; primary for Claude/Kimi/Gemini/DeepSeek), and the
 * OpenAI Pro / Grok Heavy subscription routes (OAuth/OIDC, token store on
 * the dataset).
 *
 * Policy: plan quota → Z.ai PAYG on quota errors → Baseten behind the GLM
 * chain; GPT/Grok try their subscription first and fall back to OpenCode.
 * The catalog (`catalog.ts`) carries each model's chain, transports, and
 * upstream slugs.
 */
import { isBasetenConfigured, streamBaseten, type BasetenOptions } from "./baseten.ts";
import {
  CodexLoginManager,
  isCodexConfigured,
  streamCodexResponses,
  type CodexOptions,
} from "./codex.ts";
import { importGrokAuth, isGrokConfigured, streamGrok, type GrokOptions } from "./grok.ts";
import { isOpenCodeConfigured, streamOpenCode, type OpenCodeOptions } from "./opencode.ts";
import { isZaiConfigured, isZaiQuotaError, streamZai, type ZaiOptions } from "./zai.ts";
import {
  resolveCatalogModel,
  type CatalogRoute,
  type RouterProviderId,
  type StreamRequest,
} from "./catalog.ts";
import { RouterTokenStore } from "./tokenStore.ts";
import type { StreamChatResult } from "./openaiCompat.ts";

export type NeroRouterOptions = {
  readonly zai: ZaiOptions;
  readonly baseten: BasetenOptions;
  readonly codex: Pick<CodexOptions, "clientId" | "redirectUri">;
  readonly grok: Pick<GrokOptions, "baseUrl">;
  readonly opencode: OpenCodeOptions;
  readonly dataDir: string;
};

export type NeroRouterStatus = {
  readonly zai: boolean;
  readonly baseten: boolean;
  readonly codex: boolean;
  readonly grok: boolean;
  readonly opencode: boolean;
};

export class NeroRouter {
  readonly tokens: RouterTokenStore;
  readonly codexLogin: CodexLoginManager;
  private readonly options: NeroRouterOptions;

  constructor(options: NeroRouterOptions) {
    this.options = options;
    this.tokens = new RouterTokenStore(options.dataDir);
    const codexOptions: CodexOptions = {
      clientId: options.codex.clientId,
      redirectUri: options.codex.redirectUri,
      tokenStore: this.tokens,
    };
    this.codexLogin = new CodexLoginManager(
      codexOptions,
      options.codex.redirectUri ?? "http://127.0.0.1:1455/auth/callback",
    );
    this.codexOptions = codexOptions;
  }

  private readonly codexOptions: CodexOptions;

  private grokOptions(): GrokOptions {
    return { tokenStore: this.tokens, baseUrl: this.options.grok.baseUrl };
  }

  status(): NeroRouterStatus {
    return {
      zai: isZaiConfigured(this.options.zai),
      baseten: isBasetenConfigured(this.options.baseten),
      codex: isCodexConfigured(this.codexOptions),
      grok: isGrokConfigured(this.grokOptions()),
      opencode: isOpenCodeConfigured(this.options.opencode),
    };
  }

  /** Import a Grok CLI auth.json (parsed object) into the token store. */
  importGrokAuth(raw: unknown): { signedIn: true } {
    importGrokAuth(this.grokOptions(), raw);
    return { signedIn: true };
  }

  importCodexTokens(raw: unknown): { signedIn: true } {
    if (typeof raw !== "object" || raw === null) {
      throw new Error("Codex token import expects an object.");
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.access_token !== "string" && typeof record.accessToken !== "string") {
      throw new Error("Codex token import is missing access_token.");
    }
    const accessToken =
      typeof record.access_token === "string"
        ? record.access_token
        : (record.accessToken as string);
    const expiresAtMs =
      typeof record.expires_at === "number"
        ? record.expires_at < 10_000_000_000
          ? record.expires_at * 1000
          : record.expires_at
        : typeof record.expiresAtMs === "number"
          ? record.expiresAtMs
          : undefined;
    this.tokens.set("codex", {
      accountId:
        typeof record.chatgpt_account_id === "string"
          ? record.chatgpt_account_id
          : typeof record.accountId === "string"
            ? record.accountId
            : undefined,
      accessToken,
      refreshToken:
        typeof record.refresh_token === "string"
          ? record.refresh_token
          : typeof record.refreshToken === "string"
            ? record.refreshToken
            : undefined,
      expiresAtMs,
    });
    return { signedIn: true };
  }

  /** Stream a turn, walking the model's provider chain until one succeeds. */
  async stream(request: StreamRequest): Promise<StreamChatResult> {
    const model = resolveCatalogModel(request.model);
    // The speed bolt prepends the fast route; the normal chain stays behind
    // it as the fallback.
    const chain =
      request.fast === true && model.fast !== undefined
        ? [model.fast, ...model.chain]
        : model.chain;
    const errors: string[] = [];
    for (const [index, route] of chain.entries()) {
      if (request.signal.aborted) throw new Error("aborted");
      if (!this.providerReady(route.provider)) {
        errors.push(`${route.provider}: not configured`);
        continue;
      }
      try {
        return await this.streamVia(route, request);
      } catch (error) {
        if (request.signal.aborted) throw new Error("aborted");
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${route.provider}/${route.upstream}: ${message}`);
        // Only quota/rate-limit errors fall through to the next route, and
        // only within the GLM chain; the last route's error surfaces.
        const isLast = index === chain.length - 1;
        const fallbackEligible =
          (route.provider === "zai" ||
            route.provider === "zai-payg" ||
            route.provider === "baseten") &&
          isQuotaShaped(message, error);
        if (isLast || !fallbackEligible) {
          throw error;
        }
      }
    }
    throw new Error(
      `No model provider could serve “${model.slug}”. ${errors.join("; ") || "None configured."}`,
    );
  }

  private providerReady(id: RouterProviderId): boolean {
    switch (id) {
      case "zai":
      case "zai-payg":
        return isZaiConfigured(this.options.zai);
      case "baseten":
        return isBasetenConfigured(this.options.baseten);
      case "codex":
        return isCodexConfigured(this.codexOptions);
      case "grok":
        return isGrokConfigured(this.grokOptions());
      case "opencode":
        return isOpenCodeConfigured(this.options.opencode);
    }
  }

  private streamVia(route: CatalogRoute, request: StreamRequest): Promise<StreamChatResult> {
    switch (route.provider) {
      case "zai":
        return streamZai(request, this.options.zai, "coding", route.upstream);
      case "zai-payg":
        return streamZai(request, this.options.zai, "payg", route.upstream);
      case "baseten":
        return streamBaseten(request, this.options.baseten, route.upstream);
      case "codex":
        return streamCodexResponses(request, this.codexOptions, route.upstream);
      case "grok":
        return streamGrok(request, this.grokOptions(), route.upstream);
      case "opencode":
        return streamOpenCode(request, route, this.options.opencode);
    }
  }
}

const QUOTA_PATTERNS =
  /\b(429|rate limit|quota|insufficient|exhausted|out of credits|billing|usage limit)\b/i;

const isQuotaShaped = (message: string, error: unknown): boolean =>
  QUOTA_PATTERNS.test(message) || isZaiQuotaError(error);
