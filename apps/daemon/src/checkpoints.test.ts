import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { CheckpointStore } from "./checkpoints.ts";

const tmpDirs = (): { readonly workspace: string; readonly dataDir: string } => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-ckpt-"));
  const workspace = Path.join(root, "workspace");
  const dataDir = Path.join(root, "data");
  Fs.mkdirSync(workspace, { recursive: true });
  Fs.mkdirSync(dataDir, { recursive: true });
  return { workspace, dataDir };
};

describe("checkpoint diffs", () => {
  it("includes untracked writes and honors fromTurnCount..toTurnCount", () => {
    const tmp = tmpDirs();
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    Fs.writeFileSync(Path.join(tmp.workspace, "seed.txt"), "seed\n");
    store.ensureBaseline("thread-a");

    Fs.writeFileSync(Path.join(tmp.workspace, "new.txt"), "hello\n");
    Fs.writeFileSync(Path.join(tmp.workspace, "seed.txt"), "seed\nchanged\n");
    const turn1 = store.capture("thread-a", 1);
    expect(turn1.tree).toBeDefined();
    expect(turn1.diff).toContain("new.txt");
    expect(turn1.diff).toContain("hello");
    expect(turn1.diff).toContain("changed");
    expect(turn1.files.some((file) => file.path === "new.txt" && file.kind === "added")).toBe(true);

    Fs.writeFileSync(Path.join(tmp.workspace, "other.txt"), "second turn\n");
    store.capture("thread-a", 2);

    const onlySecond = store.rangeDiff("thread-a", 1, 2, false);
    expect(onlySecond.diff).toContain("other.txt");
    expect(onlySecond.diff).toContain("second turn");
    expect(onlySecond.diff).not.toContain("hello");

    const full = store.rangeDiff("thread-a", 0, 2, false);
    expect(full.diff).toContain("new.txt");
    expect(full.diff).toContain("other.txt");
    expect(full.diff).toContain("changed");
  });

  it("persists trees so diffs survive a new CheckpointStore", () => {
    const tmp = tmpDirs();
    const first = new CheckpointStore(tmp.dataDir, tmp.workspace);
    first.ensureBaseline("thread-b");
    Fs.writeFileSync(Path.join(tmp.workspace, "kept.txt"), "persist me\n");
    first.capture("thread-b", 1);

    const second = new CheckpointStore(tmp.dataDir, tmp.workspace);
    const diff = second.rangeDiff("thread-b", 0, 1, false);
    expect(diff.diff).toContain("kept.txt");
    expect(diff.diff).toContain("persist me");
  });

  it("still works when the workspace is already a git repo", () => {
    const tmp = tmpDirs();
    ChildProcess.spawnSync("git", ["init"], { cwd: tmp.workspace, encoding: "utf8" });
    Fs.writeFileSync(Path.join(tmp.workspace, "tracked.txt"), "from git\n");
    ChildProcess.spawnSync("git", ["add", "tracked.txt"], { cwd: tmp.workspace, encoding: "utf8" });
    ChildProcess.spawnSync(
      "git",
      ["-c", "user.email=nero@test", "-c", "user.name=Nero", "commit", "-m", "init"],
      { cwd: tmp.workspace, encoding: "utf8" },
    );
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    store.ensureBaseline("thread-c");
    Fs.writeFileSync(Path.join(tmp.workspace, "untracked.txt"), "not in HEAD\n");
    store.capture("thread-c", 1);
    const diff = store.rangeDiff("thread-c", 0, 1, false);
    expect(diff.diff).toContain("untracked.txt");
    expect(diff.diff).toContain("not in HEAD");
    expect(diff.diff).not.toContain("from git");
  });
});
