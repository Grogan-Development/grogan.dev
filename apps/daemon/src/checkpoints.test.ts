import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";
import * as Process from "node:process";

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

  it("walks back over a missing turn instead of diffing against the empty tree", () => {
    const tmp = tmpDirs();
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    Fs.writeFileSync(Path.join(tmp.workspace, "seed.txt"), "seed\n");
    store.ensureBaseline("thread-skip");
    Fs.writeFileSync(Path.join(tmp.workspace, "after.txt"), "later\n");
    store.capture("thread-skip", 2);
    const fromZero = store.rangeDiff("thread-skip", 0, 2, false);
    expect(fromZero.diff).toContain("after.txt");
    expect(fromZero.diff).toContain("later");
    expect(fromZero.diff).not.toMatch(/^\+seed$/m);
    expect(fromZero.files.some((file) => file.path === "seed.txt" && file.kind === "added")).toBe(
      false,
    );
    const fromMissing = store.rangeDiff("thread-skip", 1, 2, false);
    expect(fromMissing.diff).toBe(fromZero.diff);
  });

  it("pruneAfter drops later trees so the next capture writes fresh", () => {
    const tmp = tmpDirs();
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    Fs.writeFileSync(Path.join(tmp.workspace, "a.txt"), "turn one\n");
    store.ensureBaseline("thread-revert");
    store.capture("thread-revert", 1);
    Fs.writeFileSync(Path.join(tmp.workspace, "a.txt"), "turn two\n");
    Fs.writeFileSync(Path.join(tmp.workspace, "b.txt"), "turn two extra\n");
    store.capture("thread-revert", 2);
    expect(store.treeFor("thread-revert", 2)).toBeDefined();

    store.pruneAfter("thread-revert", 1);
    expect(store.treeFor("thread-revert", 2)).toBeUndefined();
    expect(store.treeFor("thread-revert", 1)).toBeDefined();

    // The next capture at the same count must not resurrect the pruned tree.
    Fs.writeFileSync(Path.join(tmp.workspace, "b.txt"), "turn two again\n");
    store.capture("thread-revert", 2);
    const diff = store.rangeDiff("thread-revert", 1, 2, false);
    expect(diff.diff).toContain("turn two again");
    expect(diff.diff).not.toContain("turn two extra");
  });

  it("restoreTree hard-resets the workspace to the kept checkpoint", () => {
    const tmp = tmpDirs();
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    Fs.writeFileSync(Path.join(tmp.workspace, "a.txt"), "kept\n");
    store.ensureBaseline("thread-restore");
    store.capture("thread-restore", 1);

    // Turn 2 edits a.txt and adds b.txt; revert to keep 1 turn undoes both.
    Fs.writeFileSync(Path.join(tmp.workspace, "a.txt"), "edited after revert point\n");
    Fs.writeFileSync(Path.join(tmp.workspace, "b.txt"), "created later\n");
    store.capture("thread-restore", 2);

    expect(store.restoreTree("thread-restore", 1)).toBe(true);
    expect(Fs.readFileSync(Path.join(tmp.workspace, "a.txt"), "utf8")).toBe("kept\n");
    expect(Fs.existsSync(Path.join(tmp.workspace, "b.txt"))).toBe(false);
  });

  it("does not snapshot env keys, ssh, or browser profiles", () => {
    const tmp = tmpDirs();
    Fs.mkdirSync(Path.join(tmp.workspace, ".ssh"), { recursive: true });
    Fs.mkdirSync(Path.join(tmp.workspace, ".config", "chromium"), { recursive: true });
    Fs.writeFileSync(Path.join(tmp.workspace, ".env"), "ZAI_API_KEY=secret-value\n");
    Fs.writeFileSync(Path.join(tmp.workspace, ".ssh", "id_rsa"), "fake-private-key\n");
    Fs.writeFileSync(Path.join(tmp.workspace, ".config", "chromium", "Cookies"), "cookie-jar\n");
    Fs.writeFileSync(Path.join(tmp.workspace, "ok.txt"), "visible\n");
    const store = new CheckpointStore(tmp.dataDir, tmp.workspace);
    store.ensureBaseline("thread-secret");
    const listed = gitLsFiles(tmp);
    expect(listed).toContain("ok.txt");
    expect(listed).not.toContain(".env");
    expect(listed).not.toContain("id_rsa");
    expect(listed).not.toContain("Cookies");
    expect(listed).not.toContain("secret-value");
  });
});

const gitLsFiles = (tmp: { readonly dataDir: string; readonly workspace: string }): string => {
  const gitDir = Path.join(tmp.dataDir, "checkpoints.git");
  const result = ChildProcess.spawnSync("git", ["ls-files"], {
    encoding: "utf8",
    env: {
      ...Process.env,
      GIT_DIR: gitDir,
      GIT_WORK_TREE: tmp.workspace,
      GIT_INDEX_FILE: Path.join(gitDir, "index"),
    },
  });
  return result.stdout ?? "";
};
