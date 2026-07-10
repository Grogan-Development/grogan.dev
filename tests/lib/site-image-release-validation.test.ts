import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const fixtureDirectory = path.join(process.cwd(), "public/photography/test-fixtures");
const neutralFixtureSrc = "/photography/test-fixtures/neutral.jpg";
const oversizedFixtureSrc = "/photography/test-fixtures/oversized.jpg";

beforeAll(async () => {
  await mkdir(fixtureDirectory, { recursive: true });
  await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .jpeg()
    .toFile(path.join(fixtureDirectory, "neutral.jpg"));
  await sharp(randomBytes(1200 * 630 * 3), { raw: { width: 1200, height: 630, channels: 3 } })
    .jpeg({ quality: 100 })
    .toFile(path.join(fixtureDirectory, "oversized.jpg"));
});

afterAll(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

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
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.hero, neutralFixtureSrc)])).resolves.toBeUndefined();
  });

  it("rejects released media outside the photography path or supported derivative types", async () => {
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.hero, "/file.svg")])).rejects.toThrow(
      "under /photography/ with a .webp, .jpg, or .jpeg extension",
    );
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.hero, "/images/neutral.jpg")])).rejects.toThrow(
      "under /photography/ with a .webp, .jpg, or .jpeg extension",
    );
  });

  it("rejects a released OG source that is not the documented dimensions", async () => {
    await expect(validateReleasedSiteImages([released(SITE_IMAGES.og, neutralFixtureSrc)])).rejects.toThrow(
      "1200 × 630",
    );
  });

  it("rejects a released OG source that exceeds the documented size limit", async () => {
    await expect(
      validateReleasedSiteImages(
        [
          released(
            SITE_IMAGES.og,
            oversizedFixtureSrc,
          ),
        ],
      ),
    ).rejects.toThrow("no larger than 300 KB");
  });
});
