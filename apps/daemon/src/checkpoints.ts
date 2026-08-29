import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";
import * as Process from "node:process";

import { ensureDir, readJson, writeJsonAtomic } from "./runtime.ts";

const SKIP_NAMES = [".git", "node_modules", ".nero", ".nero-shots", "dist", ".vite-plus"] as const;

export type CheckpointFile = {
  readonly path: string;
  readonly kind: string;
  readonly additions: number;
  readonly deletions: number;
};

export type CheckpointDiff = {
  readonly diff: string;
  readonly files: ReadonlyArray<CheckpointFile>;
};

type TreeMap = Record<string, Record<string, string>>;

const git = (
  gitDir: string,
  args: ReadonlyArray<string>,
  options: {
    readonly workTree?: string;
    readonly input?: string;
    readonly allowExit?: ReadonlyArray<number>;
  } = {},
): { readonly ok: boolean; readonly stdout: string; readonly status: number | null } => {
  const allow = options.allowExit ?? [0];
  const result = ChildProcess.spawnSync("git", args, {
    cwd: options.workTree ?? gitDir,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    input: options.input,
    env: {
      ...Process.env,
      GIT_DIR: gitDir,
      GIT_INDEX_FILE: Path.join(gitDir, "index"),
      ...(options.workTree === undefined ? {} : { GIT_WORK_TREE: options.workTree }),
    },
  });
  const status = result.status;
  const stdout = result.stdout ?? "";
  if (result.error || status === null || !allow.includes(status)) {
    return { ok: false, stdout, status };
  }
  return { ok: true, stdout, status };
};

export class CheckpointStore {
  private readonly gitDir: string;
  private readonly mapPath: string;
  private readonly workspaceRoot: string;
  private trees: TreeMap = {};
  private emptyTree: string | undefined;

  constructor(dataDir: string, workspaceRoot: string) {
    this.workspaceRoot = Path.resolve(workspaceRoot);
    this.gitDir = Path.join(Path.resolve(dataDir), "checkpoints.git");
    this.mapPath = Path.join(Path.resolve(dataDir), "checkpoint-trees.json");
    this.restore();
    this.ensureRepo();
  }

  private restore(): void {
    const raw = readJson(this.mapPath);
    if (raw === undefined || raw === null || typeof raw !== "object") return;
    this.trees = raw as TreeMap;
  }

  private persist(): void {
    writeJsonAtomic(this.mapPath, this.trees);
  }

  private ensureRepo(): void {
    if (!Fs.existsSync(Path.join(this.gitDir, "HEAD"))) {
      ensureDir(Path.dirname(this.gitDir));
      ChildProcess.spawnSync("git", ["init", "--bare", this.gitDir], {
        encoding: "utf8",
        timeout: 15_000,
      });
    }
    const info = Path.join(this.gitDir, "info");
    ensureDir(info);
    const exclude = SKIP_NAMES.map((name) => `${name}/`).join("\n") + "\n";
    Fs.writeFileSync(Path.join(info, "exclude"), exclude, "utf8");
  }

  private emptyTreeSha(): string {
    if (this.emptyTree !== undefined) return this.emptyTree;
    const result = git(this.gitDir, ["mktree"], { input: "" });
    const sha = result.stdout.trim();
    this.emptyTree = sha.length > 0 ? sha : "4b825dc642cb6eb9a060e54bf8d34767c8098ee7";
    return this.emptyTree;
  }

  treeFor(threadId: string, turnCount: number): string | undefined {
    const sha = this.trees[threadId]?.[String(turnCount)];
    return sha !== undefined && sha.length > 0 ? sha : undefined;
  }

  capture(
    threadId: string,
    turnCount: number,
  ): CheckpointDiff & { readonly tree: string | undefined } {
    this.ensureRepo();
    const added = git(this.gitDir, ["add", "-A"], { workTree: this.workspaceRoot });
    if (!added.ok) {
      return { tree: undefined, diff: "", files: [] };
    }
    const written = git(this.gitDir, ["write-tree"], { workTree: this.workspaceRoot });
    const tree = written.stdout.trim();
    if (!written.ok || tree.length === 0) {
      return { tree: undefined, diff: "", files: [] };
    }
    const threadTrees = this.trees[threadId] ?? {};
    const previous = threadTrees[String(Math.max(0, turnCount - 1))] ?? this.emptyTreeSha();
    threadTrees[String(turnCount)] = tree;
    this.trees[threadId] = threadTrees;
    this.persist();
    return { tree, ...this.diffTrees(previous, tree, false) };
  }

  ensureBaseline(threadId: string): void {
    if (this.treeFor(threadId, 0) !== undefined) return;
    this.capture(threadId, 0);
  }

  rangeDiff(
    threadId: string,
    fromTurnCount: number,
    toTurnCount: number,
    ignoreWhitespace: boolean,
  ): CheckpointDiff {
    const from =
      fromTurnCount <= 0
        ? (this.treeFor(threadId, 0) ?? this.emptyTreeSha())
        : (this.treeFor(threadId, fromTurnCount) ?? this.emptyTreeSha());
    const to = this.treeFor(threadId, toTurnCount);
    if (to === undefined) return { diff: "", files: [] };
    if (from === to) return { diff: "", files: [] };
    return this.diffTrees(from, to, ignoreWhitespace);
  }

  private diffTrees(from: string, to: string, ignoreWhitespace: boolean): CheckpointDiff {
    const diffArgs = ["diff", "--no-color", "--find-renames"];
    if (ignoreWhitespace) diffArgs.push("-w");
    diffArgs.push(from, to);
    const unified = git(this.gitDir, diffArgs, { allowExit: [0, 1] });
    const numstatArgs = ["diff", "--numstat"];
    if (ignoreWhitespace) numstatArgs.push("-w");
    numstatArgs.push(from, to);
    const numstat = git(this.gitDir, numstatArgs, { allowExit: [0, 1] });
    const files: CheckpointFile[] = [];
    if (numstat.ok) {
      for (const line of numstat.stdout.split("\n")) {
        const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
        if (match === null) continue;
        const path = match[3];
        if (path === undefined || path.length === 0) continue;
        const additions = match[1] === "-" ? 0 : Number.parseInt(match[1] ?? "0", 10) || 0;
        const deletions = match[2] === "-" ? 0 : Number.parseInt(match[2] ?? "0", 10) || 0;
        const kind =
          additions > 0 && deletions === 0
            ? "added"
            : deletions > 0 && additions === 0
              ? "deleted"
              : "changed";
        files.push({ path, kind, additions, deletions });
      }
    }
    return { diff: unified.ok ? unified.stdout : "", files };
  }
}
