import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";
import * as Process from "node:process";

import { ensureDir, readJson, writeJsonAtomic } from "./runtime.ts";

const SKIP_DIRS = [
  ".git",
  "node_modules",
  ".nero",
  ".nero-shots",
  "dist",
  ".vite-plus",
  ".ssh",
  ".gnupg",
  ".aws",
  ".cache",
  ".local",
  ".mozilla",
  ".config",
  ".docker",
  ".kube",
  ".password-store",
] as const;

const CHECKPOINT_EXCLUDE = [
  ...SKIP_DIRS.map((name) => `${name}/`),
  ".*",
  "!.gitignore",
  "!.gitattributes",
  "!.editorconfig",
  "!.nvmrc",
  "!.node-version",
  "!.github/",
  "!.github/**",
  "!.vscode/",
  "!.vscode/**",
  "!.cursor/",
  "!.cursor/**",
  "!.husky/",
  "!.husky/**",
  "!.devcontainer/",
  "!.devcontainer/**",
  ".env",
  ".env.*",
  "!.env.example",
  "*.pem",
  "*.key",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "*.p12",
  "*.pfx",
  ".netrc",
  ".npmrc",
  ".pypirc",
  "credentials",
  "**/credentials",
].join("\n");

export type CheckpointFile = {
  readonly path: string;
  readonly kind: string;
  readonly additions: number;
  readonly deletions: number;
};

export type CheckpointDiff = {
  readonly diff: string;
  readonly files: ReadonlyArray<CheckpointFile>;
  readonly timedOut: boolean;
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
): {
  readonly ok: boolean;
  readonly stdout: string;
  readonly status: number | null;
  readonly timedOut: boolean;
} => {
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
  const timedOut =
    result.error !== undefined &&
    "code" in result.error &&
    (result.error as { code?: string }).code === "ETIMEDOUT";
  if (result.error || status === null || !allow.includes(status)) {
    return { ok: false, stdout, status, timedOut };
  }
  return { ok: true, stdout, status, timedOut: false };
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
    Fs.writeFileSync(Path.join(info, "exclude"), `${CHECKPOINT_EXCLUDE}\n`, "utf8");
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

  treeAtOrBefore(threadId: string, turnCount: number): string | undefined {
    for (let n = Math.max(0, turnCount); n >= 0; n -= 1) {
      const sha = this.treeFor(threadId, n);
      if (sha !== undefined) return sha;
    }
    return undefined;
  }

  capture(
    threadId: string,
    turnCount: number,
  ): CheckpointDiff & { readonly tree: string | undefined } {
    this.ensureRepo();
    const added = git(this.gitDir, ["add", "-A"], { workTree: this.workspaceRoot });
    if (!added.ok) {
      return { tree: undefined, diff: "", files: [], timedOut: added.timedOut };
    }
    const written = git(this.gitDir, ["write-tree"], { workTree: this.workspaceRoot });
    const tree = written.stdout.trim();
    if (!written.ok || tree.length === 0) {
      return { tree: undefined, diff: "", files: [], timedOut: written.timedOut };
    }
    const previous = this.treeAtOrBefore(threadId, turnCount - 1) ?? this.emptyTreeSha();
    const threadTrees = this.trees[threadId] ?? {};
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
    const from = this.treeAtOrBefore(threadId, fromTurnCount) ?? this.emptyTreeSha();
    const to = this.treeFor(threadId, toTurnCount);
    if (to === undefined) return { diff: "", files: [], timedOut: false };
    if (from === to) return { diff: "", files: [], timedOut: false };
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
    return { diff: unified.ok ? unified.stdout : "", files, timedOut: false };
  }
}
