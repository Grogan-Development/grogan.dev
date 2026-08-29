import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import {
  executeTool,
  isNeroDesktopShotCommand,
  parseShotOutPath,
  parseToolArguments,
} from "./tools.ts";

const workspace = (): { readonly root: string; readonly home: string } => {
  const root = Fs.mkdtempSync(Path.join(Os.tmpdir(), "nero-tools-"));
  return { root, home: root };
};

describe("pi tools", () => {
  it("parses shot --out and detects nero-desktop shot", () => {
    expect(isNeroDesktopShotCommand("nero-desktop shot --out seat.png")).toBe(true);
    expect(parseShotOutPath("nero-desktop shot --out seat.png", "/ws")).toBe(
      Path.resolve("/ws", "seat.png"),
    );
    expect(parseShotOutPath("nero-desktop shot --out -", "/ws")).toBeUndefined();
    expect(isNeroDesktopShotCommand("echo hello")).toBe(false);
  });

  it("writes, reads, and edits files inside the workspace", async () => {
    const tmp = workspace();
    const ctx = {
      workspaceRoot: tmp.root,
      homeDir: tmp.home,
      signal: new AbortController().signal,
    };
    const written = await executeTool(
      "write",
      JSON.stringify({ path: "src/a.ts", content: "const x = 1;\n" }),
      ctx,
    );
    expect(written.failed).toBe(false);
    expect(Fs.readFileSync(Path.join(tmp.root, "src", "a.ts"), "utf8")).toBe("const x = 1;\n");

    const read = await executeTool("read", JSON.stringify({ path: "src/a.ts" }), ctx);
    expect(read.text).toContain("const x = 1;");

    const edited = await executeTool(
      "edit",
      JSON.stringify({ path: "src/a.ts", old_string: "const x = 1;", new_string: "const x = 2;" }),
      ctx,
    );
    expect(edited.failed).toBe(false);
    expect(Fs.readFileSync(Path.join(tmp.root, "src", "a.ts"), "utf8")).toBe("const x = 2;\n");
  });

  it("rejects edits outside the workspace and non-unique old_string", async () => {
    const tmp = workspace();
    const ctx = {
      workspaceRoot: tmp.root,
      homeDir: tmp.home,
      signal: new AbortController().signal,
    };
    Fs.writeFileSync(Path.join(tmp.root, "dup.txt"), "aa aa\n");
    const outside = await executeTool(
      "write",
      JSON.stringify({ path: "../escape.txt", content: "nope" }),
      ctx,
    );
    expect(outside.failed).toBe(true);

    const dup = await executeTool(
      "edit",
      JSON.stringify({ path: "dup.txt", old_string: "aa", new_string: "bb" }),
      ctx,
    );
    expect(dup.failed).toBe(true);
    expect(dup.text).toContain("2 times");

    const args = parseToolArguments(`{"command":"ls"}`);
    expect(args.command).toBe("ls");
  });
});
