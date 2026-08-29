import { ChevronDownIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SidebarMenuButton } from "./ui/sidebar";
import { Popover, PopoverPopup, PopoverTrigger } from "./ui/popover";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogPopup,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { Button } from "./ui/button";
import {
  createNeroWorkspace,
  deleteNeroWorkspace,
  ensureNeroWorkspaceAwake,
  isNeroHostAuthError,
  listNeroWorkspaces,
  neroHostErrorMessage,
  neroWorkspaceIdFromPath,
  NERO_LOGIN_PATH,
  stopNeroWorkspace,
  wakeNeroWorkspace,
  type NeroWorkspace,
} from "~/lib/neroHost";

const STATE_BADGE: Record<NeroWorkspace["state"], { label: string; className: string }> = {
  running: {
    label: "Running",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  queued: { label: "Queued", className: "border-amber-500/40 bg-amber-500/10 text-amber-500" },
  stopped: { label: "Stopped", className: "border-border bg-muted text-muted-foreground" },
};

function StateBadge({ state }: { state: NeroWorkspace["state"] }) {
  const badge = STATE_BADGE[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] leading-4 font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

function StateDot({ state }: { state: NeroWorkspace["state"] }) {
  const color =
    state === "running"
      ? "bg-emerald-500"
      : state === "queued"
        ? "bg-amber-500"
        : "bg-muted-foreground/50";
  return <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${color}`} />;
}

/**
 * Sidebar control for the current workspace: name + state, opening a dialog
 * that manages every workspace via the host control plane. Rows open with a
 * click (a workspace switch is a machine switch, so Open hard-navigates to
 * `/w/:id/` for a clean remount); secondary and destructive actions live in
 * the row's overflow menu, with delete behind a confirm.
 */
export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<NeroWorkspace[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NeroWorkspace | null>(null);
  const [newName, setNewName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentId(neroWorkspaceIdFromPath(window.location.pathname));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listNeroWorkspaces();
      setWorkspaces(list);
      setLoadError(null);
      setAuthExpired(false);
    } catch (error) {
      // Silent on the trigger: the name label falls back to the workspace id
      // until the list loads (errors surface when the popover opens).
      if (!open) return;
      if (isNeroHostAuthError(error)) {
        setAuthExpired(true);
      } else {
        setLoadError(neroHostErrorMessage(error));
      }
    }
  }, [open]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 4000);
    return () => {
      window.clearInterval(timer);
    };
  }, [open, refresh]);

  const current = useMemo(
    () => workspaces?.find((workspace) => workspace.id === currentId) ?? null,
    [workspaces, currentId],
  );
  const currentLabel = current?.name ?? currentId ?? "Workspaces";
  const currentState = current?.state ?? "stopped";

  const openWorkspace = useCallback((workspace: NeroWorkspace) => {
    // A stopped workspace must be woken before navigating: `/w/:id/` on a
    // stopped workspace loads the SPA shell with no daemon behind it — every
    // call 502s into an endless "Reconnecting…". The wake POST blocks until
    // the daemon is healthy, so keep the row busy as feedback until then.
    if (workspace.state === "running") {
      setOpen(false);
      window.location.assign(`/w/${workspace.id}/`);
      return;
    }
    setBusyId(workspace.id);
    void ensureNeroWorkspaceAwake(workspace)
      .then((awake) => {
        if (awake.state !== "running") {
          setLoadError(
            `“${workspace.name}” is ${awake.state} — admission is waiting for another workspace to sleep.`,
          );
          setBusyId(null);
          return;
        }
        window.location.assign(`/w/${awake.id}/`);
      })
      .catch((error) => {
        setBusyId(null);
        if (isNeroHostAuthError(error)) {
          setAuthExpired(true);
        } else {
          setLoadError(neroHostErrorMessage(error));
        }
      });
  }, []);

  const runAction = useCallback(
    async (id: string, action: "wake" | "stop") => {
      setBusyId(id);
      try {
        if (action === "wake") {
          await wakeNeroWorkspace(id);
        } else {
          await stopNeroWorkspace(id);
        }
        await refresh();
      } catch (error) {
        if (isNeroHostAuthError(error)) {
          setAuthExpired(true);
        } else {
          setLoadError(neroHostErrorMessage(error));
        }
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const create = useCallback(async () => {
    setBusyId("__creating__");
    try {
      const workspace = await createNeroWorkspace(
        newName.trim().length > 0 ? newName.trim() : null,
      );
      setNewName("");
      // createNeroWorkspace blocks until the daemon is healthy, so the new
      // workspace is already running — navigate straight in.
      setOpen(false);
      window.location.assign(`/w/${workspace.id}/`);
    } catch (error) {
      if (isNeroHostAuthError(error)) {
        setAuthExpired(true);
      } else {
        setLoadError(neroHostErrorMessage(error));
      }
      setBusyId(null);
    }
  }, [newName]);

  const confirmDelete = useCallback(async () => {
    if (pendingDelete === null) return;
    const target = pendingDelete;
    setPendingDelete(null);
    setBusyId(target.id);
    try {
      await deleteNeroWorkspace(target.id);
      if (target.id === currentId) {
        // The dataset is gone under our feet; go home rather than 503.
        window.location.assign("/");
        return;
      }
      await refresh();
    } catch (error) {
      if (isNeroHostAuthError(error)) {
        setAuthExpired(true);
      } else {
        setLoadError(neroHostErrorMessage(error));
      }
    } finally {
      setBusyId(null);
    }
  }, [currentId, pendingDelete, refresh]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <SidebarMenuButton
              aria-label="Switch workspace"
              className="min-w-0 flex-1 ps-[calc(var(--sidebar-row-content-inset)-1px)] focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            />
          }
        >
          <StateDot state={currentState} />
          <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          <ChevronDownIcon className="-mr-px size-4 shrink-0" />
        </PopoverTrigger>
        <PopoverPopup align="start" className="w-80 p-1.5">
          {authExpired ? (
            <div className="flex flex-col gap-2 p-2 text-sm">
              <p className="text-muted-foreground">Your Nero session has expired.</p>
              <a href={NERO_LOGIN_PATH}>
                <Button size="sm" className="w-full">
                  Sign in
                </Button>
              </a>
            </div>
          ) : (
            <>
              {showCreateForm ? (
                <form
                  className="flex items-center gap-1.5 p-1 pb-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void create();
                  }}
                >
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="Workspace name (optional)"
                    aria-label="Workspace name"
                    autoFocus
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="submit" size="sm" disabled={busyId === "__creating__"}>
                    {busyId === "__creating__" ? "Creating…" : "Create"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground/90 hover:bg-accent hover:text-foreground"
                >
                  <PlusIcon className="size-4 shrink-0" />
                  New workspace
                </button>
              )}
              {loadError ? <p className="p-2 text-xs text-destructive">{loadError}</p> : null}
              <div className="max-h-80 overflow-y-auto">
                {(workspaces ?? []).map((workspace) => {
                  const isCurrent = workspace.id === currentId;
                  const isBusy = busyId === workspace.id;
                  return (
                    <div
                      key={workspace.id}
                      className={`group/wrow flex min-w-0 items-center gap-1 rounded-md pr-1 ${isCurrent ? "bg-accent/60" : "hover:bg-accent"}`}
                    >
                      <button
                        type="button"
                        onClick={() => openWorkspace(workspace)}
                        disabled={isBusy}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5 text-left disabled:pointer-events-none"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {workspace.name}
                          </span>
                          {isCurrent ? (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              current
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {isBusy && workspace.state !== "running" ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] leading-4 font-medium text-amber-500">
                              Waking…
                            </span>
                          ) : (
                            <StateBadge state={workspace.state} />
                          )}
                          {workspace.connected ? (
                            <span className="text-[10px] text-muted-foreground">Connected</span>
                          ) : null}
                          {workspace.agentWorking ? (
                            <span className="text-[10px] text-muted-foreground">Agent working</span>
                          ) : null}
                        </span>
                      </button>
                      <Menu>
                        <MenuTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Workspace actions for ${workspace.name}`}
                              disabled={isBusy}
                              className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/wrow:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-50 data-popup-open:opacity-100 hover:bg-accent hover:text-foreground"
                            />
                          }
                        >
                          {isBusy ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <MoreHorizontalIcon className="size-4" />
                          )}
                        </MenuTrigger>
                        <MenuPopup align="end" className="w-36">
                          {workspace.state === "running" ? (
                            <MenuItem onClick={() => void runAction(workspace.id, "stop")}>
                              Stop
                            </MenuItem>
                          ) : (
                            <MenuItem onClick={() => void runAction(workspace.id, "wake")}>
                              Wake
                            </MenuItem>
                          )}
                          {isCurrent ? null : (
                            <MenuItem onClick={() => openWorkspace(workspace)}>Open</MenuItem>
                          )}
                          <MenuItem
                            className="text-destructive data-highlighted:text-destructive"
                            onClick={() => setPendingDelete(workspace)}
                          >
                            Delete…
                          </MenuItem>
                        </MenuPopup>
                      </Menu>
                    </div>
                  );
                })}
                {workspaces !== null && workspaces.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">
                    No workspaces yet — create your first one above.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </PopoverPopup>
      </Popover>
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogTitle>Delete “{pendingDelete?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently destroys the workspace — the container and its dataset, including every
            thread and file. This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete workspace
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
