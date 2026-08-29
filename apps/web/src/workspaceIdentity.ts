import type { EnvironmentId } from "@t3tools/contracts";

/** URL workspace id is the connected workspace/environment id. */
export type WorkspaceId = EnvironmentId;

const LAST_WORKSPACE_STORAGE_KEY = "nero:last-workspace-id";

export function readLastWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY)?.trim();
  return value && value.length > 0 ? value : null;
}

export function writeLastWorkspaceId(workspaceId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, workspaceId);
}

export function workspaceIdFromEnvironmentId(environmentId: EnvironmentId): WorkspaceId {
  return environmentId;
}

export function environmentIdFromWorkspaceId(workspaceId: string): EnvironmentId {
  return workspaceId as EnvironmentId;
}
