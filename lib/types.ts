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

export type ExamplePage = {
  slug: string;
  title: string;
  description: string;
  flow: string[];
  proves: string;
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
