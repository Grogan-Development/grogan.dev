import { describe, expect, it } from "vitest";
import * as imageReleaseValidation from "@/lib/images.server";
import { validateReleasedSiteImages } from "@/lib/images.server";
import { SITE_IMAGES, type SiteImage } from "@/lib/images";

function released(image: SiteImage, src: string): SiteImage {
  return {
    ...image,
    src,
    source: "Grogan Development Group",
    license: "Owner release on file",
    releaseStatus: "released",
  };
}

describe("server-side site image release validation", () => {
  it("provides a validation entry point for the complete manifest", async () => {
    expect(imageReleaseValidation).toHaveProperty("validateSiteImageManifestRelease");
    await expect(imageReleaseValidation.validateSiteImageManifestRelease()).resolves.toBeUndefined();
  });

  it("rejects a released source path that is missing from public", async () => {
    await expect(
      validateReleasedSiteImages([released(SITE_IMAGES.hero, "/photography/missing.jpg")]),
    ).rejects.toThrow("public/photography/missing.jpg");
  });

  it("accepts a released non-customer fixture that exists under public", async () => {
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.hero, "/file.svg")])).resolves.toBeUndefined();
  });

  it("rejects a released OG source that is not the documented dimensions", async () => {
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.og, "/file.svg")])).rejects.toThrow(
      "1200 × 630",
    );
  });

  it("rejects a released OG source that exceeds the documented size limit", async () => {
    await expect(
      validateReleasedSiteImages(
        [
          released(
            SITE_IMAGES.og,
            "/next/dist/compiled/next-server/app-page-experimental.runtime.prod.js",
          ),
        ],
        {
          publicDirectory: `${process.cwd()}/node_modules`,
          inspectOgDimensions: async () => ({ width: 1200, height: 630 }),
        },
      ),
    ).rejects.toThrow("no larger than 300 KB");
  });
});
