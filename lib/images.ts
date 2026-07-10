export type SiteImageAspect = "hero" | "industry" | "about" | "og";

export type SiteImageReleaseStatus = "awaiting-approval" | "released";

export type SiteImage = {
  id: string;
  src: string | null;
  alt: string;
  caption: string;
  objectPosition: string;
  source: string | null;
  license: string | null;
  releaseStatus: SiteImageReleaseStatus;
  aspect: SiteImageAspect;
};

export type IndustryImageSlug =
  | "contractors-home-services"
  | "manufacturing-fabrication"
  | "sign-print-wrap-cnc-shops"
  | "wineries-events-hospitality"
  | "professional-offices"
  | "local-service-businesses";

const awaitingApproval = (
  image: Omit<SiteImage, "src" | "source" | "license" | "releaseStatus">,
): SiteImage => ({
  ...image,
  src: null,
  source: null,
  license: null,
  releaseStatus: "awaiting-approval",
});

/**
 * Photography is deliberately absent until the owner supplies an approved,
 * rights-cleared source file. See docs/photography-manifest.md for delivery requirements.
 */
export const SITE_IMAGES = {
  hero: awaitingApproval({
    id: "hero",
    alt: "",
    caption: "",
    objectPosition: "50% 50%",
    aspect: "hero",
  }),
  founder: awaitingApproval({
    id: "founder",
    alt: "Founder of Grogan Development Group in a Tri-Cities operations workspace.",
    caption: "Founder portrait",
    objectPosition: "50% 38%",
    aspect: "about",
  }),
  industries: {
    "contractors-home-services": awaitingApproval({
      id: "industry-contractors-home-services",
      alt: "",
      caption: "Job site",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
    "manufacturing-fabrication": awaitingApproval({
      id: "industry-manufacturing-fabrication",
      alt: "",
      caption: "Shop floor",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
    "sign-print-wrap-cnc-shops": awaitingApproval({
      id: "industry-sign-print-wrap-cnc-shops",
      alt: "",
      caption: "Wrap bay",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
    "wineries-events-hospitality": awaitingApproval({
      id: "industry-wineries-events-hospitality",
      alt: "",
      caption: "Vineyard",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
    "professional-offices": awaitingApproval({
      id: "industry-professional-offices",
      alt: "",
      caption: "Office desk",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
    "local-service-businesses": awaitingApproval({
      id: "industry-local-service-businesses",
      alt: "",
      caption: "Service van",
      objectPosition: "50% 50%",
      aspect: "industry",
    }),
  } satisfies Record<IndustryImageSlug, SiteImage>,
  og: awaitingApproval({
    id: "og",
    alt: "",
    caption: "",
    objectPosition: "50% 50%",
    aspect: "og",
  }),
} satisfies {
  hero: SiteImage;
  founder: SiteImage;
  industries: Record<IndustryImageSlug, SiteImage>;
  og: SiteImage;
};

function isIndustryImageSlug(slug: string): slug is IndustryImageSlug {
  return slug in SITE_IMAGES.industries;
}

export function getIndustryImage(slug: string): SiteImage {
  if (!isIndustryImageSlug(slug)) {
    throw new Error(`No photography manifest record for industry: ${slug}`);
  }

  return SITE_IMAGES.industries[slug];
}

export function isReleasedImage(
  image: SiteImage,
): image is SiteImage & { src: string; source: string; license: string } {
  return (
    image.releaseStatus === "released" &&
    Boolean(image.src) &&
    Boolean(image.source) &&
    Boolean(image.license)
  );
}
