import * as Fs from "node:fs";
import * as Path from "node:path";

import {
  FilesystemBrowseError,
  type FilesystemBrowseInput,
  type FilesystemBrowseResult,
  ProjectListEntriesError,
  type ProjectListEntriesInput,
  type ProjectListEntriesResult,
  ProjectReadFileError,
  type ProjectReadFileInput,
  type ProjectReadFileResult,
  ProjectSearchContentsError,
  type ProjectSearchContentsInput,
  type ProjectSearchContentsResult,
  ProjectSearchEntriesError,
  type ProjectSearchEntriesInput,
  type ProjectSearchEntriesResult,
  ProjectWriteFileError,
  type ProjectWriteFileInput,
  type ProjectWriteFileResult,
} from "@t3tools/contracts";

const LIST_CAP = 5_000;
const SEARCH_WALK_CAP = 8_000;
const READ_CAP_BYTES = 1_000_000;
const SKIP_DIR_NAMES = new Set([".git", "node_modules", ".nero", "dist", ".vite-plus"]);

export const isInside = (root: string, candidate: string): boolean => {
  const rel = Path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !Path.isAbsolute(rel));
};

export const resolveContained = (
  root: string,
  inputPath: string,
): { readonly ok: true; readonly path: string } | { readonly ok: false } => {
  const resolved = Path.resolve(root, inputPath);
  if (!isInside(root, resolved)) {
    return { ok: false };
  }
  return { ok: true, path: resolved };
};

const isSkippedDir = (name: string): boolean => SKIP_DIR_NAMES.has(name);

const isProbablyBinary = (buffer: Buffer): boolean => buffer.includes(0);

export const listProjectEntries = (input: ProjectListEntriesInput): ProjectListEntriesResult => {
  const cwd = Path.resolve(input.cwd);
  let stat: Fs.Stats;
  try {
    stat = Fs.statSync(cwd);
  } catch {
    throw new ProjectListEntriesError({
      cwd: input.cwd,
      failure: "workspace_root_not_found",
    });
  }
  if (!stat.isDirectory()) {
    throw new ProjectListEntriesError({
      cwd: input.cwd,
      failure: "workspace_root_not_directory",
    });
  }
  let names: string[];
  try {
    names = Fs.readdirSync(cwd);
  } catch (cause) {
    throw new ProjectListEntriesError({
      cwd: input.cwd,
      failure: "workspace_root_stat_failed",
      cause,
    });
  }
  const entries: { path: string; kind: "file" | "directory" }[] = [];
  let truncated = false;
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (entries.length >= LIST_CAP) {
      truncated = true;
      break;
    }
    const full = Path.join(cwd, name);
    let entryStat: Fs.Stats;
    try {
      entryStat = Fs.lstatSync(full);
    } catch {
      continue;
    }
    entries.push({
      path: name,
      kind: entryStat.isDirectory() ? "directory" : "file",
    });
  }
  return { entries, truncated };
};

export const readProjectFile = (input: ProjectReadFileInput): ProjectReadFileResult => {
  const root = Path.resolve(input.cwd);
  const contained = resolveContained(root, input.relativePath);
  if (!contained.ok) {
    throw new ProjectReadFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "workspace_path_outside_root",
    });
  }
  let stat: Fs.Stats;
  try {
    stat = Fs.statSync(contained.path);
  } catch (cause) {
    throw new ProjectReadFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "operation_failed",
      operation: "stat",
      operationPath: contained.path,
      cause,
    });
  }
  if (!stat.isFile()) {
    throw new ProjectReadFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "path_not_file",
      resolvedPath: contained.path,
    });
  }
  let buffer: Buffer;
  try {
    buffer = Fs.readFileSync(contained.path);
  } catch (cause) {
    throw new ProjectReadFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "operation_failed",
      operation: "read",
      operationPath: contained.path,
      cause,
    });
  }
  if (isProbablyBinary(buffer)) {
    throw new ProjectReadFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "binary_file",
      resolvedPath: contained.path,
    });
  }
  const truncated = buffer.byteLength > READ_CAP_BYTES;
  const slice = truncated ? buffer.subarray(0, READ_CAP_BYTES) : buffer;
  return {
    relativePath: input.relativePath,
    contents: slice.toString("utf8"),
    byteLength: buffer.byteLength,
    truncated,
  };
};

export const writeProjectFile = (input: ProjectWriteFileInput): ProjectWriteFileResult => {
  const root = Path.resolve(input.cwd);
  const contained = resolveContained(root, input.relativePath);
  if (!contained.ok) {
    throw new ProjectWriteFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "workspace_path_outside_root",
    });
  }
  try {
    Fs.mkdirSync(Path.dirname(contained.path), { recursive: true });
    Fs.writeFileSync(contained.path, input.contents, "utf8");
  } catch (cause) {
    throw new ProjectWriteFileError({
      cwd: input.cwd,
      relativePath: input.relativePath,
      failure: "operation_failed",
      operation: "write-file",
      operationPath: contained.path,
      cause,
    });
  }
  return { relativePath: input.relativePath };
};

const walkEntries = (
  root: string,
  dir: string,
  visit: (relative: string, kind: "file" | "directory") => boolean,
): void => {
  let names: string[];
  try {
    names = Fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (isSkippedDir(name)) continue;
    const full = Path.join(dir, name);
    const relative = Path.relative(root, full);
    let stat: Fs.Stats;
    try {
      stat = Fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!visit(relative, "directory")) return;
      walkEntries(root, full, visit);
    } else if (stat.isFile()) {
      if (!visit(relative, "file")) return;
    }
  }
};

const pathMatchesQuery = (relative: string, query: string): boolean => {
  if (query.length === 0) return true;
  return relative.toLowerCase().includes(query.toLowerCase());
};

export const searchProjectEntries = (
  input: ProjectSearchEntriesInput,
): ProjectSearchEntriesResult => {
  const root = Path.resolve(input.cwd);
  if (!Fs.existsSync(root) || !Fs.statSync(root).isDirectory()) {
    throw new ProjectSearchEntriesError({
      cwd: input.cwd,
      queryLength: input.query.length,
      limit: input.limit,
      failure: "workspace_root_not_found",
    });
  }
  const entries: { path: string; kind: "file" | "directory" }[] = [];
  let scanned = 0;
  let truncated = false;
  walkEntries(root, root, (relative, kind) => {
    scanned += 1;
    if (scanned > SEARCH_WALK_CAP) {
      truncated = true;
      return false;
    }
    if (input.kind !== undefined && kind !== input.kind) return true;
    if (!pathMatchesQuery(relative, input.query)) return true;
    if (input.imageOnly === true && kind === "file") {
      if (!/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(relative)) return true;
    }
    entries.push({ path: relative, kind });
    if (entries.length >= input.limit) {
      truncated = true;
      return false;
    }
    return true;
  });
  return { entries, truncated };
};

const matchRanges = (
  line: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  useRegex: boolean,
):
  | { readonly lineContent: string; readonly matchRanges: { start: number; end: number }[] }
  | undefined => {
  if (useRegex) {
    try {
      const flags = caseSensitive ? "g" : "gi";
      const pattern = wholeWord ? `\\b(?:${query})\\b` : query;
      const regex = new RegExp(pattern, flags);
      const ranges: { start: number; end: number }[] = [];
      for (const match of line.matchAll(regex)) {
        const start = match.index ?? 0;
        ranges.push({ start, end: start + match[0].length });
      }
      if (ranges.length === 0) return undefined;
      return { lineContent: line, matchRanges: ranges };
    } catch {
      return undefined;
    }
  }
  const haystack = caseSensitive ? line : line.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  let from = 0;
  while (from <= haystack.length - needle.length) {
    const start = haystack.indexOf(needle, from);
    if (start < 0) break;
    if (wholeWord) {
      const before = start === 0 ? " " : (haystack[start - 1] ?? " ");
      const after = haystack[start + needle.length] ?? " ";
      if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) {
        from = start + needle.length;
        continue;
      }
    }
    ranges.push({ start, end: start + needle.length });
    from = start + needle.length;
  }
  if (ranges.length === 0) return undefined;
  return { lineContent: line, matchRanges: ranges };
};

export const searchProjectContents = (
  input: ProjectSearchContentsInput,
): ProjectSearchContentsResult => {
  const root = Path.resolve(input.cwd);
  if (!Fs.existsSync(root) || !Fs.statSync(root).isDirectory()) {
    throw new ProjectSearchContentsError({
      cwd: input.cwd,
      queryLength: input.query.length,
      limit: input.limit,
      failure: "workspace_root_not_found",
    });
  }
  const matches: {
    path: string;
    lineNumber: number;
    lineContent: string;
    matchRanges: { start: number; end: number }[];
  }[] = [];
  let scanned = 0;
  let truncated = false;
  let regexFallbackError: string | undefined;
  if (input.useRegex) {
    try {
      new RegExp(input.query, input.caseSensitive ? "g" : "gi");
    } catch (error) {
      regexFallbackError = error instanceof Error ? error.message : "Invalid regular expression.";
    }
  }
  walkEntries(root, root, (relative, kind) => {
    if (kind !== "file") return true;
    scanned += 1;
    if (scanned > SEARCH_WALK_CAP) {
      truncated = true;
      return false;
    }
    const full = Path.join(root, relative);
    let buffer: Buffer;
    try {
      buffer = Fs.readFileSync(full);
    } catch {
      return true;
    }
    if (buffer.byteLength > READ_CAP_BYTES || isProbablyBinary(buffer)) return true;
    const text = buffer.toString("utf8");
    const lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const hit = matchRanges(
        line,
        input.query,
        input.caseSensitive,
        input.wholeWord,
        input.useRegex,
      );
      if (hit === undefined) continue;
      matches.push({
        path: relative,
        lineNumber: i + 1,
        lineContent: hit.lineContent.slice(0, 500),
        matchRanges: hit.matchRanges,
      });
      if (matches.length >= input.limit) {
        truncated = true;
        return false;
      }
    }
    return true;
  });
  return regexFallbackError === undefined
    ? { matches, truncated }
    : { matches, truncated, regexFallbackError };
};

export const browseFilesystem = (
  input: FilesystemBrowseInput,
  fallbackCwd: string,
): FilesystemBrowseResult => {
  const cwd = Path.resolve(input.cwd ?? fallbackCwd);
  const raw = input.partialPath.trim();
  const candidate = Path.isAbsolute(raw) ? Path.resolve(raw) : Path.resolve(cwd, raw);
  let parentPath = candidate;
  let prefix = "";
  try {
    const stat = Fs.statSync(candidate);
    if (!stat.isDirectory()) {
      parentPath = Path.dirname(candidate);
      prefix = Path.basename(candidate).toLowerCase();
    }
  } catch {
    parentPath = Path.dirname(candidate);
    prefix = Path.basename(candidate).toLowerCase();
  }
  let names: string[];
  try {
    names = Fs.readdirSync(parentPath);
  } catch (cause) {
    throw new FilesystemBrowseError({
      partialPath: input.partialPath,
      cwd: input.cwd,
      failure: "read_directory_failed",
      parentPath,
      cause,
    });
  }
  const entries = names
    .filter((name) => (prefix.length === 0 ? true : name.toLowerCase().startsWith(prefix)))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 200)
    .map((name) => ({
      name,
      fullPath: Path.join(parentPath, name),
    }));
  return { parentPath, entries };
};
