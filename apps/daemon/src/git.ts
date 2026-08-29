import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";

import {
  GitCommandError,
  GitManagerError,
  type GitActionProgressEvent,
  type GitPreparePullRequestThreadInput,
  type GitPreparePullRequestThreadResult,
  type GitPullRequestRefInput,
  type GitResolvePullRequestResult,
  type GitRunStackedActionInput,
  type GitRunStackedActionResult,
  type ReviewDiffFileContentsInput,
  type ReviewDiffFileContentsResult,
  type ReviewDiffPreviewInput,
  type ReviewDiffPreviewResult,
  type SourceControlCloneRepositoryInput,
  type SourceControlCloneRepositoryResult,
  type SourceControlDiscoveryResult,
  type SourceControlPublishRepositoryInput,
  type SourceControlPublishRepositoryResult,
  type SourceControlRepositoryLookupInput,
  type SourceControlRepositoryInfo,
  SourceControlRepositoryError,
  type VcsCreateRefInput,
  type VcsCreateRefResult,
  type VcsCreateWorktreeInput,
  type VcsCreateWorktreeResult,
  type VcsInitInput,
  type VcsListRefsInput,
  type VcsListRefsResult,
  type VcsPullInput,
  type VcsPullResult,
  type VcsRemoveWorktreeInput,
  type VcsStatusInput,
  type VcsStatusLocalResult,
  type VcsStatusRemoteResult,
  type VcsStatusResult,
  type VcsSwitchRefInput,
  type VcsSwitchRefResult,
} from "@t3tools/contracts";
import * as Option from "effect/Option";

import { djb2Hex, nextToken, nowUtc, platformOs } from "./runtime.ts";

const runGit = (
  cwd: string,
  args: ReadonlyArray<string>,
  operation: string,
): { stdout: string; stderr: string } => {
  const result = ChildProcess.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) {
    throw new GitCommandError({
      operation,
      command: "git",
      cwd,
      argumentCount: args.length,
      detail: result.error.message,
      cause: result.error,
    });
  }
  if (result.status !== 0) {
    throw new GitCommandError({
      operation,
      command: "git",
      cwd,
      argumentCount: args.length,
      exitCode: result.status ?? undefined,
      stdoutLength: result.stdout?.length,
      stderrLength: result.stderr?.length,
      detail: (result.stderr || result.stdout || "git failed").slice(0, 2_000),
    });
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const tryGit = (
  cwd: string,
  args: ReadonlyArray<string>,
): { ok: true; stdout: string } | { ok: false; detail: string } => {
  const result = ChildProcess.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      detail: (result.stderr || result.error?.message || "git failed").slice(0, 500),
    };
  }
  return { ok: true, stdout: result.stdout ?? "" };
};

export const gitRepoRoot = (cwd: string): string | undefined => {
  const result = tryGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!result.ok) return undefined;
  const root = result.stdout.trim();
  return root.length === 0 ? undefined : root;
};

export type TurnWorkspaceDiff = {
  readonly diff: string;
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly kind: string;
    readonly additions: number;
    readonly deletions: number;
  }>;
};

export const turnWorkspaceDiff = (cwd: string): TurnWorkspaceDiff => {
  const root = gitRepoRoot(cwd);
  if (root === undefined) return { diff: "", files: [] };
  const files: TurnWorkspaceDiff["files"][number][] = [];
  const seen = new Set<string>();
  const numstat = tryGit(root, ["diff", "--numstat", "HEAD"]);
  if (numstat.ok) {
    for (const line of numstat.stdout.split("\n")) {
      const match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
      if (match === null) continue;
      const path = match[3];
      if (path === undefined || path.length === 0) continue;
      seen.add(path);
      files.push({
        path,
        kind: "changed",
        additions: match[1] === "-" ? 0 : Number.parseInt(match[1] ?? "0", 10) || 0,
        deletions: match[2] === "-" ? 0 : Number.parseInt(match[2] ?? "0", 10) || 0,
      });
    }
  }
  const untracked = tryGit(root, ["ls-files", "--others", "--exclude-standard"]);
  if (untracked.ok) {
    for (const line of untracked.stdout.split("\n")) {
      const path = line.trim();
      if (path.length === 0 || seen.has(path)) continue;
      files.push({ path, kind: "added", additions: 0, deletions: 0 });
    }
  }
  const diff = tryGit(root, ["diff", "HEAD"]);
  return { diff: diff.ok ? diff.stdout : "", files };
};

const emptyLocal = (isRepo: boolean): VcsStatusLocalResult => ({
  isRepo,
  hasPrimaryRemote: false,
  isDefaultRef: false,
  refName: null,
  hasWorkingTreeChanges: false,
  workingTree: { files: [], insertions: 0, deletions: 0 },
});

const emptyRemote = (): VcsStatusRemoteResult => ({
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
  pr: null,
});

export const vcsStatus = (input: VcsStatusInput): VcsStatusResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    return { ...emptyLocal(false), ...emptyRemote() };
  }
  const branch = tryGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const refName = branch.ok ? branch.stdout.trim() : null;
  const porcelain = tryGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const files: { path: string; insertions: number; deletions: number }[] = [];
  if (porcelain.ok) {
    for (const line of porcelain.stdout.split("\n")) {
      if (line.length < 4) continue;
      const path = line.slice(3).trim();
      if (path.length === 0) continue;
      files.push({ path, insertions: 0, deletions: 0 });
    }
  }
  const remote = tryGit(root, ["remote"]);
  const hasPrimaryRemote = remote.ok && remote.stdout.trim().length > 0;
  const upstream = tryGit(root, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
  let aheadCount = 0;
  let behindCount = 0;
  let hasUpstream = false;
  if (upstream.ok) {
    hasUpstream = true;
    const parts = upstream.stdout.trim().split(/\s+/);
    behindCount = Number.parseInt(parts[0] ?? "0", 10) || 0;
    aheadCount = Number.parseInt(parts[1] ?? "0", 10) || 0;
  }
  const defaultRef = tryGit(root, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  const defaultName = defaultRef.ok
    ? defaultRef.stdout.trim().replace(/^refs\/remotes\/[^/]+\//, "")
    : "main";
  return {
    isRepo: true,
    hasPrimaryRemote,
    isDefaultRef: refName === defaultName,
    refName,
    hasWorkingTreeChanges: files.length > 0,
    workingTree: {
      files: files.slice(0, 200),
      insertions: 0,
      deletions: 0,
    },
    hasUpstream,
    aheadCount,
    behindCount,
    pr: null,
  };
};

export const vcsRefreshStatus = (input: VcsStatusInput): VcsStatusResult => vcsStatus(input);

export const vcsPull = (input: VcsPullInput): VcsPullResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    throw new GitCommandError({
      operation: "pull",
      command: "git",
      cwd,
      detail: "Not a git repository.",
    });
  }
  const before = tryGit(root, ["rev-parse", "HEAD"]);
  runGit(root, ["pull", "--ff-only"], "pull");
  const after = tryGit(root, ["rev-parse", "HEAD"]);
  const branch = tryGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const upstream = tryGit(root, ["rev-parse", "--abbrev-ref", "@{upstream}"]);
  return {
    status:
      before.ok && after.ok && before.stdout.trim() === after.stdout.trim()
        ? "skipped_up_to_date"
        : "pulled",
    refName: branch.ok ? branch.stdout.trim() : "HEAD",
    upstreamRef: upstream.ok ? upstream.stdout.trim() : null,
  };
};

export const vcsListRefs = (input: VcsListRefsInput): VcsListRefsResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    return { refs: [], isRepo: false, hasPrimaryRemote: false, nextCursor: null, totalCount: 0 };
  }
  const current = tryGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const currentName = current.ok ? current.stdout.trim() : "";
  const remote = tryGit(root, ["remote"]);
  const format = "%(refname:short)%09%(HEAD)%09%(worktreepath)";
  const local = tryGit(root, ["for-each-ref", "--format", format, "refs/heads"]);
  const remotes =
    input.includeMatchingRemoteRefs === true ||
    input.refKind === "remote" ||
    input.refKind === "all"
      ? tryGit(root, ["for-each-ref", "--format", format, "refs/remotes"])
      : { ok: false as const, detail: "" };
  const refs: VcsListRefsResult["refs"][number][] = [];
  const ingest = (stdout: string, isRemote: boolean) => {
    for (const line of stdout.split("\n")) {
      if (line.length === 0) continue;
      const [name, head, worktree] = line.split("\t");
      if (name === undefined || name.length === 0) continue;
      if (input.query !== undefined && !name.toLowerCase().includes(input.query.toLowerCase())) {
        continue;
      }
      if (input.refKind === "local" && isRemote) continue;
      if (input.refKind === "remote" && !isRemote) continue;
      refs.push({
        name,
        isRemote,
        current: head === "*" || name === currentName,
        isDefault: name === "main" || name === "master",
        worktreePath: worktree && worktree.length > 0 ? worktree : null,
      });
    }
  };
  if (local.ok) ingest(local.stdout, false);
  if (remotes.ok) ingest(remotes.stdout, true);
  const cursor = input.cursor ?? 0;
  const limit = input.limit ?? 80;
  const page = refs.slice(cursor, cursor + limit);
  const next = cursor + limit < refs.length ? cursor + limit : null;
  return {
    refs: page,
    isRepo: true,
    hasPrimaryRemote: remote.ok && remote.stdout.trim().length > 0,
    nextCursor: next,
    totalCount: refs.length,
  };
};

export const vcsCreateRef = (input: VcsCreateRefInput): VcsCreateRefResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    throw new GitCommandError({
      operation: "createRef",
      command: "git",
      cwd,
      detail: "Not a git repository.",
    });
  }
  runGit(root, ["branch", input.refName], "createRef");
  if (input.switchRef === true) {
    runGit(root, ["switch", input.refName], "createRef");
  }
  return { refName: input.refName };
};

export const vcsSwitchRef = (input: VcsSwitchRefInput): VcsSwitchRefResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    throw new GitCommandError({
      operation: "switchRef",
      command: "git",
      cwd,
      detail: "Not a git repository.",
    });
  }
  runGit(root, ["switch", input.refName], "switchRef");
  return { refName: input.refName };
};

export const vcsInit = (input: VcsInitInput): void => {
  const cwd = Path.resolve(input.cwd);
  if (input.kind !== undefined && input.kind !== "git") {
    throw new GitCommandError({
      operation: "init",
      command: "git",
      cwd,
      detail: `Unsupported VCS kind '${input.kind}'.`,
    });
  }
  Fs.mkdirSync(cwd, { recursive: true });
  runGit(cwd, ["init"], "init");
};

export const vcsCreateWorktree = (input: VcsCreateWorktreeInput): VcsCreateWorktreeResult => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    throw new GitCommandError({
      operation: "createWorktree",
      command: "git",
      cwd,
      detail: "Not a git repository.",
    });
  }
  const dest =
    input.path === null || input.path.length === 0
      ? Path.join(root, ".nero-worktrees", input.newRefName ?? input.refName)
      : Path.resolve(input.path);
  const args = ["worktree", "add"];
  if (input.newRefName !== undefined) {
    args.push("-b", input.newRefName, dest, input.baseRefName ?? input.refName);
  } else {
    args.push(dest, input.refName);
  }
  runGit(root, args, "createWorktree");
  return {
    worktree: {
      path: dest,
      refName: input.newRefName ?? input.refName,
    },
  };
};

export const vcsRemoveWorktree = (input: VcsRemoveWorktreeInput): void => {
  const cwd = Path.resolve(input.cwd);
  const root = gitRepoRoot(cwd);
  if (root === undefined) {
    throw new GitCommandError({
      operation: "removeWorktree",
      command: "git",
      cwd,
      detail: "Not a git repository.",
    });
  }
  const args = ["worktree", "remove"];
  if (input.force === true) args.push("--force");
  args.push(input.path);
  runGit(root, args, "removeWorktree");
};

export const stackedActionEvents = (input: GitRunStackedActionInput): GitActionProgressEvent[] => {
  const cwd = Path.resolve(input.cwd);
  const events: GitActionProgressEvent[] = [
    {
      actionId: input.actionId,
      cwd,
      action: input.action,
      kind: "action_started",
      phases: ["commit", "push", "pr"],
    },
  ];
  const wantsCommit =
    input.action === "commit" ||
    input.action === "commit_push" ||
    input.action === "commit_push_pr";
  const wantsPush =
    input.action === "push" || input.action === "commit_push" || input.action === "commit_push_pr";
  const wantsPr = input.action === "create_pr" || input.action === "commit_push_pr";
  let result: GitRunStackedActionResult = {
    action: input.action,
    branch: { status: "skipped_not_requested" },
    commit: { status: "skipped_not_requested" },
    push: { status: "skipped_not_requested" },
    pr: { status: "skipped_not_requested" },
    toast: { title: "Done", cta: { kind: "none" } },
  };
  try {
    if (input.featureBranch === true) {
      events.push({
        actionId: input.actionId,
        cwd,
        action: input.action,
        kind: "phase_started",
        phase: "branch",
        label: "Create branch",
      });
      const name = `nero/${nextToken("b")}`;
      runGit(cwd, ["switch", "-c", name], "stacked.branch");
      result = { ...result, branch: { status: "created", name } };
    }
    if (wantsCommit) {
      events.push({
        actionId: input.actionId,
        cwd,
        action: input.action,
        kind: "phase_started",
        phase: "commit",
        label: "Commit",
      });
      if (input.filePaths !== undefined) {
        runGit(cwd, ["add", "--", ...input.filePaths], "stacked.add");
      } else {
        runGit(cwd, ["add", "-A"], "stacked.add");
      }
      const status = tryGit(cwd, ["status", "--porcelain"]);
      if (!status.ok || status.stdout.trim().length === 0) {
        result = { ...result, commit: { status: "skipped_no_changes" } };
      } else {
        const message = input.commitMessage ?? "Update";
        runGit(cwd, ["commit", "-m", message], "stacked.commit");
        const sha = tryGit(cwd, ["rev-parse", "HEAD"]);
        result = {
          ...result,
          commit: {
            status: "created",
            commitSha: sha.ok ? sha.stdout.trim() : undefined,
            subject: message,
          },
        };
      }
    }
    if (wantsPush) {
      events.push({
        actionId: input.actionId,
        cwd,
        action: input.action,
        kind: "phase_started",
        phase: "push",
        label: "Push",
      });
      const branch = tryGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
      const name = branch.ok ? branch.stdout.trim() : "HEAD";
      runGit(cwd, ["push", "-u", "origin", name], "stacked.push");
      result = {
        ...result,
        push: {
          status: "pushed",
          branch: name,
          upstreamBranch: `origin/${name}`,
          setUpstream: true,
        },
      };
    }
    if (wantsPr) {
      events.push({
        actionId: input.actionId,
        cwd,
        action: input.action,
        kind: "phase_started",
        phase: "pr",
        label: "Open pull request",
      });
      result = {
        ...result,
        pr: { status: "skipped_not_requested" },
        toast: {
          title: "Pull request not created",
          description: "Install and authenticate gh to open a pull request.",
          cta: { kind: "none" },
        },
      };
    }
    events.push({
      actionId: input.actionId,
      cwd,
      action: input.action,
      kind: "action_finished",
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stacked git action failed.";
    events.push({
      actionId: input.actionId,
      cwd,
      action: input.action,
      kind: "action_failed",
      phase: null,
      message: message.slice(0, 2_000),
    });
  }
  return events;
};

export const resolvePullRequest = (_input: GitPullRequestRefInput): GitResolvePullRequestResult => {
  throw new GitManagerError({
    operation: "resolvePullRequest",
    cwd: _input.cwd,
    detail: "Pull request lookup needs gh; not configured in this workspace yet.",
  });
};

export const preparePullRequestThread = (
  _input: GitPreparePullRequestThreadInput,
): GitPreparePullRequestThreadResult => {
  throw new GitManagerError({
    operation: "preparePullRequestThread",
    cwd: _input.cwd,
    detail: "Pull request checkout needs gh; not configured in this workspace yet.",
  });
};

export const reviewDiffPreview = (input: ReviewDiffPreviewInput): ReviewDiffPreviewResult => {
  const cwd = Path.resolve(input.cwd);
  const args = ["diff", "--no-ext-diff"];
  if (input.ignoreWhitespace === true) args.push("-w");
  if (input.baseRef !== undefined) args.push(input.baseRef);
  const diff = tryGit(cwd, args);
  const text = diff.ok ? diff.stdout : "";
  return {
    cwd,
    generatedAt: nowUtc(),
    sources: [
      {
        id: "working-tree",
        kind: "working-tree",
        title: "Working tree",
        baseRef: input.baseRef ?? null,
        headRef: null,
        diff: text,
        diffHash: djb2Hex(text),
        truncated: text.length > 500_000,
      },
    ],
  };
};

export const reviewDiffFileContents = (
  input: ReviewDiffFileContentsInput,
): ReviewDiffFileContentsResult => {
  const cwd = Path.resolve(input.cwd);
  const readAt = (ref: string | null, filePath: string): string => {
    if (ref === null) {
      try {
        return Fs.readFileSync(Path.join(cwd, filePath), "utf8");
      } catch {
        return "";
      }
    }
    const blob = tryGit(cwd, ["show", `${ref}:${filePath}`]);
    return blob.ok ? blob.stdout : "";
  };
  return {
    oldContents: input.changeType === "new" ? "" : readAt(input.baseRef, input.oldPath),
    newContents: input.changeType === "deleted" ? "" : readAt(input.headRef, input.newPath),
  };
};

const which = (bin: string): string | undefined => {
  const result = ChildProcess.spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 5_000 });
  if (result.error || result.status !== 0) return undefined;
  return (result.stdout || result.stderr || "").trim().split("\n")[0];
};

export const discoverSourceControl = (): SourceControlDiscoveryResult => {
  const gitVersion = which("git");
  const ghVersion = which("gh");
  return {
    versionControlSystems: [
      {
        kind: "git",
        implemented: true,
        label: "Git",
        executable: "git",
        status: gitVersion === undefined ? "missing" : "available",
        version: gitVersion === undefined ? Option.none() : Option.some(gitVersion.slice(0, 80)),
        installHint: "Install git to enable source control.",
        detail: Option.none(),
      },
    ],
    sourceControlProviders: [
      {
        kind: "github",
        label: "GitHub",
        executable: "gh",
        status: ghVersion === undefined ? "missing" : "available",
        version: ghVersion === undefined ? Option.none() : Option.some(ghVersion.slice(0, 80)),
        installHint: "Install the GitHub CLI (gh) and run gh auth login.",
        detail: Option.none(),
        auth: {
          status: ghVersion === undefined ? "unauthenticated" : "unknown",
          account: Option.none(),
          host: Option.none(),
          detail: Option.none(),
        },
      },
    ],
  };
};

export const lookupRepository = (
  input: SourceControlRepositoryLookupInput,
): SourceControlRepositoryInfo => {
  throw new SourceControlRepositoryError({
    provider: input.provider,
    operation: "lookupRepository",
    detail: "Repository lookup is not wired in this Nero build yet.",
  });
};

export const cloneRepository = (
  input: SourceControlCloneRepositoryInput,
): SourceControlCloneRepositoryResult => {
  const dest = Path.resolve(input.destinationPath);
  const remote = input.remoteUrl ?? input.repository;
  if (remote === undefined) {
    throw new SourceControlRepositoryError({
      provider: input.provider ?? "unknown",
      operation: "cloneRepository",
      detail: "A repository or remote URL is required.",
    });
  }
  Fs.mkdirSync(Path.dirname(dest), { recursive: true });
  const result = ChildProcess.spawnSync("git", ["clone", remote, dest], {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error || result.status !== 0) {
    throw new SourceControlRepositoryError({
      provider: input.provider ?? "unknown",
      operation: "cloneRepository",
      detail: (result.stderr || result.error?.message || "git clone failed").slice(0, 2_000),
    });
  }
  return { cwd: dest, remoteUrl: remote, repository: null };
};

export const publishRepository = (
  input: SourceControlPublishRepositoryInput,
): SourceControlPublishRepositoryResult => {
  throw new SourceControlRepositoryError({
    provider: input.provider,
    operation: "publishRepository",
    detail: "Publishing a repository needs gh; not configured in this workspace yet.",
  });
};

export const hostPowerSource = () =>
  platformOs() === "darwin"
    ? "node-macos-shell"
    : platformOs() === "linux"
      ? "node-linux"
      : "unknown";
