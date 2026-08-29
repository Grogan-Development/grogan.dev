import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { KasmVncFrame } from "./KasmVncFrame";

describe("KasmVncFrame", () => {
  it("embeds the Kasm HTML client at same-origin /vnc/", () => {
    const html = renderToStaticMarkup(<KasmVncFrame visible />);
    expect(html).toContain('data-preview-guest="kasmvnc"');
    expect(html).toContain('title="Agent seat"');
    expect(html).toContain("/vnc/?");
    expect(html).toContain("autoconnect=1");
    expect(html).toContain("clipboard-read");
  });

  it("does not mount the guest while the panel is hidden", () => {
    const html = renderToStaticMarkup(<KasmVncFrame visible={false} />);
    expect(html).toBe("");
  });
});
