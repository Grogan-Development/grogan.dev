import { describe, expect, it } from "@effect/vitest";

import {
  cookiesFromHeader,
  isBearerAuthorization,
  isVncPath,
  pathnameOf,
  stripCookieName,
  stripVncPrefix,
} from "./vnc-proxy.ts";

describe("vnc proxy paths", () => {
  it("matches the Kasm HTML client and websocket helper paths", () => {
    expect(isVncPath("/vnc")).toBe(true);
    expect(isVncPath("/vnc/")).toBe(true);
    expect(isVncPath("/vnc/index.html")).toBe(true);
    expect(isVncPath("/vnc/websockify")).toBe(true);
    expect(isVncPath("/websockify")).toBe(true);
    expect(isVncPath("/w/abc/vnc/")).toBe(true);
    expect(isVncPath("/w/abc/vnc/websockify")).toBe(true);
    expect(isVncPath("/ws")).toBe(false);
    expect(isVncPath("/api/seat/human-driving")).toBe(false);
    expect(isVncPath("/w/abc/thread-1")).toBe(false);
  });

  it("strips /vnc so Kasm sees its own document root", () => {
    expect(stripVncPrefix("/vnc")).toBe("/");
    expect(stripVncPrefix("/vnc/")).toBe("/");
    expect(stripVncPrefix("/vnc/index.html")).toBe("/index.html");
    expect(stripVncPrefix("/vnc/websockify?token=a")).toBe("/websockify?token=a");
    expect(stripVncPrefix("/websockify")).toBe("/websockify");
    expect(stripVncPrefix("/w/abc/vnc/")).toBe("/");
    expect(stripVncPrefix("/w/abc/vnc/index.html")).toBe("/index.html");
  });

  it("parses Cookie headers for same-origin iframe auth", () => {
    expect(pathnameOf("/vnc/foo?x=1")).toBe("/vnc/foo");
    expect(cookiesFromHeader("nero_session=abc; other=1")).toEqual({
      nero_session: "abc",
      other: "1",
    });
  });

  it("does not forward host Bearer or wos-session to Kasm", () => {
    expect(isBearerAuthorization("Bearer guest-token")).toBe(true);
    expect(isBearerAuthorization("Basic bmVybzpuZXJv")).toBe(false);
    expect(stripCookieName("wos-session=sealed; kasm_token=abc", "wos-session")).toBe(
      "kasm_token=abc",
    );
    expect(stripCookieName("wos-session=sealed", "wos-session")).toBeUndefined();
  });
});
