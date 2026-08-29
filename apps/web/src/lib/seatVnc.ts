/** Daemon path for the Kasm HTML client. Vite/Caddy proxy origin `/vnc` (and `/w/:id/vnc`). */
export const SEAT_VNC_PATH = "/vnc/";

export const SEAT_VNC_TITLE = "Agent seat";

export const HUMAN_DRIVING_PATH = "/api/seat/human-driving";

/** noVNC connects to `ws(s)://host[:port]/${path}` — keep that under origin `/vnc/`. */
export const SEAT_VNC_WEBSOCKET_PATH = "vnc/websockify";

export function workspacePrefixFromPath(pathname: string): string {
  const match = pathname.match(/^\/w\/([0-9a-f]{8,32})(?:\/|$)/i);
  if (match === null || match[1] === undefined) {
    return "";
  }
  return `/w/${match[1].toLowerCase()}`;
}

export function seatVncClientUrl(pathname?: string): string {
  const path =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const prefix = workspacePrefixFromPath(path);
  const vncPath = `${prefix}${SEAT_VNC_PATH}`;
  const wsPath =
    prefix.length === 0 ? SEAT_VNC_WEBSOCKET_PATH : `${prefix.slice(1)}/vnc/websockify`;
  const params = new URLSearchParams({
    autoconnect: "1",
    // Scale in the iframe; do not resize the 1920×1080 Xvnc seat.
    resize: "scale",
    path: wsPath,
  });
  return `${vncPath}?${params.toString()}`;
}
