import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { readProjectFile, searchProjectContents } from "./files.ts";

const line = `${"a".repeat(1023)}\n`;

describe("daemon file reads", () => {
  it("truncates large reads by size, without buffering the whole file", () => {
    const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-files-"));
    const big = Path.join(root, "big.txt");
    // ~3 MB of non-binary lines: well over the 1 MB read cap.
    Fs.writeFileSync(big, line.repeat(3 * 1024));
    const size = Fs.statSync(big).size;
    expect(size).toBeGreaterThan(1_000_000);

    const result = readProjectFile({ cwd: root, relativePath: "big.txt" });
    expect(result.truncated).toBe(true);
    expect(result.byteLength).toBe(size);
    expect(result.contents.length).toBeLessThanOrEqual(1_000_000);
  });

  it("skips oversized files during content search", () => {
    const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-files-"));
    Fs.writeFileSync(Path.join(root, "needle.txt"), "the-needle\n");
    const big = Path.join(root, "big.txt");
    Fs.writeFileSync(big, `${line.repeat(1100)}the-needle\n`);
    expect(Fs.statSync(big).size).toBeGreaterThan(1_000_000);

    const result = searchProjectContents({
      cwd: root,
      query: "the-needle",
      limit: 10,
      caseSensitive: false,
      wholeWord: false,
      useRegex: false,
    });
    expect(result.matches.map((match) => match.path)).toEqual(["needle.txt"]);
  });
});
