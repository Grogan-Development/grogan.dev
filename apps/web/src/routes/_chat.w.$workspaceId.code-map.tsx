import { createFileRoute } from "@tanstack/react-router";
import { MapIcon } from "lucide-react";

import { Link, useNavigate } from "@tanstack/react-router";

/**
 * Code Map placeholder: a navigable map of symbols, modules, and dependencies
 * mined from the Loom repos this workspace is a git customer of. The surface
 * ships now so the feature has a home; real indexing lands next.
 */
function CodeMapPage() {
  const { workspaceId } = Route.useParams();
  const navigateRoute = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Code Map</h1>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-accent/40"
          onClick={() =>
            void navigateRoute({
              to: "/w/$workspaceId/repos",
              params: { workspaceId },
            })
          }
        >
          Browse Repos
        </button>
      </div>
      <div className="rounded-lg border border-dashed border-border/60 p-12 text-center">
        <MapIcon aria-hidden className="mx-auto size-8 text-muted-foreground/60" />
        <p className="mt-4 text-sm font-medium">The Code Map is coming soon.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          One map across every Loom repo this workspace can see: modules, symbols, dependency edges,
          and the features that touch them — mined straight from git storage, no clone required.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_chat/w/$workspaceId/code-map")({
  component: CodeMapPage,
});
