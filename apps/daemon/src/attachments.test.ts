import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";

import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import { Daemon, validAttachmentId } from "./daemon.ts";
import type { DaemonOptions } from "./runtime.ts";

const options = (root: string): DaemonOptions => ({
  host: "127.0.0.1",
  port: 0,
  workspaceRoot: Path.join(root, "ws"),
  homeDir: Path.join(root, "home"),
  dataDir: Path.join(root, "data"),
  environmentId: EnvironmentId.make("test-environment"),
  label: "test",
  devBypass: false,
  accessToken: undefined,
  seatLockPath: Path.join(root, "seat.lock"),
  seatHoldBin: "true",
  vncOrigin: "http://127.0.0.1:5901",
  zaiApiKey: undefined,
  zaiCodingBaseUrl: "http://127.0.0.1:1",
  zaiPaygBaseUrl: "http://127.0.0.1:1",
  basetenApiKey: undefined,
  basetenBaseUrl: "http://127.0.0.1:1",
  openaiClientId: undefined,
  codexRedirectUri: undefined,
  opencodeApiKey: undefined,
  opencodeBaseUrl: undefined,
  routerTimeoutMs: 1_000,
  routerIdleMs: 1_000,
  hostUrl: undefined,
  hostToken: undefined,
  workspaceId: undefined,
});

describe("attachment storage guards", () => {
  it("rejects ids outside the safe alphabet", () => {
    expect(validAttachmentId("att1234567890")).toBe(true);
    expect(validAttachmentId("../orchestration.json")).toBe(false);
    expect(validAttachmentId("att_1")).toBe(false);
    expect(validAttachmentId("abc")).toBe(false);
  });

  it("never joins a client-supplied id outside the attachments dir", () => {
    const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-att-"));
    const daemon = new Daemon(options(root));
    const evil = "../evil";
    daemon.writeAttachmentDataUrl(evil, "data:image/png;base64,AAAA");
    daemon.writeAttachmentBytes(evil, Buffer.from("evil"));
    expect(Fs.existsSync(Path.join(root, "data", "evil"))).toBe(false);
    expect(Fs.existsSync(Path.join(root, "data", "attachments", "evil"))).toBe(false);

    expect(daemon.readAttachmentDataUrl(evil)).toBeUndefined();
    expect(() => daemon.deleteAttachment(evil)).not.toThrow();
  });

  it("stores and reads a valid attachment round-trip", () => {
    const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-att-"));
    const daemon = new Daemon(options(root));
    const dataUrl = "data:image/png;base64,AAAA";
    daemon.writeAttachmentDataUrl("att1234567890", dataUrl);
    expect(daemon.readAttachmentDataUrl("att1234567890")).toBe(dataUrl);
    daemon.deleteAttachment("att1234567890");
    expect(daemon.readAttachmentDataUrl("att1234567890")).toBeUndefined();
  });

  it("refuses to persist dataURLs beyond the size cap", () => {
    const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-att-"));
    const daemon = new Daemon(options(root));
    const oversized = `data:image/png;base64,${"A".repeat(14_000_001)}`;
    daemon.writeAttachmentDataUrl("att1234567890", oversized);
    expect(Fs.existsSync(Path.join(root, "data", "attachments", "att1234567890"))).toBe(false);
  });
});
