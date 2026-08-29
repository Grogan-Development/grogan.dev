import type { EnvironmentId } from "@t3tools/contracts";
import { Link, createFileRoute } from "@tanstack/react-router";
import { GitPullRequestIcon, LoaderIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import {
  listLoomFeatures,
  LoomApiError,
  type LoomFeature,
  type LoomFeatureGate,
} from "../lib/loomClient";

/**
 * The workspace FR list, powered by Loom features (the two-gate contract that
 * replaces pull requests). Loom owns this page: approval, candidates, CI
 * evidence, and acceptance all read from the feature server.
 */
type PullRequestsSearch = { involvement?: string; state?: string };

const GATE_GROUPS: ReadonlyArray<{
  readonly gate: LoomFeatureGate;
  readonly heading: string;
  readonly blurb: string;
}> = [
  { gate: "Approved", heading: "Approved — ready for a candidate", blurb: "Gate 1 passed." },
  { gate: "Draft", heading: "Draft — awaiting approval", blurb: "Needs owner sign-off before CI." },
  { gate: "Accepted", heading: "Accepted — landed", blurb: "Promoted to protected refs." },
  { gate: "Rejected", heading: "Rejected", blurb: "Candidate kept for diagnosis." },
];

function FeatureRow(props: { readonly feature: LoomFeature; readonly workspaceId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { feature, workspaceId } = props;
  const repoLabel =
    feature.bindings.length > 0
      ? feature.bindings.map((binding) => binding.repository).join(", ")
      : "no bindings";
  return (
    <div className="rounded-lg border border-border/60 bg-background/60">
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col gap-1 rounded-lg px-3 py-2.5 text-left hover:bg-accent/40"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <GitPullRequestIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{feature.title}</span>
          {feature.candidateId !== null ? (
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] leading-4 font-medium ${
                feature.testsPassed === true
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              CI {feature.testsPassed === true ? "passed" : "failed"}
            </span>
          ) : (
            <span className="shrink-0 text-[10px] text-muted-foreground">no candidate</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{repoLabel}</span>
          {feature.scenarios.length > 0 ? (
            <span className="shrink-0">{feature.scenarios.length} scenario(s)</span>
          ) : null}
        </span>
      </button>
      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-border/60 px-3 py-3 text-sm">
          {feature.bindings.map((binding) => (
            <div key={`${binding.repository}:${binding.targetRef}`} className="text-xs">
              <Link
                to="/w/$workspaceId/repos"
                params={{ workspaceId }}
                search={{ repo: binding.repository }}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {binding.repository}
              </Link>
              <span className="text-muted-foreground">
                {" "}
                → {binding.targetRef}
                {binding.headRevision !== null
                  ? ` (head ${binding.headRevision.slice(0, 12)})`
                  : ""}
              </span>
            </div>
          ))}
          {feature.scenarios.map((scenario) => (
            <div key={scenario.name} className="rounded-md border border-border/50 p-2 text-xs">
              <p className="font-medium">{scenario.name}</p>
              <p className="text-muted-foreground">
                Given {scenario.given} — when {scenario.when} — then {scenario.then}
              </p>
            </div>
          ))}
          {feature.evidenceLog !== null ? (
            <pre className="max-h-48 overflow-y-auto rounded-md bg-muted/60 p-2 text-[11px] whitespace-pre-wrap text-muted-foreground">
              {feature.evidenceLog}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PullRequestsPage() {
  const { workspaceId } = Route.useParams();
  const [features, setFeatures] = useState<ReadonlyArray<LoomFeature> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFeatures(await listLoomFeatures());
    } catch (cause) {
      setFeatures([]);
      setError(
        cause instanceof LoomApiError
          ? cause.message
          : "The FR list could not be loaded from Loom.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pull Requests</h1>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          Refresh
        </Button>
      </div>
      {error !== null ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {features === null && error === null ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderIcon className="size-4 animate-spin" /> Loading features from Loom…
        </div>
      ) : null}
      {features !== null && features.length === 0 && error === null ? (
        <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
          No features yet. Create one with the loom CLI or ask the agent to.
        </div>
      ) : null}
      {GATE_GROUPS.map((group) => {
        const groupFeatures = (features ?? []).filter((feature) => feature.gate === group.gate);
        if (groupFeatures.length === 0) return null;
        return (
          <section key={group.gate} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-foreground">{group.heading}</h2>
            <p className="text-xs text-muted-foreground">{group.blurb}</p>
            <div className="flex flex-col gap-2">
              {groupFeatures.map((feature) => (
                <FeatureRow key={feature.id} feature={feature} workspaceId={workspaceId} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export const Route = createFileRoute("/_chat/w/$workspaceId/pull-requests")({
  validateSearch: (raw: Record<string, unknown>): { involvement: string; state: string } => ({
    involvement: typeof raw.involvement === "string" ? raw.involvement : "all",
    state: typeof raw.state === "string" ? raw.state : "open",
  }),
  component: PullRequestsPage,
});
