/**
 * Client for the Nero host control plane, served same-origin on
 * nero.grogan.dev next to this skin. Auth is the WorkOS AuthKit `wos-session`
 * cookie the browser already holds — plain `fetch` with same-origin
 * credentials, no tokens in the client. `401` means the session is missing or
 * expired; direct the user to `NERO_LOGIN_PATH` (the host redirects to WorkOS
 * and back).
 *
 * Keep-awake contract: the host idle-stops a workspace ~5 minutes after it
 * stops seeing a "connected" heartbeat. Workspace routes pin their workspace
 * via `pinNeroWorkspace`; the picker's `listNeroWorkspaces` never pins.
 */

export const NERO_WORKSPACES_PATH = "/api/workspaces";
export const NERO_LOGIN_PATH = "/auth/login";

export type NeroWorkspaceState = "running" | "stopped" | "queued";

const NERO_WORKSPACE_STATES: readonly NeroWorkspaceState[] = ["running", "stopped", "queued"];

export type NeroWorkspace = {
  id: string;
  name: string;
  state: NeroWorkspaceState;
  createdAt: string | null;
  connected: boolean;
  agentWorking: boolean;
  jobRunning: boolean;
  lastHeartbeat: string | null;
};

/** Host control-plane error. `status === 401` → AuthKit session missing/expired. */
export class NeroHostApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NeroHostApiError";
    this.status = status;
  }
}

export function isNeroHostAuthError(error: unknown): boolean {
  return error instanceof NeroHostApiError && error.status === 401;
}

export function neroHostErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "The host control plane could not be reached.";
}

async function neroHostFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new NeroHostApiError("The host control plane is unreachable.", 0);
  }
  if (!response.ok) {
    throw new NeroHostApiError(await describeNeroHostErrorResponse(response), response.status);
  }
  return response;
}

async function describeNeroHostErrorResponse(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === "string") {
      detail = body.message;
    } else if (typeof body.error === "string") {
      detail = body.error;
    }
  } catch {
    // Non-JSON error body; fall through to the generic status text.
  }
  if (detail.trim().length > 0) {
    return detail.trim();
  }
  if (response.status === 401) {
    return "Your Nero session has expired.";
  }
  return `The host control plane rejected the request (${response.status}).`;
}

async function neroHostJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await neroHostFetch(path, init);
  try {
    return await response.json();
  } catch {
    throw new NeroHostApiError(
      "The host control plane returned an unexpected response.",
      response.status,
    );
  }
}

/** Defensive parse: the host is the landlord, but never trust the wire. */
export function parseNeroWorkspace(value: unknown): NeroWorkspace {
  if (typeof value !== "object" || value === null) {
    throw new NeroHostApiError("The host control plane returned an unexpected response.", 0);
  }
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (id.length === 0) {
    throw new NeroHostApiError("The host control plane returned a workspace without an id.", 0);
  }
  const state = NERO_WORKSPACE_STATES.find((candidate) => candidate === record.state) ?? "stopped";
  return {
    id,
    name: typeof record.name === "string" && record.name.trim().length > 0 ? record.name : id,
    state,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
    connected: record.connected === true,
    agentWorking: record.agentWorking === true,
    jobRunning: record.jobRunning === true,
    lastHeartbeat: typeof record.lastHeartbeat === "string" ? record.lastHeartbeat : null,
  };
}

/** `GET /api/workspaces` — listing only; never pins a workspace. */
export async function listNeroWorkspaces(): Promise<NeroWorkspace[]> {
  const body = (await neroHostJson(NERO_WORKSPACES_PATH)) as { workspaces?: unknown };
  if (!Array.isArray(body.workspaces)) {
    return [];
  }
  return body.workspaces.map(parseNeroWorkspace);
}

/**
 * `POST /api/workspaces` — the host starts the workspace (FIFO-queued if two
 * are already awake) and blocks until the guest daemon is healthy, so this can
 * take tens of seconds. The host does not auto-stop on failure; surface the
 * error text to the user.
 */
export async function createNeroWorkspace(name: string | null): Promise<NeroWorkspace> {
  const trimmedName = name?.trim() ?? "";
  const body = await neroHostJson(NERO_WORKSPACES_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(trimmedName.length > 0 ? { name: trimmedName } : {}),
  });
  return parseNeroWorkspace(body);
}

async function neroWorkspaceAction(
  workspaceId: string,
  action: "wake" | "stop",
): Promise<NeroWorkspace> {
  const body = await neroHostJson(
    `${NERO_WORKSPACES_PATH}/${encodeURIComponent(workspaceId)}/${action}`,
    { method: "POST" },
  );
  return parseNeroWorkspace(body);
}

export function wakeNeroWorkspace(workspaceId: string): Promise<NeroWorkspace> {
  return neroWorkspaceAction(workspaceId, "wake");
}

export function stopNeroWorkspace(workspaceId: string): Promise<NeroWorkspace> {
  return neroWorkspaceAction(workspaceId, "stop");
}

/** `POST /api/workspaces/:id/heartbeat` with `{"connected":true}` — pins the workspace awake. */
export async function pinNeroWorkspace(workspaceId: string): Promise<void> {
  await neroHostFetch(`${NERO_WORKSPACES_PATH}/${encodeURIComponent(workspaceId)}/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connected: true }),
  });
}

/**
 * Unpin without awaiting — used on `visibilitychange→hidden`, `pagehide`, and
 * workspace-route unmount so the host can re-arm its idle timer promptly.
 */
export function unpinNeroWorkspace(workspaceId: string): void {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return;
  }
  navigator.sendBeacon(
    `${NERO_WORKSPACES_PATH}/${encodeURIComponent(workspaceId)}/heartbeat`,
    new Blob([JSON.stringify({ connected: false })], { type: "application/json" }),
  );
}

/** Workspace id embedded in a same-origin daemon path (`/w/:id/...`), if any. */
export function neroWorkspaceIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/w\/([^/]+)(?:\/|$)/);
  const workspaceId = match?.[1];
  if (workspaceId === undefined || workspaceId.length === 0) {
    return null;
  }
  return workspaceId;
}
