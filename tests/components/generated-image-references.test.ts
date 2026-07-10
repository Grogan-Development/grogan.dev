import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const imageConsumers = [
  "components/home/HomePage.tsx",
  "app/industries/page.tsx",
  "components/pages/IndustryPageTemplate.tsx",
  "app/about/page.tsx",
  "app/layout.tsx",
  "lib/images.ts",
];

const sourceDirectories = ["app", "components", "lib", "content"];

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
    const sourcePaths = await relevantSourcePaths();
    const sources = await Promise.all(sourcePaths.map((path) => readFile(path, "utf8")));

    for (const source of sources) {
      for (const generatedPath of generatedImagePaths) {
        expect(source).not.toContain(generatedPath);
      }
    }
  });

  it("routes every photography slot through the release-aware frame", async () => {
    const photoConsumerPaths = imageConsumers.slice(0, 4);
    const sources = await Promise.all(photoConsumerPaths.map((path) => readFile(path, "utf8")));

    for (const source of sources) {
      expect(source).not.toContain('from "next/image"');
      expect(source).toContain("image={");
    }

    const layout = await readFile("app/layout.tsx", "utf8");
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
