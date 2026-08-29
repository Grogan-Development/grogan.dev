import { describe, expect, it } from "vite-plus/test";

import { SEAT_VNC_PATH, SEAT_VNC_WEBSOCKET_PATH, seatVncClientUrl } from "./seatVnc";

describe("seatVncClientUrl", () => {
  it("points the Kasm HTML client at origin-root /vnc/ (Vite/Caddy proxy to the daemon)", () => {
    expect(SEAT_VNC_PATH).toBe("/vnc/");
    expect(SEAT_VNC_WEBSOCKET_PATH).toBe("vnc/websockify");
    const url = seatVncClientUrl("/");
    expect(url.startsWith("/vnc/?")).toBe(true);
    expect(url).not.toContain("/w/");
    expect(url).toContain("autoconnect=1");
    expect(url).toContain("resize=scale");
    expect(url).not.toContain("resize=remote");
    expect(url).toContain("path=vnc%2Fwebsockify");
  });

  it("prefixes /w/:id when the skin is on a workspace route", () => {
    const url = seatVncClientUrl("/w/0123456789abcdef/thread");
    expect(url.startsWith("/w/0123456789abcdef/vnc/?")).toBe(true);
    expect(url).toContain("path=w%2F0123456789abcdef%2Fvnc%2Fwebsockify");
    expect(url).toContain("resize=scale");
  });
});
