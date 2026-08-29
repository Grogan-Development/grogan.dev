import { createFileRoute } from "@tanstack/react-router";
import { LoaderIcon, RefreshCwIcon, WorkflowIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import {
  listLoomEvents,
  LoomApiError,
  type LoomEvent,
  type LoomEventsPage,
} from "../lib/loomClient";

/**
 * The workspace CI page: the Loom event log — candidate verifications, CI
 * results, promotions. One row per event, newest first, "Load more" pages
 * through the cursor.
 */
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
  const date = new Date(ts * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CiPage() {
  const [page, setPage] = useState<LoomEventsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const events = page?.events ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">CI</h1>
        <Button variant="outline" size="sm" onClick={() => void load(null)} disabled={loading}>
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
      {!loading && error === null && events.length === 0 ? (
        <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
          No CI events yet. Submitting a feature candidate runs the pipeline and lands here.
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {events.map((event: LoomEvent) => (
          <div
            key={event.id}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
          >
            <WorkflowIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="w-44 shrink-0 truncate font-mono text-xs text-foreground">
              {event.kind}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {event.repos.join(", ")}
              {event.repos.length > 0 && eventSummary(event.payload).length > 0 ? " · " : ""}
              {eventSummary(event.payload)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatEventTime(event.ts)}
            </span>
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
