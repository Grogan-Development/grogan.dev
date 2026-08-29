import * as Fs from "node:fs";
import * as Os from "node:os";
import * as Path from "node:path";
import * as Process from "node:process";

import { describe, expect, it } from "@effect/vitest";

import {
  executeTool,
  isNeroDesktopShotCommand,
  isNeroRunCommand,
  parseShotOutPath,
  parseToolArguments,
  rewriteShotCommand,
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

  it("rewrites default nero-desktop shot to a workspace --out file", () => {
    const tmp = workspace();
    const rewritten = rewriteShotCommand("nero-desktop shot", tmp.root);
    expect(rewritten.outPath).toBeDefined();
    expect(rewritten.command).toContain("--out");
    expect(rewritten.outPath?.startsWith(tmp.root)).toBe(true);
    expect(parseShotOutPath("nero-desktop shot --out -", tmp.root)).toBeUndefined();
  });

  it("captures a default nero-desktop shot from --out, not truncated stdout", async () => {
    const tmp = workspace();
    const bin = Path.join(tmp.root, "bin");
    Fs.mkdirSync(bin, { recursive: true });
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(200_000, 1),
    ]);
    const pngPath = Path.join(tmp.root, "big.png");
    Fs.writeFileSync(pngPath, png);
    Fs.writeFileSync(
      Path.join(bin, "nero-desktop"),
      `#!/bin/sh
out="-"
cmd="$1"
shift
[ "$cmd" = "shot" ] || exit 1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [ "$out" = "-" ]; then
  cat ${JSON.stringify(pngPath)}
else
  cp ${JSON.stringify(pngPath)} "$out"
fi
`,
      { mode: 0o755 },
    );
    const previousPath = Process.env.PATH ?? "";
    Process.env.PATH = `${bin}${Path.delimiter}${previousPath}`;
    const ws = Path.join(tmp.root, "ws");
    Fs.mkdirSync(ws, { recursive: true });
    try {
      const result = await executeTool("bash", JSON.stringify({ command: "nero-desktop shot" }), {
        workspaceRoot: ws,
        homeDir: tmp.home,
        signal: new AbortController().signal,
      });
      expect(result.failed).toBe(false);
      expect(result.shots).toHaveLength(1);
      expect(result.shots[0]?.base64.length ?? 0).toBeGreaterThan(1000);
    } finally {
      Process.env.PATH = previousPath;
    }
  });

  it("does not expose router keys or NERO_ACCESS_TOKEN to bash", async () => {
    const tmp = workspace();
    const ctx = {
      workspaceRoot: tmp.root,
      homeDir: tmp.home,
      signal: new AbortController().signal,
    };
    const previousKey = Process.env.ZAI_API_KEY;
    const previousBaseten = Process.env.BASETEN_API_KEY;
    const previousToken = Process.env.NERO_ACCESS_TOKEN;
    Process.env.ZAI_API_KEY = "secret-zai-key";
    Process.env.BASETEN_API_KEY = "secret-baseten-key";
    Process.env.NERO_ACCESS_TOKEN = "secret-access-token";
    try {
      const result = await executeTool(
        "bash",
        JSON.stringify({
          command:
            "printenv ZAI_API_KEY; printenv BASETEN_API_KEY; printenv NERO_ACCESS_TOKEN; printenv HOME",
        }),
        ctx,
      );
      expect(result.text).not.toContain("secret-zai-key");
      expect(result.text).not.toContain("secret-baseten-key");
      expect(result.text).not.toContain("secret-access-token");
      expect(result.text).toContain(tmp.home);
    } finally {
      if (previousKey === undefined) delete Process.env.ZAI_API_KEY;
      else Process.env.ZAI_API_KEY = previousKey;
      if (previousBaseten === undefined) delete Process.env.BASETEN_API_KEY;
      else Process.env.BASETEN_API_KEY = previousBaseten;
      if (previousToken === undefined) delete Process.env.NERO_ACCESS_TOKEN;
      else Process.env.NERO_ACCESS_TOKEN = previousToken;
    }
  });

  it("treats only actual nero-run invocations as detached", () => {
    expect(isNeroRunCommand("nero-run blender -b scene.blend")).toBe(true);
    expect(isNeroRunCommand("  NERO_X=1 nero-run true")).toBe(true);
    expect(isNeroRunCommand("sleep 9999; nero-run true")).toBe(false);
    expect(isNeroRunCommand("echo 'run it with nero-run later'")).toBe(false);
    expect(isNeroRunCommand("cat nero-run-notes.md")).toBe(false);
  });

  it("refuses to edit files beyond the edit size cap", async () => {
    const tmp = workspace();
    const ctx = {
      workspaceRoot: tmp.root,
      homeDir: tmp.home,
      signal: new AbortController().signal,
    };
    Fs.writeFileSync(Path.join(tmp.root, "big.bin"), Buffer.alloc(9 * 1024 * 1024, 7));
    const result = await executeTool(
      "edit",
      JSON.stringify({ path: "big.bin", old_string: "a", new_string: "b" }),
      ctx,
    );
    expect(result.failed).toBe(true);
    expect(result.text).toContain("larger than");
    expect(Fs.statSync(Path.join(tmp.root, "big.bin")).size).toBe(9 * 1024 * 1024);
  });

  it("skips shot files over the shot size cap instead of buffering them", async () => {
    const tmp = workspace();
    const bin = Path.join(tmp.root, "bin");
    Fs.mkdirSync(bin, { recursive: true });
    const huge = Path.join(tmp.root, "huge.png");
    Fs.writeFileSync(
      huge,
      Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
    );
    Fs.appendFileSync(huge, Buffer.alloc(11 * 1024 * 1024, 0));
    Fs.writeFileSync(
      Path.join(bin, "nero-desktop"),
      `#!/bin/sh
[ "$1" = "shot" ] || exit 1
shift
while [ "$#" -gt 0 ]; do
  case "$1" in
    --out) cp ${JSON.stringify(huge)} "$2"; exit 0 ;;
    *) shift ;;
  esac
done
exit 1
`,
      { mode: 0o755 },
    );
    const previousPath = Process.env.PATH ?? "";
    Process.env.PATH = `${bin}${Path.delimiter}${previousPath}`;
    try {
      const result = await executeTool("bash", JSON.stringify({ command: "nero-desktop shot" }), {
        workspaceRoot: tmp.root,
        homeDir: tmp.home,
        signal: new AbortController().signal,
      });
      expect(result.failed).toBe(false);
      expect(result.shots).toHaveLength(0);
    } finally {
      Process.env.PATH = previousPath;
    }
  });
});
