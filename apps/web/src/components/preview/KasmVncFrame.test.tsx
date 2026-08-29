import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { KasmVncFrame } from "./KasmVncFrame";

describe("KasmVncFrame", () => {
  it("embeds the Kasm HTML client at origin-root /vnc/ with scale, not remote resize", () => {
    const html = renderToStaticMarkup(<KasmVncFrame visible />);
    expect(html).toContain('data-preview-guest="kasmvnc"');
    expect(html).toContain('title="Agent seat"');
    expect(html).toContain('src="/vnc/?');
    expect(html).not.toContain("/w/");
    expect(html).toContain("autoconnect=1");
    expect(html).toContain("resize=scale");
    expect(html).not.toContain("resize=remote");
    expect(html).toContain("clipboard-read");
  });

  it("keeps the iframe mounted while hidden so the seat websocket survives", () => {
    const html = renderToStaticMarkup(<KasmVncFrame visible={false} />);
    expect(html).toContain('data-preview-guest="kasmvnc"');
    expect(html).toContain("hidden");
  });
});
