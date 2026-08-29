import { describe, expect, it } from "vite-plus/test";

import { SEAT_VNC_PATH, seatVncClientUrl, seatVncWebsocketPath, workspacePrefix } from "./seatVnc";

describe("seatVncClientUrl", () => {
  it("points the Kasm HTML client at same-origin /vnc/", () => {
    expect(SEAT_VNC_PATH).toBe("/vnc/");
    expect(workspacePrefix("/settings")).toBe("");
    expect(seatVncClientUrl("/")).toContain("/vnc/?");
    expect(seatVncClientUrl("/")).toContain("autoconnect=1");
    expect(seatVncWebsocketPath("/")).toBe("vnc/websockify");
  });

  it("keeps the websocket under the workspace prefix Caddy will strip", () => {
    expect(workspacePrefix("/w/abc/thread-1")).toBe("/w/abc");
    expect(seatVncClientUrl("/w/abc/thread-1")).toMatch(/^\/w\/abc\/vnc\/\?/);
    expect(seatVncWebsocketPath("/w/abc/thread-1")).toBe("w/abc/vnc/websockify");
  });
});
