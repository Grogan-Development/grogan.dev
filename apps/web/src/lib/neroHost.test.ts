import { describe, expect, it } from "vite-plus/test";

import {
  isNeroHostAuthError,
  neroHostErrorMessage,
  NeroHostApiError,
  neroWorkspaceIdFromPath,
  parseNeroWorkspace,
} from "./neroHost";

describe("parseNeroWorkspace", () => {
  it("parses a full host workspace record", () => {
    const workspace = parseNeroWorkspace({
      id: "abc123",
      name: "nero-dev",
      state: "running",
      createdAt: "2026-08-27T10:00:00.000Z",
      connected: true,
      agentWorking: false,
      jobRunning: true,
      lastHeartbeat: "2026-08-27T11:00:00.000Z",
    });
    expect(workspace).toEqual({
      id: "abc123",
      name: "nero-dev",
      state: "running",
      createdAt: "2026-08-27T10:00:00.000Z",
      connected: true,
      agentWorking: false,
      jobRunning: true,
      lastHeartbeat: "2026-08-27T11:00:00.000Z",
    });
  });

  it("defaults unknown state to stopped and missing optionals to null/false", () => {
    const workspace = parseNeroWorkspace({ id: "ws-1" });
    expect(workspace.state).toBe("stopped");
    expect(workspace.name).toBe("ws-1");
    expect(workspace.createdAt).toBeNull();
    expect(workspace.connected).toBe(false);
    expect(workspace.agentWorking).toBe(false);
    expect(workspace.jobRunning).toBe(false);
    expect(workspace.lastHeartbeat).toBeNull();
  });

  it("rejects records without an id", () => {
    expect(() => parseNeroWorkspace({ name: "no-id" })).toThrow(NeroHostApiError);
    expect(() => parseNeroWorkspace(null)).toThrow(NeroHostApiError);
  });
});

describe("neroWorkspaceIdFromPath", () => {
  it("extracts the workspace id from daemon-prefixed routes", () => {
    expect(neroWorkspaceIdFromPath("/w/abc123/")).toBe("abc123");
    expect(neroWorkspaceIdFromPath("/w/abc123/thread-1")).toBe("abc123");
    expect(neroWorkspaceIdFromPath("/w/abc123")).toBe("abc123");
  });

  it("returns null off workspace routes (the picker must never pin)", () => {
    expect(neroWorkspaceIdFromPath("/")).toBeNull();
    expect(neroWorkspaceIdFromPath("/settings")).toBeNull();
    expect(neroWorkspaceIdFromPath("/w/")).toBeNull();
  });
});

describe("nero host errors", () => {
  it("flags 401 as the AuthKit sign-in case", () => {
    const authError = new NeroHostApiError("Your Nero session has expired.", 401);
    expect(isNeroHostAuthError(authError)).toBe(true);
    expect(isNeroHostAuthError(new NeroHostApiError("admission queue full", 503))).toBe(false);
    expect(isNeroHostAuthError(new Error("boom"))).toBe(false);
  });

  it("prefers the error message over generic fallbacks", () => {
    expect(neroHostErrorMessage(new NeroHostApiError("admission queue full", 503))).toBe(
      "admission queue full",
    );
    expect(neroHostErrorMessage("boom")).toBe("The host control plane could not be reached.");
  });
});
