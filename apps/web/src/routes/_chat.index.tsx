import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { APP_DISPLAY_NAME } from "~/branding";
import { SidebarInset } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import {
  createNeroWorkspace,
  isNeroHostAuthError,
  listNeroWorkspaces,
  NERO_LOGIN_PATH,
  neroHostErrorMessage,
  type NeroWorkspace,
} from "../lib/neroHost";
import { readLastWorkspaceId } from "../workspaceIdentity";

/**
 * `/` is no longer a management surface — workspace management lives in the
 * sidebar switcher. Landing here sends you straight back into your last
 * workspace; first-run users get a minimal create screen.
 */
function ChatIndexRedirect() {
  const [phase, setPhase] = useState<"loading" | "first-run" | "auth">("loading");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirect = useCallback((workspaces: NeroWorkspace[]) => {
    if (workspaces.length === 0) {
      setPhase("first-run");
      return;
    }
    const last = readLastWorkspaceId();
    const target = workspaces.find((workspace) => workspace.id === last) ?? workspaces[0];
    if (!target) {
      setPhase("first-run");
      return;
    }
    window.location.assign(`/w/${target.id}/`);
  }, []);

  useEffect(() => {
    let cancelled = false;
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
  }, [redirect]);

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

  return (
    <SidebarInset className="flex h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <p className="text-sm font-medium text-muted-foreground">{APP_DISPLAY_NAME}</p>
      {phase === "loading" ? <Spinner className="size-6" /> : null}
      {phase === "auth" ? (
        <>
          <p className="text-sm text-muted-foreground">Sign in to continue.</p>
          <a href={NERO_LOGIN_PATH}>
            <Button size="sm">Sign in</Button>
          </a>
        </>
      ) : null}
      {phase === "first-run" ? (
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
        </>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRedirect,
});
