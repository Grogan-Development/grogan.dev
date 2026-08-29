/**
 * Loom web client — reads the daemon's same-origin loom proxy
 * (`/api/loom/*`), which forwards to the git/feature server with the
 * workspace's scoped token. Auth is the session cookie; no tokens here.
 */

export type LoomRepositoryBinding = {
  readonly repository: string;
  readonly baseRevision: string;
  readonly headRevision: string | null;
  readonly targetRef: string;
};

export type LoomScenario = {
  readonly name: string;
  readonly given: string;
  readonly when: string;
  readonly then: string;
};

export type LoomFeatureGate = "Draft" | "Approved" | "Accepted" | "Rejected";

export type LoomFeature = {
  readonly id: string;
  readonly title: string;
  readonly gate: LoomFeatureGate;
  readonly bindings: ReadonlyArray<LoomRepositoryBinding>;
  readonly scenarios: ReadonlyArray<LoomScenario>;
  readonly candidateId: string | null;
  readonly testsPassed: boolean | null;
  readonly jobId: string | null;
  readonly evidenceLog: string | null;
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

export class LoomApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LoomApiError";
    this.status = status;
  }
}

const loomFetch = async (path: string): Promise<unknown> => {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin" });
  } catch {
    throw new LoomApiError("The loom proxy is unreachable.", 0);
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") detail = body.error;
    } catch {
      // non-JSON body
    }
    throw new LoomApiError(
      detail || `Loom proxy rejected the request (${response.status}).`,
      response.status,
    );
  }
  return response.json();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseBindings = (value: unknown): ReadonlyArray<LoomRepositoryBinding> => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((binding) => {
    const base = isRecord(binding.base) ? binding.base : {};
    const head = isRecord(binding.head) ? binding.head : null;
    return {
      repository: String(binding.repository ?? base.repository ?? ""),
      baseRevision: String(base.revision ?? ""),
      headRevision: head === null ? null : String(head.revision ?? ""),
      targetRef: String(binding.target_ref ?? ""),
    };
  });
};

const parseFeature = (raw: unknown): LoomFeature => {
  if (!isRecord(raw)) throw new LoomApiError("Malformed feature payload.", 0);
  const candidate = isRecord(raw.candidate) ? raw.candidate : null;
  const evidence = candidate !== null && isRecord(candidate.evidence) ? candidate.evidence : null;
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    gate:
      raw.gate === "Approved" || raw.gate === "Accepted" || raw.gate === "Rejected"
        ? raw.gate
        : "Draft",
    bindings: parseBindings(raw.repositories),
    scenarios: Array.isArray(raw.scenarios)
      ? raw.scenarios.filter(isRecord).map((scenario) => ({
          name: String(scenario.name ?? ""),
          given: String(scenario.given ?? ""),
          when: String(scenario.when ?? ""),
          then: String(scenario.then ?? ""),
        }))
      : [],
    candidateId: candidate === null ? null : String(candidate.id ?? ""),
    testsPassed: evidence === null ? null : evidence.tests_passed === true,
    jobId: evidence === null ? null : String(evidence.job_id ?? ""),
    evidenceLog: evidence === null ? null : String(evidence.log ?? ""),
  };
};

export async function listLoomFeatures(): Promise<ReadonlyArray<LoomFeature>> {
  const raw = await loomFetch("/api/loom/features");
  if (!Array.isArray(raw)) throw new LoomApiError("Malformed features payload.", 0);
  return raw.map(parseFeature);
}

export async function getLoomFeature(featureId: string): Promise<LoomFeature> {
  return parseFeature(await loomFetch(`/api/loom/features/${encodeURIComponent(featureId)}`));
}

export async function listLoomEvents(
  input: {
    readonly cursor?: string | null | undefined;
  } = {},
): Promise<LoomEventsPage> {
  const query = input.cursor ? `?since=${encodeURIComponent(input.cursor)}` : "";
  const raw = await loomFetch(`/api/loom/events${query}`);
  if (!isRecord(raw) || !Array.isArray(raw.events)) {
    throw new LoomApiError("Malformed events payload.", 0);
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
}
