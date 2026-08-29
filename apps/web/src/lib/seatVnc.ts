/** Daemon path (and Caddy-later same-origin path) for the KasmVNC HTML client. */
export const SEAT_VNC_PATH = "/vnc/";

export const SEAT_VNC_TITLE = "Agent seat";

const WORKSPACE_PREFIX = /^(\/w\/[^/]+)/;

export function workspacePrefix(pathname: string): string {
  return pathname.match(WORKSPACE_PREFIX)?.[1] ?? "";
}

/** noVNC connects to `ws(s)://host[:port]/${path}`. Keep that under `/vnc/`. */
export function seatVncWebsocketPath(pathname: string): string {
  return `${workspacePrefix(pathname)}${SEAT_VNC_PATH}websockify`.replace(/^\//, "");
}

export function seatVncClientUrl(pathname = "/"): string {
  const path = `${workspacePrefix(pathname)}${SEAT_VNC_PATH}`;
  const params = new URLSearchParams({
    autoconnect: "1",
    resize: "remote",
    path: seatVncWebsocketPath(pathname),
  });
  return `${path}?${params.toString()}`;
}

export const HUMAN_DRIVING_PATH = "/api/seat/human-driving";
