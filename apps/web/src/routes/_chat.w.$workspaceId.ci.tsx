import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRightIcon, LoaderIcon, RefreshCwIcon, WorkflowIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/button";
import {
  listLoomEvents,
  LoomApiError,
  type LoomEvent,
  type LoomEventsPage,
} from "../lib/loomClient";

/**
 * The workspace CI page: the Loom event log with real observation tools —
 * repo and kind filters, a live auto-refresh, and expandable raw payloads.
 * One row per event, newest first; "Load more" pages through the cursor.
 */
const AUTO_REFRESH_MS = 30_000;

function eventSummary(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) return "";
  const record = payload as Record<string, unknown>;
  const parts: Array<string> = [];
  for (const key of ["job_id", "feature", "feature_id", "repo", "revision", "digest"]) {
    if (typeof record[key] === "string" && (record[key] as string).length > 0) {
      parts.push(`${key} ${(record[key] as string).slice(0, 16)}`);
    }
  }
  if (typeof record.tests_passed === "boolean") {
    parts.push(record.tests_passed ? "tests ✓" : "tests ✗");
  }
  return parts.join(" · ");
}

function formatEventTime(ts: number): string {
  if (ts <= 0) return "";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function payloadTone(event: LoomEvent): string {
  if (typeof event.payload !== "object" || event.payload === null) return "";
  const passed = (event.payload as Record<string, unknown>).tests_passed;
  if (passed === true) return "bg-success";
  if (passed === false) return "bg-destructive";
  return "";
}

function EventRow(props: { readonly event: LoomEvent }) {
  const { event } = props;
  const [open, setOpen] = useState(false);
  const summary = eventSummary(event.payload);
  const hasPayload = event.payload !== null && typeof event.payload === "object";
  return (
    <div className="rounded-lg border border-border/60 bg-background/60">
      <button
        type="button"
        className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/40"
        onClick={() => hasPayload && setOpen((value) => !value)}
      >
        <span className="relative inline-flex shrink-0">
          <WorkflowIcon aria-hidden className="size-4 text-muted-foreground" />
          <span
            aria-hidden
            className={`absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-background ${payloadTone(event)}`}
          />
        </span>
        <span className="w-44 shrink-0 truncate font-mono text-xs text-foreground">
          {event.kind}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {event.repos.join(", ")}
          {event.repos.length > 0 && summary.length > 0 ? " · " : ""}
          {summary}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{formatEventTime(event.ts)}</span>
        {hasPayload ? (
          <ChevronRightIcon
            aria-hidden
            className={`size-3.5 shrink-0 text-muted-foreground/60 transition-transform ${open ? "rotate-90" : ""}`}
          />
        ) : null}
      </button>
      {open && hasPayload ? (
        <pre className="overflow-x-auto border-t border-border/40 px-3 py-2 font-mono text-[11px] leading-4 text-muted-foreground">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function CiPage() {
  const { workspaceId } = Route.useParams();
  const [page, setPage] = useState<LoomEventsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<string>("");

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const next = await listLoomEvents({ cursor });
      setPage((current) =>
        current === null || cursor === null
          ? next
          : {
              events: [...current.events, ...next.events],
              cursor: next.cursor,
            },
      );
    } catch (cause) {
      setError(
        cause instanceof LoomApiError
          ? cause.message
          : "The CI event log could not be loaded from Loom.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      void load(null);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, load]);

  const events = page?.events ?? [];
  const repoOptions = useMemo(() => {
    const names = new Set<string>();
    for (const event of events) {
      for (const repo of event.repos) names.add(repo);
    }
    return [...names].sort();
  }, [events]);

  const visible = events.filter((event) => {
    if (repoFilter.length > 0 && !event.repos.includes(repoFilter)) return false;
    if (kindFilter.length > 0 && !event.kind.toLowerCase().includes(kindFilter.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">CI</h1>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={live}
              onChange={(event) => setLive(event.target.checked)}
              className="accent-primary"
            />
            Live
          </label>
          <Button variant="outline" size="sm" onClick={() => void load(null)} disabled={loading}>
            {loading ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <select
          aria-label="Filter by repository"
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
          value={repoFilter}
          onChange={(event) => setRepoFilter(event.target.value)}
        >
          <option value="">All repos</option>
          {repoOptions.map((repo) => (
            <option key={repo} value={repo}>
              {repo}
            </option>
          ))}
        </select>
        <input
          aria-label="Filter by event kind"
          placeholder="Filter kinds (e.g. push, ci)"
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs placeholder:text-muted-foreground/60"
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value)}
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          {visible.length === events.length
            ? `${events.length} events`
            : `${visible.length} of ${events.length}`}
        </span>
      </div>

      {error !== null ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {!loading && error === null && visible.length === 0 ? (
        <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
          {events.length === 0
            ? "No CI events yet. Submitting a feature candidate runs the pipeline and lands here."
            : "No events match the current filters."}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {visible.map((event) => (
          <div key={event.id} className="flex flex-col gap-1">
            <EventRow event={event} />
            {event.repos.length > 0 ? (
              <div className="flex gap-1 px-3">
                {event.repos.map((repo) => (
                  <Link
                    key={repo}
                    to="/w/$workspaceId/repos"
                    params={{ workspaceId }}
                    search={{ repo }}
                    className="text-[11px] text-muted-foreground/70 underline-offset-2 hover:underline"
                  >
                    browse {repo}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {page?.cursor !== null && page !== null && events.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => void load(page.cursor)} disabled={loading}>
          {loading ? <LoaderIcon className="size-4 animate-spin" /> : null}
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export const Route = createFileRoute("/_chat/w/$workspaceId/ci")({
  component: CiPage,
});
