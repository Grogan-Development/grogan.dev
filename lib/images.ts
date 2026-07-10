/**
 * Generated brand stills under public/images/.
 * Swap paths here (or replace files) when real photography is ready —
 * ImagePlaceholder slots stay the layout API.
 */
export const SITE_IMAGES = {
  hero: "/images/hero-atmosphere.png",
  about: "/images/about-ops-portrait.png",
  og: "/images/og-default.png",
} as const;

export function industryImageSrc(slug: string): `/images/industries/${string}.png` {
  return `/images/industries/${slug}.png`;
}
