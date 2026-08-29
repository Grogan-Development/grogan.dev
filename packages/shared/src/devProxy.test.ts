import { describe, expect, it } from "vite-plus/test";

import { isDevProxiedPath, stripWorkspaceDaemonPrefix } from "./devProxy.ts";

describe("dev proxy paths", () => {
  it("matches origin-root daemon paths including /vnc and /websockify", () => {
    expect(isDevProxiedPath("/vnc")).toBe(true);
    expect(isDevProxiedPath("/vnc/")).toBe(true);
    expect(isDevProxiedPath("/vnc/websockify")).toBe(true);
    expect(isDevProxiedPath("/api/seat/human-driving")).toBe(true);
    expect(isDevProxiedPath("/websockify")).toBe(true);
    expect(isDevProxiedPath("/w/abc/thread-1")).toBe(false);
  });

  it("strips /w/:id so prefixed iframe and driving URLs hit the daemon", () => {
    expect(stripWorkspaceDaemonPrefix("/w/abc/vnc/?autoconnect=1")).toBe("/vnc/?autoconnect=1");
    expect(stripWorkspaceDaemonPrefix("/w/abc/api/seat/human-driving")).toBe(
      "/api/seat/human-driving",
    );
    expect(stripWorkspaceDaemonPrefix("/w/abc/ws")).toBe("/ws");
    expect(isDevProxiedPath("/w/abc/vnc/")).toBe(true);
    expect(isDevProxiedPath("/w/abc/api/seat/human-driving")).toBe(true);
    expect(stripWorkspaceDaemonPrefix("/vnc/")).toBe("/vnc/");
  });
});
