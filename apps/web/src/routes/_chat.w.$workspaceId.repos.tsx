import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CopyIcon,
  FileIcon,
  FolderIcon,
  FolderGit2Icon,
  GitBranchIcon,
  LoaderIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "../components/ui/button";
import {
  getRepoBlob,
  listRepoCommits,
  listRepoRefs,
  listRepoTree,
  listLoomRepos,
  LoomApiError,
  type LoomBlob,
  type LoomCommit,
  type LoomRepo,
  type LoomRepoRef,
  type LoomTreeEntry,
} from "../lib/loomClient";

type ReposSearch = {
  repo?: string | undefined;
  ref?: string | undefined;
  path?: string | undefined;
  view?: "files" | "commits" | "map" | undefined;
};

function formatBytes(size: number | null): string {
  if (size === null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusLine(props: { readonly error: string | null; readonly onRefresh: () => void }) {
  const { error, onRefresh } = props;
  if (error === null) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
      <span className="min-w-0 flex-1">{error}</span>
      <Button size="sm" variant="outline" onClick={onRefresh}>
        <RefreshCwIcon aria-hidden className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

function RepoList(props: {
  readonly repos: ReadonlyArray<LoomRepo>;
  readonly onOpen: (repo: string) => void;
}) {
  const { repos, onOpen } = props;
  return (
    <div className="flex flex-col gap-1.5">
      {repos.map((repo) => (
        <div
          key={repo.name}
          className="flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5"
        >
          <FolderGit2Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="min-w-0 cursor-pointer truncate text-sm font-medium hover:underline"
                onClick={() => onOpen(repo.name)}
              >
                {repo.name}
              </button>
              <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {repo.protectedRef}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {repo.description.length > 0 ? repo.description : "No description."}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpen(repo.name)}>
            Browse
          </Button>
        </div>
      ))}
    </div>
  );
}

function CloneCommand(props: { readonly repo: string }) {
  const [copied, setCopied] = useState(false);
  const command = `git clone $LOOM_URL/git/${props.repo}.git`;
  return (
    <button
      type="button"
      aria-label="Copy clone command"
      className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent/40"
      onClick={() => {
        void navigator.clipboard.writeText(command);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        "copied!"
      ) : (
        <>
          <CopyIcon aria-hidden className="size-3" />
          <span className="truncate">{command}</span>
        </>
      )}
    </button>
  );
}

function BlobView(props: { readonly blob: LoomBlob }) {
  const { blob } = props;
  if (blob.binary) {
    return (
      <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground">
        Binary file ({formatBytes(blob.size)}) — not rendered.
      </p>
    );
  }
  const lines = blob.content.split("\n");
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-background/60">
      {blob.truncated ? (
        <p className="border-b border-border/60 px-3 py-1.5 text-xs text-muted-foreground">
          Showing the first 512 KB.
        </p>
      ) : null}
      <pre className="flex text-xs leading-5">
        <code className="select-none px-3 py-2 text-right text-muted-foreground/60">
          {lines.map((_, index) => `${index + 1}\n`).join("")}
        </code>
        <code className="min-w-0 flex-1 whitespace-pre-wrap px-3 py-2">{blob.content}</code>
      </pre>
    </div>
  );
}

function TreeView(props: {
  readonly entries: ReadonlyArray<LoomTreeEntry>;
  readonly onNavigate: (name: string, kind: "tree" | "blob") => void;
}) {
  const { entries, onNavigate } = props;
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-border/60 p-6 text-center text-sm text-muted-foreground">
        Empty directory.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {entries.map((entry) => (
        <button
          key={entry.name}
          type="button"
          className="flex w-full cursor-pointer items-center gap-2.5 border-b border-border/40 px-3 py-1.5 text-left text-sm last:border-b-0 hover:bg-accent/40"
          onClick={() => onNavigate(entry.name, entry.kind)}
        >
          {entry.kind === "tree" ? (
            <FolderIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.size)}</span>
          {entry.kind === "tree" ? (
            <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CommitsView(props: { readonly commits: ReadonlyArray<LoomCommit> }) {
  const { commits } = props;
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {commits.map((commit) => (
        <div
          key={commit.oid}
          className="flex min-w-0 items-center gap-3 border-b border-border/40 px-3 py-1.5 last:border-b-0"
        >
          <code className="shrink-0 font-mono text-xs text-muted-foreground">{commit.short}</code>
          <span className="min-w-0 flex-1 truncate text-sm">{commit.subject}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{commit.author}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{commit.date.slice(0, 10)}</span>
        </div>
      ))}
    </div>
  );
}

function MapPlaceholder(props: { readonly repo: string }) {
  const { repo } = props;
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-10 text-center">
      <p className="text-sm font-medium">Code Map for {repo} is coming soon.</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
        A navigable map of symbols, modules, and dependencies mined from this repo's git storage —
        scaffolded now, wired to real indexing next.
      </p>
    </div>
  );
}

function RepoBrowser(props: {
  readonly repo: LoomRepo;
  readonly search: ReposSearch;
  readonly onNavigate: (next: { [K in keyof ReposSearch]?: ReposSearch[K] | undefined }) => void;
}) {
  const { repo, search, onNavigate } = props;
  const view = search.view ?? "files";
  const ref = search.ref ?? "main";
  const path = search.path ?? "";
  const [refs, setRefs] = useState<ReadonlyArray<LoomRepoRef>>([]);
  const [entries, setEntries] = useState<ReadonlyArray<LoomTreeEntry>>([]);
  const [blob, setBlob] = useState<LoomBlob | null>(null);
  const [commits, setCommits] = useState<ReadonlyArray<LoomCommit>>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      if (view === "commits") {
        setCommits(await listRepoCommits(repo.name, ref, 50));
      } else if (view === "files") {
        const segments = path.split("/").filter((segment) => segment.length > 0);
        const last = segments.at(-1) ?? "";
        const looksLikeFile = last.includes(".");
        if (looksLikeFile) {
          setBlob(await getRepoBlob(repo.name, ref, path));
          setEntries([]);
        } else {
          setBlob(null);
          setEntries(await listRepoTree(repo.name, ref, path));
        }
      }
    } catch (cause) {
      setBlob(null);
      setEntries([]);
      setError(cause instanceof LoomApiError ? cause.message : "The repo request failed.");
    } finally {
      setPending(false);
    }
  }, [path, ref, repo.name, view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listRepoRefs(repo.name)
      .then(setRefs)
      .catch(() => setRefs([]));
  }, [repo.name]);

  const segments = useMemo(() => path.split("/").filter((s) => s.length > 0), [path]);
  const navigatePath = (next: string) => onNavigate({ path: next.length > 0 ? next : undefined });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost-muted" onClick={() => onNavigate({ repo: undefined })}>
          <ChevronRightIcon aria-hidden className="size-3.5 rotate-180" />
          Repos
        </Button>
        <span className="text-sm font-medium">{repo.name}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GitBranchIcon aria-hidden className="size-3.5" />
          <select
            className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-xs"
            value={ref}
            onChange={(event) => onNavigate({ ref: event.target.value, path: undefined })}
          >
            {(refs.length > 0 ? refs.map((candidate) => candidate.name) : [ref]).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1">
          {(["files", "commits", "map"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={view === tab ? "default" : "ghost-muted"}
              onClick={() => onNavigate({ view: tab })}
            >
              {tab === "files" ? "Files" : tab === "commits" ? "Commits" : "Code Map"}
            </Button>
          ))}
        </div>
      </div>

      <CloneCommand repo={repo.name} />

      {view === "map" ? (
        <MapPlaceholder repo={repo.name} />
      ) : view === "commits" ? (
        pending ? (
          <LoaderIcon aria-hidden className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <CommitsView commits={commits} />
        )
      ) : (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              className="cursor-pointer font-mono text-muted-foreground hover:underline"
              onClick={() => navigatePath("")}
            >
              {repo.name}
            </button>
            {segments.map((segment, index) => (
              <span key={`${segment}-${index}`} className="flex items-center gap-1">
                <span className="text-muted-foreground/60">/</span>
                <button
                  type="button"
                  className="cursor-pointer font-mono hover:underline"
                  onClick={() => navigatePath(segments.slice(0, index + 1).join("/"))}
                >
                  {segment}
                </button>
              </span>
            ))}
          </div>
          {pending ? (
            <LoaderIcon aria-hidden className="size-4 animate-spin text-muted-foreground" />
          ) : error !== null ? (
            <StatusLine error={error} onRefresh={() => void load()} />
          ) : blob !== null ? (
            <BlobView blob={blob} />
          ) : (
            <TreeView
              entries={entries}
              onNavigate={(name, kind) => {
                const next = path.length > 0 ? `${path}/${name}` : name;
                if (kind === "tree") {
                  navigatePath(next);
                } else {
                  onNavigate({ path: next });
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function ReposPage() {
  const { workspaceId } = Route.useParams();
  const navigateRoute = useNavigate();
  const search = Route.useSearch();
  const [repos, setRepos] = useState<ReadonlyArray<LoomRepo>>([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setRepos(await listLoomRepos());
    } catch (cause) {
      setError(
        cause instanceof LoomApiError
          ? cause.message
          : "The Loom proxy is unreachable from this workspace.",
      );
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const navigate = useCallback(
    (next: { [K in keyof ReposSearch]?: ReposSearch[K] | undefined }) => {
      void navigateRoute({
        to: "/w/$workspaceId/repos",
        search: (previous: ReposSearch) => ({ ...previous, ...next }),
        params: { workspaceId },
      });
    },
    [navigateRoute, workspaceId],
  );

  const activeRepo = useMemo(
    () =>
      search.repo === undefined ? null : (repos.find((repo) => repo.name === search.repo) ?? null),
    [repos, search.repo],
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 pt-6 pb-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Repos</h1>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={pending}>
          <RefreshCwIcon aria-hidden className={pending ? "size-4 animate-spin" : "size-4"} />
          Refresh
        </Button>
      </div>
      {search.repo !== undefined && activeRepo !== null ? (
        <RepoBrowser repo={activeRepo} search={search} onNavigate={navigate} />
      ) : search.repo !== undefined && !pending && repos.length === 0 ? (
        <StatusLine error={error ?? "Repository not found."} onRefresh={() => void load()} />
      ) : search.repo !== undefined ? (
        <LoaderIcon aria-hidden className="size-4 animate-spin text-muted-foreground" />
      ) : pending ? (
        <LoaderIcon aria-hidden className="size-4 animate-spin text-muted-foreground" />
      ) : error !== null ? (
        <StatusLine error={error} onRefresh={() => void load()} />
      ) : repos.length === 0 ? (
        <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
          No repos on the Loom server yet. Import one with{" "}
          <code className="font-mono text-xs">loom repo import</code> or ask the agent to.
        </div>
      ) : (
        <RepoList repos={repos} onOpen={(repo) => navigate({ repo })} />
      )}
    </div>
  );
}

export const Route = createFileRoute("/_chat/w/$workspaceId/repos")({
  validateSearch: (search: Record<string, unknown>): ReposSearch => ({
    repo: typeof search.repo === "string" ? search.repo : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
    path: typeof search.path === "string" ? search.path : undefined,
    view: search.view === "commits" || search.view === "map" ? search.view : ("files" as const),
  }),
  component: ReposPage,
});
