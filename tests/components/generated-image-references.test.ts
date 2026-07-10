import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sourceDirectories = ["app", "components", "lib", "content"];
const trustedImageComponent = "components/ui/ImagePlaceholder.tsx";

async function relevantSourcePaths() {
  const paths = await Promise.all(
    sourceDirectories.map(async (directory) => {
      const entries = await readdir(directory, { recursive: true });
      return entries
        .filter((entry) => /\.(?:ts|tsx|css)$/.test(entry))
        .map((entry) => `${directory}/${entry}`);
    }),
  );

  return paths.flat();
}

async function relevantSources() {
  const sourcePaths = await relevantSourcePaths();
  return Promise.all(
    sourcePaths.map(async (path) => ({ path, source: await readFile(path, "utf8") })),
  );
}

const generatedImagePaths = [
  "hero-atmosphere.png",
  "about-ops-portrait.png",
  "og-default.png",
  "/images/industries/",
];

const generatedImageArtifacts = [
  "public/images/hero-atmosphere.png",
  "public/images/about-ops-portrait.png",
  "public/images/og-default.png",
  "public/images/industries/contractors-home-services.png",
  "public/images/industries/manufacturing-fabrication.png",
  "public/images/industries/sign-print-wrap-cnc-shops.png",
  "public/images/industries/wineries-events-hospitality.png",
  "public/images/industries/professional-offices.png",
  "public/images/industries/local-service-businesses.png",
];

describe("released photography references", () => {
  it("does not leave generated PNGs anywhere in app source", async () => {
    const sources = await relevantSources();

    for (const { source } of sources) {
      for (const generatedPath of generatedImagePaths) {
        expect(source).not.toContain(generatedPath);
      }
    }
  });

  it("allows next/image and local photography only through the trusted manifest frame", async () => {
    const sources = await relevantSources();
    const runtimeSources = sources.filter(({ path }) => !path.endsWith(".server.ts"));
    const nextImageImports = sources
      .filter(({ source }) => /from\s+["']next\/image["']/.test(source))
      .map(({ path }) => path);
    const directLocalPhotography = sources
      .filter(({ source }) => /(?:src|href)\s*=\s*(?:\{\s*)?["']\/(?:photography|images)\//.test(source))
      .map(({ path }) => path);

    expect(nextImageImports).toEqual([trustedImageComponent]);
    expect(directLocalPhotography).toEqual([]);

    const trustedSource = sources.find(({ path }) => path === trustedImageComponent)?.source;
    expect(trustedSource).toContain("isReleasedImage");
    expect(trustedSource).toContain("src={releasedImage.src}");

    for (const { source } of runtimeSources) {
      expect(source).not.toContain("node:fs");
      expect(source).not.toContain("@/lib/images.server");
    }

    const layout = sources.find(({ path }) => path === "app/layout.tsx")?.source;
    expect(layout).toContain("isReleasedImage(SITE_IMAGES.og)");
    expect(layout).toContain("releasedSocialImage ?");
    expect(layout).not.toContain("og-default.png");
  });

  it("does not deploy retired generated photography artifacts", () => {
    for (const artifact of generatedImageArtifacts) {
      expect(existsSync(artifact)).toBe(false);
    }
  });
});
