/**
 * Loom client — the git/feature server (loom.grogan.dev). The workspace's
 * scoped token (git/features/events perms) arrives via LOOM_URL/LOOM_TOKEN.
 * Reads only: features (FRs), their candidates/evidence, and the CI event
 * log. Writes stay in the loom CLI / owner flows.
 */
import * as Process from "node:process";

export const LOOM_DEFAULT_URL = "https://loom.grogan.dev";

export type LoomConfig = { readonly url: string; readonly token: string | undefined };

export const loomConfig = (): LoomConfig => {
  const rawUrl = Process.env.LOOM_URL;
  const rawToken = Process.env.LOOM_TOKEN;
  return {
    url: (typeof rawUrl === "string" && rawUrl.length > 0 ? rawUrl : LOOM_DEFAULT_URL).replace(
      /\/+$/,
      "",
    ),
    token: typeof rawToken === "string" && rawToken.length > 0 ? rawToken : undefined,
  };
};

export const isLoomConfigured = (): boolean => {
  const { token } = loomConfig();
  return token !== undefined && token.length > 0;
};

export class LoomUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoomUnavailableError";
  }
}

const loomFetch = async (path: string): Promise<unknown> => {
  const config = loomConfig();
  if (config.token === undefined || config.token.length === 0) {
    throw new LoomUnavailableError(
      "Loom is not configured on this workspace (LOOM_TOKEN missing).",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      headers: { authorization: `Bearer ${config.token}`, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new LoomUnavailableError(
      `Loom at ${config.url} is unreachable (${error instanceof Error ? error.message : "unknown"}).`,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new LoomUnavailableError("Loom rejected the workspace token (401/403).");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LoomUnavailableError(`Loom HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
};

// ——— Wire shapes (loomd serde: snake_case) ———

export type LoomRepositoryRevision = {
  readonly repository: string;
  readonly revision: string;
};

export type LoomRepositoryBinding = {
  readonly base: LoomRepositoryRevision;
  readonly head: LoomRepositoryRevision | null;
  readonly target_ref: string;
};

export type LoomScenario = {
  readonly name: string;
  readonly given: string;
  readonly when: string;
  readonly then: string;
};

export type LoomFeatureGate = "Draft" | "Approved" | "Accepted" | "Rejected";

export type LoomEvidence = {
  readonly digest: string;
  readonly tests_passed: boolean;
  readonly job_id: string;
  readonly log: string;
};

export type LoomCandidate = {
  readonly id: string;
  readonly evidence: LoomEvidence;
};

export type LoomFeature = {
  readonly id: string;
  readonly title: string;
  readonly gate: LoomFeatureGate;
  readonly repositories: ReadonlyArray<LoomRepositoryBinding>;
  readonly scenarios: ReadonlyArray<LoomScenario>;
  readonly candidate: LoomCandidate | null;
};

export type LoomEvent = {
  readonly id: string;
  readonly ts: number;
  readonly kind: string;
  readonly repos: ReadonlyArray<string>;
  readonly payload: unknown;
};

export type LoomEventsPage = {
  readonly events: ReadonlyArray<LoomEvent>;
  readonly cursor: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseBindings = (value: unknown): ReadonlyArray<LoomRepositoryBinding> => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((binding) => {
    const base = isRecord(binding.base) ? binding.base : {};
    const head = isRecord(binding.head) ? binding.head : null;
    return {
      base: {
        repository: String(base.repository ?? ""),
        revision: String(base.revision ?? ""),
      },
      head:
        head === null
          ? null
          : { repository: String(head.repository ?? ""), revision: String(head.revision ?? "") },
      target_ref: String(binding.target_ref ?? ""),
    };
  });
};

export const parseFeature = (raw: unknown): LoomFeature => {
  if (!isRecord(raw)) throw new LoomUnavailableError("Loom returned a malformed feature.");
  const candidate = isRecord(raw.candidate) ? raw.candidate : null;
  const evidence =
    candidate !== null && isRecord(candidate.evidence)
      ? {
          digest: String(candidate.evidence.digest ?? ""),
          tests_passed: candidate.evidence.tests_passed === true,
          job_id: String(candidate.evidence.job_id ?? ""),
          log: String(candidate.evidence.log ?? ""),
        }
      : null;
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    gate:
      raw.gate === "Approved" || raw.gate === "Accepted" || raw.gate === "Rejected"
        ? raw.gate
        : "Draft",
    repositories: parseBindings(raw.repositories),
    scenarios: Array.isArray(raw.scenarios)
      ? raw.scenarios.filter(isRecord).map((scenario) => ({
          name: String(scenario.name ?? ""),
          given: String(scenario.given ?? ""),
          when: String(scenario.when ?? ""),
          then: String(scenario.then ?? ""),
        }))
      : [],
    candidate:
      candidate === null || evidence === null ? null : { id: String(candidate.id ?? ""), evidence },
  };
};

export const listLoomFeatures = async (): Promise<ReadonlyArray<LoomFeature>> => {
  const raw = await loomFetch("/v1/features");
  if (!Array.isArray(raw)) {
    throw new LoomUnavailableError("Loom features response was not a list.");
  }
  return raw.map(parseFeature);
};

export const getLoomFeature = async (featureId: string): Promise<LoomFeature> => {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(featureId)) {
    throw new LoomUnavailableError("Invalid feature id.");
  }
  return parseFeature(await loomFetch(`/v1/features/${encodeURIComponent(featureId)}`));
};

export const listLoomEvents = async (
  input: {
    limit?: number | undefined;
    since?: string | undefined;
  } = {},
): Promise<LoomEventsPage> => {
  const params = new URLSearchParams();
  if (input.limit !== undefined)
    params.set("limit", String(Math.min(Math.max(input.limit, 1), 1000)));
  if (input.since !== undefined && input.since.length > 0) params.set("since", input.since);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const raw = await loomFetch(`/v1/events${query}`);
  if (!isRecord(raw) || !Array.isArray(raw.events)) {
    throw new LoomUnavailableError("Loom events response was malformed.");
  }
  return {
    events: raw.events.filter(isRecord).map((event) => ({
      id: String(event.id ?? ""),
      ts: typeof event.ts === "number" ? event.ts : 0,
      kind: String(event.kind ?? ""),
      repos: Array.isArray(event.repos) ? event.repos.map(String) : [],
      payload: event.payload,
    })),
    cursor: typeof raw.cursor === "string" ? raw.cursor : null,
  };
};
