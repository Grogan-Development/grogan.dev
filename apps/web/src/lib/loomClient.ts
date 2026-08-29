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

// ——— Repo browsing (read-only git over the daemon's Loom proxy) ———

export type LoomRepo = {
  readonly name: string;
  readonly protectedRef: string;
  readonly ci: string;
  readonly description: string;
};

export type LoomRepoRef = { readonly name: string; readonly oid: string };

export type LoomTreeEntry = {
  readonly name: string;
  readonly kind: "tree" | "blob";
  readonly size: number | null;
  readonly oid: string;
};

export type LoomBlob = {
  readonly path: string;
  readonly size: number;
  readonly truncated: boolean;
  readonly binary: boolean;
  readonly encoding: "utf8" | "base64";
  readonly content: string;
};

export type LoomCommit = {
  readonly oid: string;
  readonly short: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
};

export async function listLoomRepos(): Promise<ReadonlyArray<LoomRepo>> {
  const raw = await loomFetch("/api/loom/repos");
  if (!Array.isArray(raw)) throw new LoomApiError("Malformed repos payload.", 0);
  return raw.filter(isRecord).map((repo) => ({
    name: String(repo.name ?? ""),
    protectedRef: String(repo.protected_ref ?? "refs/main"),
    ci: String(repo.ci ?? ""),
    description: String(repo.description ?? ""),
  }));
}

export async function listRepoRefs(repo: string): Promise<ReadonlyArray<LoomRepoRef>> {
  const raw = await loomFetch(`/api/loom/repos/${encodeURIComponent(repo)}/refs`);
  if (!Array.isArray(raw)) throw new LoomApiError("Malformed refs payload.", 0);
  return raw.filter(isRecord).map((ref) => ({
    name: String(ref.name ?? ""),
    oid: String(ref.oid ?? ""),
  }));
}

export async function listRepoTree(
  repo: string,
  ref: string,
  path: string,
): Promise<ReadonlyArray<LoomTreeEntry>> {
  const query = new URLSearchParams({ ref, path });
  const raw = await loomFetch(`/api/loom/repos/${encodeURIComponent(repo)}/tree?${query}`);
  if (!Array.isArray(raw)) throw new LoomApiError("Malformed tree payload.", 0);
  return raw.filter(isRecord).map((entry) => ({
    name: String(entry.name ?? ""),
    kind: entry.kind === "tree" ? ("tree" as const) : ("blob" as const),
    size: typeof entry.size === "number" ? entry.size : null,
    oid: String(entry.oid ?? ""),
  }));
}

export async function getRepoBlob(repo: string, ref: string, path: string): Promise<LoomBlob> {
  const query = new URLSearchParams({ ref, path });
  const raw = await loomFetch(`/api/loom/repos/${encodeURIComponent(repo)}/blob?${query}`);
  if (!isRecord(raw)) throw new LoomApiError("Malformed blob payload.", 0);
  return {
    path: String(raw.path ?? path),
    size: typeof raw.size === "number" ? raw.size : 0,
    truncated: raw.truncated === true,
    binary: raw.binary === true,
    encoding: raw.encoding === "base64" ? "base64" : "utf8",
    content: String(raw.content ?? ""),
  };
}

export async function listRepoCommits(
  repo: string,
  ref: string,
  limit = 30,
): Promise<ReadonlyArray<LoomCommit>> {
  const query = new URLSearchParams({ ref, limit: String(limit) });
  const raw = await loomFetch(`/api/loom/repos/${encodeURIComponent(repo)}/commits?${query}`);
  if (!Array.isArray(raw)) throw new LoomApiError("Malformed commits payload.", 0);
  return raw.filter(isRecord).map((commit) => ({
    oid: String(commit.oid ?? ""),
    short: String(commit.short ?? ""),
    author: String(commit.author ?? ""),
    date: String(commit.date ?? ""),
    subject: String(commit.subject ?? ""),
  }));
}
