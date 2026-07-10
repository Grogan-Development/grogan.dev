export type NavItem = {
  label: string;
  href: string;
};

export type ServicePage = {
  slug: string;
  title: string;
  headline: string;
  description: string;
  targets: string[];
  coreMessage: string;
  features: string[];
  cta: string;
  relatedIndustries?: string[];
  relatedExamples?: string[];
};

export type IndustryPage = {
  slug: string;
  title: string;
  headline: string;
  description: string;
  painPoints: string[];
  systems: string[];
  seoTargets?: string[];
  relatedServices?: string[];
  relatedExamples?: string[];
};

export type ExamplePreviewKind =
  | "quote-job-pipeline"
  | "file-intake-preflight"
  | "proof-approval"
  | "lead-follow-up-dashboard"
  | "mobile-field-checklist"
  | "ai-request-extraction"
  | "file-processing-pipeline";

export type ExamplePage = {
  slug: string;
  title: string;
  description: string;
  flow: string[];
  proves: string;
  previewKind: ExamplePreviewKind;
};

export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  sections: { heading: string; body: string }[];
};

export type CityPage = {
  slug: string;
  name: string;
  headline: string;
  description: string;
  industries: string[];
  examples: string[];
};

export type OfferTier = {
  name: string;
  price: string;
  bestFor: string;
};
