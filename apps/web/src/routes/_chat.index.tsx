import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { APP_DISPLAY_NAME } from "~/branding";
import { SidebarInset } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import {
  createNeroWorkspace,
  ensureNeroWorkspaceAwake,
  isNeroHostAuthError,
  listNeroWorkspaces,
  NERO_LOGIN_PATH,
  neroHostErrorMessage,
  type NeroWorkspace,
} from "../lib/neroHost";
import { readLastWorkspaceId } from "../workspaceIdentity";

/**
 * `/` is no longer a management surface — workspace management lives in the
 * sidebar switcher. Landing here sends you straight into a workspace;
 * first-run users get a minimal create screen.
 */
function ChatIndexRedirect() {
  const [phase, setPhase] = useState<"loading" | "starting" | "first-run" | "auth">("loading");
  const [startingName, setStartingName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const start = useCallback(async (target: NeroWorkspace) => {
    // Never navigate into a stopped workspace: the SPA shell would load but
    // every daemon-bound call 502s (stopped workspaces have no proxy
    // socket), which reads as "login is broken". Wake first; the host's wake
    // blocks until the guest daemon is healthy.
    setPhase("starting");
    setStartingName(target.name);
    setError(null);
    try {
      const awake = await ensureNeroWorkspaceAwake(target);
      if (awake.state !== "running") {
        setError(
          `“${target.name}” is ${awake.state} — admission is waiting for another workspace to sleep. Try again shortly.`,
        );
        setPhase("first-run");
        return;
      }
      window.location.assign(`/w/${awake.id}/`);
    } catch (wakeError) {
      if (isNeroHostAuthError(wakeError)) {
        setPhase("auth");
        return;
      }
      setError(neroHostErrorMessage(wakeError));
      setPhase("first-run");
    }
  }, []);

  const redirect = useCallback(
    (workspaces: NeroWorkspace[]) => {
      if (workspaces.length === 0) {
        setPhase("first-run");
        return;
      }
      const last = readLastWorkspaceId();
      const lastWorkspace = workspaces.find((workspace) => workspace.id === last) ?? null;
      // Prefer an already-running workspace so a fresh login lands somewhere
      // live; only pay the wake cost when nothing is running.
      const target =
        workspaces.find((workspace) => workspace.state === "running") ??
        lastWorkspace ??
        workspaces[0];
      if (!target) {
        setPhase("first-run");
        return;
      }
      void start(target);
    },
    [start],
  );

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    void (async () => {
      try {
        const workspaces = await listNeroWorkspaces();
        if (!cancelled) redirect(workspaces);
      } catch (error) {
        if (cancelled) return;
        if (isNeroHostAuthError(error)) {
          setPhase("auth");
        } else {
          setError(neroHostErrorMessage(error));
          setPhase("first-run");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redirect, reloadKey]);

  const create = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const workspace = await createNeroWorkspace(name.trim().length > 0 ? name.trim() : null);
      window.location.assign(`/w/${workspace.id}/`);
    } catch (error) {
      if (isNeroHostAuthError(error)) {
        setPhase("auth");
      } else {
        setError(neroHostErrorMessage(error));
      }
      setCreating(false);
    }
  }, [name]);

  const showCreateForm = phase === "first-run";

  return (
    <SidebarInset className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <p className="text-sm font-medium text-muted-foreground">{APP_DISPLAY_NAME}</p>
      {phase === "loading" || phase === "starting" ? (
        <>
          <Spinner className="size-6" />
          <p className="text-sm text-muted-foreground">
            {phase === "starting"
              ? `Starting “${startingName ?? "workspace"}” — this can take up to a minute.`
              : "Loading…"}
          </p>
        </>
      ) : null}
      {phase === "auth" ? (
        <>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
          <a href={NERO_LOGIN_PATH}>
            <Button size="sm">Sign in</Button>
          </a>
        </>
      ) : null}
      {showCreateForm ? (
        <>
          <p className="text-sm text-muted-foreground">Create your first workspace to start.</p>
          <form
            className="flex w-full max-w-sm items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workspace name (optional)"
              aria-label="Workspace name"
              autoFocus
            />
            <Button type="submit" disabled={creating}>
              {creating ? <Spinner className="size-4" /> : null}
              Create workspace
            </Button>
          </form>
          {error ? (
            <>
              <p className="max-w-sm text-center text-xs text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRedirect,
});
