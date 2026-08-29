/**
 * Nero's hand-picked model catalog: Nero slugs → per-provider slugs and the
 * routing chain each slug uses. This is the override layer from the router
 * plan — canonical internal names, many providers, no third-party router.
 *
 * The chain entries are provider ids in `router.ts`; `router.ts` decides
 * credentials and fallback per id.
 */
import type { ChatMessage } from "./openaiCompat.ts";

export type RouterProviderId = "zai" | "baseten" | "codex" | "grok";
/** Chain ids: `zai-payg` is the same provider, different billing endpoint. */
export type RouterChainId = RouterProviderId | "zai-payg";

export type CatalogModel = {
  readonly slug: string;
  readonly name: string;
  /** Providers in fallback order; the first configured one streams. */
  readonly chain: ReadonlyArray<RouterChainId>;
  readonly default?: boolean;
};

export const CATALOG: ReadonlyArray<CatalogModel> = [
  {
    slug: "glm-5.3-flash",
    name: "GLM-5.3 Flash",
    chain: ["zai", "zai-payg", "baseten"],
    default: true,
  },
  { slug: "glm-5.3", name: "GLM-5.3", chain: ["zai", "zai-payg"] },
  // Fast mode: Baseten only, never an automatic fallback (per-token spend is
  // the user's explicit choice).
  { slug: "glm-5.3-flash-fast", name: "GLM-5.3 Flash (fast)", chain: ["baseten"] },
  // Subscription routes. grok-4.6/grok-4.5 are the locally proven defaults;
  // codex's upstream slug comes from NERO_CODEX_MODEL at bring-up.
  { slug: "grok-4.6", name: "Grok 4.6", chain: ["grok"] },
  { slug: "grok-4.5", name: "Grok 4.5", chain: ["grok"] },
  { slug: "codex", name: "Codex (ChatGPT Pro)", chain: ["codex"] },
];

export const DEFAULT_MODEL = "glm-5.3-flash";

export const resolveCatalogModel = (slug: string | undefined): CatalogModel =>
  CATALOG.find((model) => model.slug === slug) ??
  CATALOG.find((model) => model.default === true) ??
  CATALOG[0]!;

/** Upstream model slug per provider id (differs from the Nero slug). */
export const upstreamModelSlug = (provider: RouterChainId, slug: string): string => {
  switch (provider) {
    case "baseten":
      return "zai-org/GLM-5.3-Flash";
    case "grok":
      return slug;
    case "codex":
      return process.env.NERO_CODEX_MODEL ?? "gpt-5-codex";
    default:
      // Z.ai first-party slugs; the legacy "z-ai/" prefix is gone.
      return slug.startsWith("glm-") ? slug : "glm-5.3-flash";
  }
};

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
