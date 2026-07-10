import type { OfferTier } from "@/lib/types";

/** Public pricing — full market rates (default on site). Founding 50% is a separate scarce offer. */

export type PriceRange = {
  label: string;
  min: number;
  max: number;
  /** Display string, e.g. "$750–$1,500" or "$250–$900/mo" */
  display: string;
  monthly?: boolean;
};

export type PricingRow = {
  name: string;
  range: PriceRange;
  bestFor: string;
  bestFitVerticals?: string[];
};

export type ServiceSlug =
  | "lead-intake-quote-systems"
  | "job-tracking-dashboards"
  | "file-upload-proof-approval"
  | "customer-portals"
  | "mobile-apps-for-local-businesses"
  | "workflow-automation"
  | "custom-business-software";

// ── Intro & positioning ──────────────────────────────────────────────

export const pricingIntro = {
  headline: "Pricing for custom business systems",
  subhead:
    "Ranges so you can budget before the first call. Paid discovery, fixed-scope quotes, optional monthly support — never hourly on the site.",
} as const;

export const positioning = {
  systemsNotWebsites:
    "I do not build generic brochure websites. I build business systems that connect your website, customers, team, files, quotes, and operations — and can bridge to tools you already use when it makes sense.",
  leanCustomSoftware:
    "Lean custom software for local businesses — smaller than an agency build, more custom than off-the-shelf software.",
  integrationsBridge:
    "When it makes sense, systems can bridge to tools you already use — Jobber, QuickBooks, email/SMS, and other APIs — instead of forcing a rip-and-replace.",
  categoryWedge:
    "Business systems: intake, quoting, job boards, proof portals, and field tools — not websites or marketing.",
  focusedSystemsSummary: "$4,500–$9,500",
  auditsStartAt: "$750",
  prototypesSummary: "$2,500–$5,000",
} as const;

// ── Priority verticals ───────────────────────────────────────────────

export const priorityVerticals = [
  "Manufacturing / fab / CNC",
  "Sign / print / wrap",
  "Contractors / home services",
  "Professional offices (intake/portals)",
  "Wineries / hospitality (ops only, not marketing)",
] as const;

/** Priority A industry slugs — soft emphasis on industry pages (no sitemap change). */
export const priorityAIndustrySlugs = [
  "manufacturing-fabrication",
  "sign-print-wrap-cnc-shops",
  "contractors-home-services",
] as const;

const priorityAIndustryLine =
  "A focus vertical for custom business systems — intake, job tracking, and shop workflows — not brochure websites. Focused first builds often land in the $4,500–$9,500 range.";

export function getPriorityAIndustryLine(slug: string): string | undefined {
  if (
    (priorityAIndustrySlugs as readonly string[]).includes(slug)
  ) {
    return priorityAIndustryLine;
  }
  return undefined;
}

// ── Starting points (pricing page summary) ───────────────────────────

export const startingPoints: PricingRow[] = [
  {
    name: "Workflow Audit",
    range: {
      label: "Workflow Audit",
      min: 750,
      max: 1500,
      display: "$750–$1,500",
    },
    bestFor: "Process is messy; need a plan",
    bestFitVerticals: ["All"],
  },
  {
    name: "Prototype Sprint",
    range: {
      label: "Prototype Sprint",
      min: 2500,
      max: 5000,
      display: "$2,500–$5,000",
    },
    bestFor: "Want to see a concept before full build",
    bestFitVerticals: ["Contractors", "Sign/print", "Offices"],
  },
  {
    name: "Focused System Build",
    range: {
      label: "Focused System Build",
      min: 4500,
      max: 9500,
      display: "$4,500–$9,500",
    },
    bestFor: "One workflow: intake, quotes, files, dashboard, proofing",
    bestFitVerticals: ["Contractors", "Manufacturing", "Sign/print", "Offices"],
  },
  {
    name: "Mobile / multi-step",
    range: {
      label: "Mobile / multi-step",
      min: 6500,
      max: 12000,
      display: "$6,500–$12,000",
    },
    bestFor: "Field tools or multi-role workflows",
    bestFitVerticals: ["Contractors", "Field teams"],
  },
];

// ── Offer ladder (four public buckets + monthly) ─────────────────────

export const offerLadder: PricingRow[] = [
  {
    name: "Workflow Audit",
    range: {
      label: "Workflow Audit",
      min: 750,
      max: 1500,
      display: "$750–$1,500",
    },
    bestFor: "Finding bottlenecks and a clear build plan",
    bestFitVerticals: ["All"],
  },
  {
    name: "Prototype Sprint",
    range: {
      label: "Prototype Sprint",
      min: 2500,
      max: 5000,
      display: "$2,500–$5,000",
    },
    bestFor: "Seeing a working concept before full investment",
    bestFitVerticals: ["Contractors", "Sign/print", "Offices"],
  },
  {
    name: "Focused System Build",
    range: {
      label: "Focused System Build",
      min: 4500,
      max: 9500,
      display: "$4,500–$9,500",
    },
    bestFor: "One focused workflow: intake, quotes, files, dashboard, or proofing",
    bestFitVerticals: ["Contractors", "Manufacturing", "Sign/print", "Offices"],
  },
  {
    name: "Monthly Systems Support",
    range: {
      label: "Monthly Systems Support",
      min: 250,
      max: 900,
      display: "$250–$900/mo",
      monthly: true,
    },
    bestFor: "Ongoing improvements and support for existing clients",
    bestFitVerticals: ["Existing clients"],
  },
];

/** Homepage / shared offer cards — mirrors the four public buckets. */
export const publicOfferTiers: OfferTier[] = offerLadder.map((row) => ({
  name: row.name,
  price: row.range.display,
  bestFor: row.bestFor,
}));

// ── Service ranges (full public rates) ───────────────────────────────

export const serviceRanges: PricingRow[] = [
  {
    name: "Workflow Audit",
    range: {
      label: "Workflow Audit",
      min: 750,
      max: 1500,
      display: "$750–$1,500",
    },
    bestFor: "Process clarity and a build estimate",
    bestFitVerticals: ["All"],
  },
  {
    name: "Prototype Sprint",
    range: {
      label: "Prototype Sprint",
      min: 2500,
      max: 5000,
      display: "$2,500–$5,000",
    },
    bestFor: "Validate approach before full build",
    bestFitVerticals: ["Contractors", "Sign/print", "Offices"],
  },
  {
    name: "Custom intake / quote system",
    range: {
      label: "Custom intake / quote system",
      min: 4500,
      max: 8500,
      display: "$4,500–$8,500",
    },
    bestFor: "Structured lead and quote capture",
    bestFitVerticals: ["Contractors", "Manufacturing", "Offices"],
  },
  {
    name: "Job-tracking dashboard or proof portal",
    range: {
      label: "Job-tracking dashboard or proof portal",
      min: 5500,
      max: 9500,
      display: "$5,500–$9,500",
    },
    bestFor: "Visibility across office, crew, and customers",
    bestFitVerticals: ["Manufacturing", "Sign/print", "Contractors"],
  },
  {
    name: "Mobile field app lite",
    range: {
      label: "Mobile field app lite",
      min: 6500,
      max: 12000,
      display: "$6,500–$12,000",
    },
    bestFor: "Field checklists, status, and admin dashboard",
    bestFitVerticals: ["Contractors", "Field teams"],
  },
  {
    name: "Monthly systems support",
    range: {
      label: "Monthly systems support",
      min: 250,
      max: 900,
      display: "$250–$900/mo",
      monthly: true,
    },
    bestFor: "Ongoing improvements after launch",
    bestFitVerticals: ["Existing clients"],
  },
];

const serviceSlugRangeMap: Record<ServiceSlug, PriceRange> = {
  "lead-intake-quote-systems": {
    label: "Custom intake / quote system",
    min: 4500,
    max: 8500,
    display: "$4,500–$8,500",
  },
  "job-tracking-dashboards": {
    label: "Job-tracking dashboard",
    min: 5500,
    max: 9500,
    display: "$5,500–$9,500",
  },
  "file-upload-proof-approval": {
    label: "File upload / proof portal",
    min: 5500,
    max: 9500,
    display: "$5,500–$9,500",
  },
  "customer-portals": {
    label: "Customer portal",
    min: 5500,
    max: 9500,
    display: "$5,500–$9,500",
  },
  "mobile-apps-for-local-businesses": {
    label: "Mobile field app lite",
    min: 6500,
    max: 12000,
    display: "$6,500–$12,000",
  },
  "workflow-automation": {
    label: "Focused system / automation",
    min: 4500,
    max: 9500,
    display: "$4,500–$9,500",
  },
  "custom-business-software": {
    label: "Focused custom system",
    min: 4500,
    max: 9500,
    display: "$4,500–$9,500",
  },
};

export function getTypicalRangeByServiceSlug(
  slug: string,
): PriceRange | undefined {
  if (slug in serviceSlugRangeMap) {
    return serviceSlugRangeMap[slug as ServiceSlug];
  }
  return undefined;
}

// ── Example budgets ──────────────────────────────────────────────────

export const exampleBudgets: { example: string; typicalBudget: string }[] = [
  {
    example: "Contractor quote request + lead dashboard",
    typicalBudget: "$4,500–$8,500",
  },
  {
    example: "Service lead intake + follow-up automation",
    typicalBudget: "$4,500–$8,500",
  },
  {
    example: "Job tracker for office / owner / crew",
    typicalBudget: "$5,500–$9,500",
  },
  {
    example: "Sign/print/CNC file upload portal",
    typicalBudget: "$5,500–$9,500",
  },
  {
    example: "Proof approval with customer notifications",
    typicalBudget: "$5,500–$9,500",
  },
  {
    example: "Mobile field checklist + admin dashboard",
    typicalBudget: "$6,500–$12,000",
  },
];

// ── Founding-client 50% (scarce — not sitewide pricing) ──────────────

export const foundingOfferRows: {
  name: string;
  publicDisplay: string;
  foundingDisplay: string;
}[] = [
  {
    name: "Workflow Audit",
    publicDisplay: "$750–$1,500",
    foundingDisplay: "$375–$750",
  },
  {
    name: "Prototype Sprint",
    publicDisplay: "$2,500–$5,000",
    foundingDisplay: "$1,250–$2,500",
  },
  {
    name: "Intake / quote",
    publicDisplay: "$4,500–$8,500",
    foundingDisplay: "$2,250–$4,250",
  },
  {
    name: "Job-tracking / proof portal",
    publicDisplay: "$5,500–$9,500",
    foundingDisplay: "$2,750–$4,750",
  },
  {
    name: "Field / mobile lite",
    publicDisplay: "$6,500–$12,000",
    foundingDisplay: "$3,250–$6,000",
  },
  {
    name: "Monthly support",
    publicDisplay: "$250–$900/mo",
    foundingDisplay: "$200–$700/mo",
  },
];

export const foundingRules = {
  maxClients: "2–3 local clients total",
  expires: "Expires after 90 days or when slots fill",
  discountScope:
    "Discount on core project fee only (not third-party costs or major change orders)",
  paymentTerms: "50% / 25% / 25%",
  caseStudyRequirements:
    "Testimonial, logo use, brief case study, and measurable-results permission required",
  feedbackSla: "Client must give feedback within 2 business days",
  verticalPreference: "Prefer one client per Priority A vertical",
  scarcityNote:
    "This is a limited founding offer — not permanent public pricing. The site shows full rates by default.",
} as const;

export const foundingOfferCopy = {
  headline: "Founding client offer — 50% off core project fee",
  body: "A short window for 2–3 local operators who will help prove the model with a case study. Full public rates remain the default everywhere else on the site.",
} as const;

// ── What affects price / not included / quoting ──────────────────────

export const whatAffectsPrice = [
  "Number of user roles and permissions",
  "Customer-facing access (portals, notifications, approvals)",
  "File uploads, storage, and proofing workflows",
  "Integrations with existing tools (Jobber, QuickBooks, email/SMS, etc.)",
  "Mobile / field requirements vs. web-only",
  "Data migration and complexity of current process",
  "Reporting and automation depth",
] as const;

export const notIncluded = [
  "Third-party software licenses and subscription fees",
  "Major scope changes after a fixed quote is agreed",
  "Ongoing marketing, SEO, or brochure website redesign",
  "Hardware, printers, or on-premise server equipment",
  "Unlimited revisions outside the agreed scope",
] as const;

export const quotingSteps = [
  {
    step: "1. Fit Check",
    description:
      "Free 15–20 minute call to confirm the problem is a systems fit — not a website or marketing project.",
  },
  {
    step: "2. Workflow Audit or discovery",
    description:
      "Paid discovery maps the current process, bottlenecks, and a recommended build path with a range.",
  },
  {
    step: "3. Fixed-scope quote",
    description:
      "Clear deliverables, timeline, and price for the agreed scope — no hourly surprise on the site.",
  },
  {
    step: "4. Build and launch",
    description:
      "Iterative delivery with working demos, training, and handoff documentation.",
  },
  {
    step: "5. Optional monthly support",
    description:
      "Ongoing improvements and support at $250–$900/mo for existing clients.",
  },
] as const;

export const fitCheck = {
  label: "Fit Check",
  duration: "15–20 minutes",
  price: "Free",
  description:
    "A short call to confirm whether a custom business system is the right next step — and which starting point (audit, prototype, or focused build) fits your budget and urgency.",
  ctaLabel: "Book a Fit Check",
  ctaHref: "/contact",
} as const;

export const valueFraming = {
  headline: "Why ranges, not hourly",
  body: "You budget against a clear band before development starts. Discovery produces a fixed-scope quote. That keeps local operators from buying open-ended hours — and keeps builds focused on one workflow that pays for itself.",
} as const;

export const ownership = {
  headline: "You own what we build",
  body: "Custom systems are built for your business. You own the product of the engagement; third-party services and licenses remain theirs. Documentation and handoff are part of launch so your team can run day-to-day without mystery.",
} as const;
