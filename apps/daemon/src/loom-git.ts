/**
 * Read-only git browsing over Loom's smart-HTTP endpoint. The daemon keeps a
 * bare mirror of each browsed repo under <dataDir>/loom-cache/ and serves
 * refs / trees / blobs / logs from it with plain git plumbing. The remote
 * URL (with the workspace's scoped token) is only ever passed as a fetch
 * argument — it is never written into a config file.
 */
import * as ChildProcess from "node:child_process";
import * as Fs from "node:fs";
import * as Path from "node:path";
import * as Process from "node:process";

import { loomConfig } from "./loom.ts";

const MAX_BLOB_BYTES = 512 * 1024;
const GIT_TIMEOUT_MS = 60_000;

export const REPO_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/;
export const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;

export class LoomGitError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "LoomGitError";
    this.status = status;
  }
}

const storageName = (repo: string): string => repo.replaceAll("/", "%2F");

const sanitizeError = (value: string): string => {
  const { token } = loomConfig();
  if (token !== undefined && token.length > 0) return value.split(token).join("<token>");
  return value;
};

const runGit = (
  cwd: string,
  args: ReadonlyArray<string>,
): { readonly ok: boolean; readonly stdout: string; readonly stderr: string } => {
  const result = ChildProcess.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    // Never let git stop to ask for credentials (a 401 would hang the
    // daemon's event loop on a read from the terminal).
    env: { ...Process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "/bin/true" },
  });
  return {
    ok: result.status === 0 && result.error === undefined,
    stdout: result.stdout ?? "",
    stderr: sanitizeError(result.stderr ?? ""),
  };
};

const remoteUrl = (): string => {
  const config = loomConfig();
  if (config.token === undefined) {
    throw new LoomGitError("Loom is not configured on this workspace (LOOM_TOKEN missing).", 503);
  }
  const encoded = encodeURIComponent(config.token);
  const host = config.url.replace(/^https?:\/\//, "");
  return `http://nero:${encoded}@${host}/git`;
};

/** Bare mirror under <dataDir>/loom-cache/<repo>.git, updated on every call. */
const ensureCache = (dataDir: string, repo: string): string => {
  if (!REPO_ID_PATTERN.test(repo)) throw new LoomGitError("Invalid repository name.", 400);
  const root = Path.join(dataDir, "loom-cache");
  Fs.mkdirSync(root, { recursive: true });
  const bare = Path.join(root, `${storageName(repo)}.git`);
  if (!Fs.existsSync(Path.join(bare, "HEAD"))) {
    Fs.mkdirSync(bare, { recursive: true });
    const init = runGit(bare, ["init", "--bare", "--initial-branch=main", "."]);
    if (!init.ok) throw new LoomGitError(`git init failed: ${init.stderr}`);
  }
  const fetch = runGit(bare, [
    "fetch",
    "--prune",
    "--quiet",
    `${remoteUrl()}/${repo}.git`,
    "+refs/heads/*:refs/remotes/origin/*",
  ]);
  if (!fetch.ok) throw new LoomGitError(`git fetch failed: ${fetch.stderr}`);
  return bare;
};

const remoteRef = (ref: string): string => `refs/remotes/origin/${ref}`;

export const validRef = (ref: string): boolean => REF_PATTERN.test(ref) && !ref.includes("..");

export type LoomRepoRef = {
  readonly name: string;
  readonly oid: string;
};

export const listRepoRefs = (dataDir: string, repo: string): ReadonlyArray<LoomRepoRef> => {
  const bare = ensureCache(dataDir, repo);
  const result = runGit(bare, [
    "for-each-ref",
    "--format=%(refname)%00%(objectname)",
    "refs/remotes/origin/",
  ]);
  if (!result.ok) throw new LoomGitError(`git for-each-ref failed: ${result.stderr}`);
  return result.stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [refname, oid] = line.split("\0");
      return {
        name: (refname ?? "").replace("refs/remotes/origin/", ""),
        oid: oid ?? "",
      };
    })
    .filter((ref) => ref.name.length > 0);
};

export type LoomTreeEntry = {
  readonly name: string;
  readonly kind: "tree" | "blob";
  readonly size: number | null;
  readonly oid: string;
};

export const listRepoTree = (
  dataDir: string,
  repo: string,
  ref: string,
  path: string,
): ReadonlyArray<LoomTreeEntry> => {
  if (!validRef(ref)) throw new LoomGitError("Invalid ref.", 400);
  if (path.includes("..") || path.startsWith("/") || path.startsWith("-")) {
    throw new LoomGitError("Invalid path.", 400);
  }
  const bare = ensureCache(dataDir, repo);
  const spec = path.length > 0 ? `${remoteRef(ref)}:${path}` : remoteRef(ref);
  const result = runGit(bare, ["ls-tree", "-z", "-l", spec]);
  if (!result.ok) {
    if (result.stderr.includes("Not a valid object name")) {
      throw new LoomGitError("Ref or path not found.", 404);
    }
    throw new LoomGitError(`git ls-tree failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      // <mode> <type> <oid> <size>\t<path>
      const tab = entry.indexOf("\t");
      const meta = tab >= 0 ? entry.slice(0, tab).split(/\s+/) : [];
      return {
        name: tab >= 0 ? entry.slice(tab + 1) : "",
        kind: meta[1] === "tree" ? ("tree" as const) : ("blob" as const),
        size: meta[3] === undefined || meta[3] === "-" ? null : Number.parseInt(meta[3], 10),
        oid: meta[2] ?? "",
      };
    })
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "tree" ? -1 : 1,
    );
};

export type LoomBlob = {
  readonly path: string;
  readonly size: number;
  readonly truncated: boolean;
  readonly binary: boolean;
  readonly encoding: "utf8" | "base64";
  /** utf8 text, or raw base64 for binary blobs. */
  readonly content: string;
};

export const getRepoBlob = (dataDir: string, repo: string, ref: string, path: string): LoomBlob => {
  if (!validRef(ref)) throw new LoomGitError("Invalid ref.", 400);
  if (path.length === 0 || path.includes("..") || path.startsWith("/") || path.startsWith("-")) {
    throw new LoomGitError("Invalid path.", 400);
  }
  const bare = ensureCache(dataDir, repo);
  const child = ChildProcess.spawnSync("git", ["cat-file", "blob", `${remoteRef(ref)}:${path}`], {
    cwd: bare,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: MAX_BLOB_BYTES + 1024,
    encoding: "buffer",
  });
  if (child.status !== 0 || child.error !== undefined) {
    const stderr = sanitizeError((child.stderr ?? Buffer.alloc(0)).toString("utf8"));
    if (stderr.includes("Not a valid object name")) {
      throw new LoomGitError("Blob not found.", 404);
    }
    throw new LoomGitError(`git cat-file failed: ${stderr.slice(0, 300)}`);
  }
  const buffer = (child.stdout ?? Buffer.alloc(0)).subarray(0, MAX_BLOB_BYTES + 1024);
  const truncated = buffer.byteLength > MAX_BLOB_BYTES;
  const content = buffer.subarray(0, MAX_BLOB_BYTES);
  const binary = content.includes(0);
  return {
    path,
    size: buffer.byteLength,
    truncated,
    binary,
    encoding: binary ? "base64" : "utf8",
    content: binary ? content.toString("base64") : content.toString("utf8"),
  };
};

export type LoomCommit = {
  readonly oid: string;
  readonly short: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
};

export const listRepoCommits = (
  dataDir: string,
  repo: string,
  ref: string,
  limit: number,
): ReadonlyArray<LoomCommit> => {
  if (!validRef(ref)) throw new LoomGitError("Invalid ref.", 400);
  const bare = ensureCache(dataDir, repo);
  const capped = Math.min(Math.max(limit, 1), 200);
  const result = runGit(bare, [
    "log",
    `-n${capped}`,
    "--format=%H%00%h%00%an%00%aI%00%s",
    remoteRef(ref),
  ]);
  if (!result.ok) throw new LoomGitError(`git log failed: ${result.stderr}`);
  return result.stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [oid, short, author, date, ...subject] = line.split("\0");
      return {
        oid: oid ?? "",
        short: short ?? "",
        author: author ?? "",
        date: date ?? "",
        subject: subject.join("\0") ?? "",
      };
    });
};
