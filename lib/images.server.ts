import { stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SITE_IMAGES, type SiteImage } from "@/lib/images";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_MAX_BYTES = 300 * 1024;
const PHOTOGRAPHY_DERIVATIVE_PATH = /^\/photography\/.+\.(?:webp|jpe?g)$/i;

type OgImageDimensions = {
  width?: number;
  height?: number;
};

type ReleaseValidationOptions = {
  publicDirectory?: string;
  inspectOgDimensions?: (filePath: string) => Promise<OgImageDimensions>;
};

async function inspectOgDimensions(filePath: string): Promise<OgImageDimensions> {
  const metadata = await sharp(filePath).metadata();
  return { width: metadata.width, height: metadata.height };
}

function publicFilePath(publicDirectory: string, src: string): string | null {
  if (!src.startsWith("/")) return null;

  const filePath = path.resolve(publicDirectory, `.${src}`);
  const relativePath = path.relative(publicDirectory, filePath);
  return relativePath.startsWith("..") || path.isAbsolute(relativePath) ? null : filePath;
}

/**
 * Server/test-only release check. Keep Node file access out of client modules.
 */
export async function validateReleasedSiteImages(
  images: readonly SiteImage[],
  {
    publicDirectory = path.join(process.cwd(), "public"),
    inspectOgDimensions: inspectDimensions = inspectOgDimensions,
  }: ReleaseValidationOptions = {},
): Promise<void> {
  const resolvedPublicDirectory = path.resolve(publicDirectory);
  const failures: string[] = [];

  for (const image of images) {
    if (image.releaseStatus !== "released") continue;

    if (!image.src || !image.source || !image.license) {
      failures.push(`${image.id}: released entries require src, source, and license metadata`);
      continue;
    }

    if (!PHOTOGRAPHY_DERIVATIVE_PATH.test(image.src)) {
      failures.push(
        `${image.id}: released source must be under /photography/ with a .webp, .jpg, or .jpeg extension`,
      );
      continue;
    }

    const filePath = publicFilePath(resolvedPublicDirectory, image.src);
    if (!filePath) {
      failures.push(`${image.id}: released source must resolve under public${image.src}`);
      continue;
    }

    let fileSize: number;
    try {
      const file = await stat(filePath);
      if (!file.isFile()) {
        failures.push(`${image.id}: released source is not a file at public${image.src}`);
        continue;
      }
      fileSize = file.size;
    } catch {
      failures.push(`${image.id}: released source missing at public${image.src}`);
      continue;
    }

    if (image.id !== "og") continue;

    if (fileSize > OG_MAX_BYTES) {
      failures.push(`${image.id}: released OG source must be no larger than 300 KB`);
    }

    try {
      const dimensions = await inspectDimensions(filePath);
      if (dimensions.width !== OG_WIDTH || dimensions.height !== OG_HEIGHT) {
        failures.push(`${image.id}: released OG source must be exactly 1200 × 630`);
      }
    } catch {
      failures.push(`${image.id}: released OG source could not be inspected`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Site image release validation failed: ${failures.join("; ")}`);
  }
}

export async function validateSiteImageManifestRelease(): Promise<void> {
  return validateReleasedSiteImages([
    SITE_IMAGES.hero,
    SITE_IMAGES.founder,
    ...Object.values(SITE_IMAGES.industries),
    SITE_IMAGES.og,
  ]);
}
