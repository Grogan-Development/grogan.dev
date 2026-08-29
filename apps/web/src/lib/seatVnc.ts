/** Daemon path for the Kasm HTML client. Vite/Caddy proxy origin `/vnc` (and `/w/:id/vnc`). */
export const SEAT_VNC_PATH = "/vnc/";

export const SEAT_VNC_TITLE = "Agent seat";

export const HUMAN_DRIVING_PATH = "/api/seat/human-driving";

/** noVNC connects to `ws(s)://host[:port]/${path}` — keep that under origin `/vnc/`. */
export const SEAT_VNC_WEBSOCKET_PATH = "vnc/websockify";

export function seatVncClientUrl(): string {
  const params = new URLSearchParams({
    autoconnect: "1",
    // Scale in the iframe; do not resize the 1920×1080 Xvnc seat.
    resize: "scale",
    path: SEAT_VNC_WEBSOCKET_PATH,
  });
  return `${SEAT_VNC_PATH}?${params.toString()}`;
}
