/**
 * Nero's curated model catalog: Nero slugs → per-provider routes (transport +
 * upstream slug) and the fallback chain each model uses. This is the override
 * layer from the router plan — canonical internal names, many providers, no
 * third-party middleman.
 *
 * Selection policy (user law): latest-generation models only, a select few per
 * family — GLM, Kimi, Gemini, Claude, Grok, DeepSeek, GPT. Subscription
 * routes come first where they exist (GLM → Z.ai plan, GPT → ChatGPT Pro,
 * Grok → xAI OIDC); OpenCode Zen is the fallback for GPT/Grok and the primary
 * route for everything else. Baseten is per-token spend behind the GLM chain
 * only, never an automatic fallback for other families.
 *
 * Slug/limit/pricing metadata comes from the vendored models.dev snapshot
 * (`modelsdev.json`) — refresh that file, never live-fetch at runtime.
 */
import * as Fs from "node:fs";
import * as Path from "node:path";

import type { ChatMessage } from "./openaiCompat.ts";

export type RouterProviderId = "zai" | "zai-payg" | "baseten" | "codex" | "grok" | "opencode";

/** Wire protocol a route speaks. */
export type Transport = "openai" | "anthropic" | "responses";

export type CatalogRoute = {
  readonly provider: RouterProviderId;
  readonly transport: Transport;
  /** Model slug on the provider side (differs from the Nero slug). */
  readonly upstream: string;
};

export type CatalogModel = {
  readonly slug: string;
  /** Selector label — carries the routing so no provider picker is needed. */
  readonly name: string;
  readonly chain: ReadonlyArray<CatalogRoute>;
  readonly default?: boolean;
};

export const CATALOG: ReadonlyArray<CatalogModel> = [
  {
    slug: "glm-5.3-flash",
    name: "GLM 5.3 Flash · Z.ai → Baseten",
    chain: [
      { provider: "zai", transport: "openai", upstream: "glm-5.3-flash" },
      { provider: "zai-payg", transport: "openai", upstream: "glm-5.3-flash" },
      { provider: "baseten", transport: "openai", upstream: "zai-org/GLM-5.3-Flash" },
    ],
    default: true,
  },
  {
    // The speed option: Z.ai's Highspeed variant on plan quota first, then
    // Baseten per-token (best time-to-first-token).
    slug: "glm-5.3-flash-fast",
    name: "GLM 5.3 Flash Speed · Z.ai Highspeed → Baseten",
    chain: [
      { provider: "zai", transport: "openai", upstream: "glm-5.3-highspeed" },
      { provider: "zai-payg", transport: "openai", upstream: "glm-5.3-highspeed" },
      { provider: "baseten", transport: "openai", upstream: "zai-org/GLM-5.3-Flash" },
    ],
  },
  {
    // ChatGPT Pro subscription first; OpenCode Zen serves the same generation
    // over its Responses endpoint as the fallback.
    slug: "gpt-5.6-sol",
    name: "GPT-5.6 Sol · Pro → OpenCode",
    chain: [
      { provider: "codex", transport: "responses", upstream: "gpt-5.6-sol" },
      { provider: "opencode", transport: "responses", upstream: "gpt-5.6-sol" },
    ],
  },
  {
    // xAI OIDC subscription serves Heavy; OpenCode Zen has the same slug.
    slug: "grok-4.6",
    name: "Grok 4.6 · xAI → OpenCode",
    chain: [
      { provider: "grok", transport: "openai", upstream: "grok-4.6" },
      { provider: "opencode", transport: "responses", upstream: "grok-4.6" },
    ],
  },
  {
    slug: "claude-fable-5",
    name: "Claude Fable 5 · OpenCode",
    chain: [{ provider: "opencode", transport: "anthropic", upstream: "claude-fable-5" }],
  },
  {
    slug: "kimi-k3",
    name: "Kimi K3 · OpenCode",
    chain: [{ provider: "opencode", transport: "openai", upstream: "kimi-k3" }],
  },
  {
    slug: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash · OpenCode",
    chain: [{ provider: "opencode", transport: "openai", upstream: "gemini-3.7-flash" }],
  },
  {
    slug: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro · OpenCode",
    chain: [{ provider: "opencode", transport: "openai", upstream: "deepseek-v4-pro" }],
  },
];

export const DEFAULT_MODEL = "glm-5.3-flash";

export const resolveCatalogModel = (slug: string | undefined): CatalogModel =>
  CATALOG.find((model) => model.slug === slug) ??
  CATALOG.find((model) => model.default === true) ??
  CATALOG[0]!;

/** Providers whose upstream slug differs from the Nero slug (legacy helper). */
export const upstreamModelSlug = (provider: RouterProviderId, slug: string): string => {
  if (provider === "baseten") return "zai-org/GLM-5.3-Flash";
  if (provider === "zai" || provider === "zai-payg") {
    return slug.startsWith("glm-") ? slug : "glm-5.3-flash";
  }
  return slug;
};

// ——— models.dev snapshot ———

type SnapshotModel = {
  readonly id?: string;
  readonly name?: string;
  readonly attachment?: boolean;
  readonly reasoning?: boolean;
  readonly tool_call?: boolean;
  readonly cost?: { readonly input?: number; readonly output?: number };
  readonly limit?: { readonly context?: number; readonly output?: number };
};

let snapshotCache: Readonly<Record<string, SnapshotModel>> | undefined;

/** Vendored models.dev metadata keyed `provider/model-id` (best effort). */
export const snapshotMeta = (provider: string, upstream: string): SnapshotModel | undefined => {
  if (snapshotCache === undefined) {
    const cache = new Map<string, SnapshotModel>();
    try {
      const raw = JSON.parse(
        Fs.readFileSync(Path.join(import.meta.dirname ?? ".", "modelsdev.json"), "utf8"),
      ) as { providers?: Record<string, { models?: Record<string, SnapshotModel> }> };
      for (const [pid, provider_] of Object.entries(raw.providers ?? {})) {
        for (const [mid, model] of Object.entries(provider_.models ?? {})) {
          cache.set(`${pid}/${mid}`, model);
        }
      }
    } catch {
      // Missing/corrupt snapshot: metadata is optional, routing is not.
    }
    snapshotCache = Object.fromEntries(cache);
  }
  return (
    snapshotCache[`${provider}/${upstream}`] ??
    // Z.ai routes also match the coding-plan snapshot entries.
    snapshotCache[`zai-coding-plan/${upstream}`]
  );
};

/** Max output tokens for providers that require it (Anthropic-style). */
export const maxOutputTokens = (route: CatalogRoute): number =>
  snapshotMeta("opencode", route.upstream)?.limit?.output ?? 32_000;

export type ToolSchema = {
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
};

/** The Nero harness toolset, sent verbatim to OpenAI-compatible providers. */
export const NERO_TOOLS: ReadonlyArray<ToolSchema> = [
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Run a shell command in the workspace root. Drive the graphical seat with `nero-desktop shot|click|type|key`. Start long jobs with `nero-run` so they keep the workspace awake after this turn.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run." },
          timeout_ms: {
            type: "number",
            description: "Optional timeout in milliseconds (default 120000, max 600000).",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read",
      description: "Read a UTF-8 file under the workspace root.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path relative to the workspace root, or absolute inside it.",
          },
          offset: { type: "number", description: "1-indexed start line (optional)." },
          limit: { type: "number", description: "Max lines to return (optional)." },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write",
      description: "Write a UTF-8 file under the workspace root, creating parent directories.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit",
      description:
        "Replace `old_string` with `new_string` in a workspace file. `old_string` must be unique unless `replace_all` is true.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
          replace_all: { type: "boolean" },
        },
        required: ["path", "old_string", "new_string", "replace_all"],
      },
    },
  },
];

export const systemPrompt = (workspaceRoot: string): string =>
  `You are Nero, a Pi-like coding agent in a single shared workspace.

Workspace root: ${workspaceRoot}
File tools (read/write/edit) cannot leave that root. bash starts there.

Tools: bash, read, write, edit.
Seat CLI via bash:
  nero-desktop shot [--out PATH]
  nero-desktop click X Y [--button left|middle|right] [--double]
  nero-desktop type TEXT
  nero-desktop key KEY [KEY...]
shot captures a PNG; it is attached on the next model request (max 8 images).
Long jobs: \`nero-run COMMAND\` so the workspace stays awake after this turn.

Prefer tools over questions. Be concise.`;

export type StreamRequest = {
  readonly model: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly signal: AbortSignal;
  readonly onText: (delta: string) => void;
  readonly timeoutMs: number;
  readonly idleMs: number;
};
