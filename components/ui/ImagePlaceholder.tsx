import Image from "next/image";
import type { ReactNode } from "react";
import { isReleasedImage, type SiteImage } from "@/lib/images";

export type ImagePlaceholderAspect = "hero" | "industry" | "about" | "demo" | "og";

const ASPECT_CLASS: Record<ImagePlaceholderAspect, string> = {
  /** Hero collage plane — dominant visual, fills the right column */
  hero: "aspect-[5/4] sm:aspect-[4/3] lg:aspect-[3/2]",
  /** Industry tile photography */
  industry: "aspect-[4/3]",
  /** About / founder ops photo */
  about: "aspect-[3/4]",
  /** Demo UI thumbnail */
  demo: "aspect-[16/10]",
  /** Open Graph / social share slot */
  og: "aspect-[1.91/1]",
};

type ImagePlaceholderProps = {
  aspect?: ImagePlaceholderAspect;
  label?: string;
  caption?: string;
  className?: string;
  children?: ReactNode;
  image?: SiteImage;
  sizes?: string;
  priority?: boolean;
  imageClassName?: string;
};

/**
 * Asset slot with locked aspect ratios for hero collage, industry tiles,
 * about photo, demo thumbs, and OG templates.
 * When given a manifest image, it renders photography only after source,
 * rights, and release checks pass. Children are available only once the
 * manifest image is released, so they cannot bypass an unreleased asset slot.
 */
export function ImagePlaceholder({
  aspect = "industry",
  label = "Image",
  caption,
  className = "",
  children,
  image,
  sizes = "100vw",
  priority = false,
  imageClassName = "",
}: ImagePlaceholderProps) {
  const releasedImage = image && isReleasedImage(image) ? image : null;
  const resolvedAspect = image?.aspect ?? aspect;
  const resolvedLabel = image && !releasedImage ? "Photography pending approval" : label;
  const resolvedCaption = image ? (releasedImage ? image.caption || caption : undefined) : caption;

  return (
    <figure className={`overflow-hidden border border-line bg-surface-alt ${className}`.trim()}>
      <div
        className={`relative flex w-full items-center justify-center ${ASPECT_CLASS[resolvedAspect]}`}
        data-aspect={resolvedAspect}
      >
        {image ? (
          <>
            {releasedImage ? (
              <Image
                src={releasedImage.src}
                alt={releasedImage.alt}
                fill
                priority={priority}
                sizes={sizes}
                className={`object-cover ${imageClassName}`.trim()}
                style={{ objectPosition: releasedImage.objectPosition }}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 px-4 text-center" data-image-status="awaiting-approval">
                <span className="font-mono text-[length:var(--text-label)] uppercase tracking-[0.12em] text-muted">
                  Asset slot
                </span>
                <span className="font-sans text-[length:var(--text-small)] text-ink/70">{resolvedLabel}</span>
              </div>
            )}
            {releasedImage ? children : null}
          </>
        ) : (
          children ?? (
          <div className="flex flex-col items-center gap-1 px-4 text-center">
            <span className="font-mono text-[length:var(--text-label)] uppercase tracking-[0.12em] text-muted">
              Asset slot
            </span>
            <span className="font-sans text-[length:var(--text-small)] text-ink/70">{resolvedLabel}</span>
          </div>
          )
        )}
      </div>
      {resolvedCaption ? (
        <figcaption className="border-t border-line px-3 py-2 font-mono text-[length:var(--text-label)] uppercase tracking-[0.08em] text-muted">
          {resolvedCaption}
        </figcaption>
      ) : null}
    </figure>
  );
}
