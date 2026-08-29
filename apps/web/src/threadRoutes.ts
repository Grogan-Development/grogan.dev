import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import type { DraftId } from "./composerDraftStore";
import { environmentIdFromWorkspaceId, type WorkspaceId } from "./workspaceIdentity";

export const THREAD_ROUTE = "/w/$workspaceId/$threadId";
export const DRAFT_ROUTE = "/w/$workspaceId/draft/$draftId";
export const WORKSPACE_ROUTE = "/w/$workspaceId";
export const WORKSPACE_PULL_REQUESTS_ROUTE = "/w/$workspaceId/pull-requests";

export type ThreadRouteTarget =
  | {
      kind: "server";
      threadRef: ScopedThreadRef;
    }
  | {
      kind: "draft";
      draftId: DraftId;
    };

type DraftThreadRouteState = {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  promotedTo?: ScopedThreadRef | null;
};

export type ThreadRouteRenderState = "loading" | "ready" | "missing";

export function resolveThreadRouteRenderState(input: {
  bootstrapComplete: boolean;
  serverThreadShellExists: boolean;
  serverThreadDetailExists: boolean;
  serverThreadDetailDeleted: boolean;
  draftThreadExists: boolean;
}): ThreadRouteRenderState {
  if (!input.bootstrapComplete) {
    return "loading";
  }
  if (input.serverThreadDetailExists || input.draftThreadExists) {
    return "ready";
  }
  if (input.serverThreadDetailDeleted) {
    return "missing";
  }
  return input.serverThreadShellExists ? "loading" : "missing";
}

export function buildThreadRouteParams(ref: ScopedThreadRef): {
  workspaceId: WorkspaceId;
  threadId: ThreadId;
} {
  return {
    workspaceId: ref.environmentId,
    threadId: ref.threadId,
  };
}

export function buildDraftThreadRouteParams(
  workspaceId: WorkspaceId,
  draftId: DraftId,
): {
  workspaceId: WorkspaceId;
  draftId: DraftId;
} {
  return { workspaceId, draftId };
}

export function resolveThreadRouteRef(
  params: Partial<Record<"workspaceId" | "environmentId" | "threadId", string | undefined>>,
): ScopedThreadRef | null {
  const workspaceId = params.workspaceId ?? params.environmentId;
  if (!workspaceId || !params.threadId) {
    return null;
  }

  return scopeThreadRef(environmentIdFromWorkspaceId(workspaceId), params.threadId as ThreadId);
}

export function resolveThreadRouteTarget(
  params: Partial<
    Record<"workspaceId" | "environmentId" | "threadId" | "draftId", string | undefined>
  >,
): ThreadRouteTarget | null {
  const workspaceId = params.workspaceId ?? params.environmentId;
  if (workspaceId && params.threadId) {
    return {
      kind: "server",
      threadRef: scopeThreadRef(
        environmentIdFromWorkspaceId(workspaceId),
        params.threadId as ThreadId,
      ),
    };
  }

  if (!params.draftId) {
    return null;
  }

  return {
    kind: "draft",
    draftId: params.draftId as DraftId,
  };
}

/**
 * Resolves the thread represented by either a canonical thread route or a
 * draft route whose promotion to a server thread has been recorded.
 */
export function resolveActiveThreadRouteRef(
  target: ThreadRouteTarget | null,
  draftThread: DraftThreadRouteState | null,
): ScopedThreadRef | null {
  if (target?.kind === "server") {
    return target.threadRef;
  }
  if (target?.kind !== "draft" || !draftThread?.promotedTo) {
    return null;
  }
  return draftThread.promotedTo;
}
