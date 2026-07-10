import type { OfferTier } from "@/lib/types";
import { publicOfferTiers } from "@/content/pricing";

/** Mirrors the four public buckets from content/pricing.ts so homepage stays in sync. */
export const offerTiers: OfferTier[] = publicOfferTiers;

/** Short tile blurbs for home industry grid — keeps rhythm without truncating SEO copy. */
export const industryHomeBlurbs: Record<string, string> = {
  "contractors-home-services":
    "Quotes, job tracking, and follow-up when leads scatter across calls and texts.",
  "manufacturing-fabrication":
    "Job intake, file handoffs, and production visibility for shops.",
  "sign-print-wrap-cnc-shops":
    "Upload portals, proof approval, and production-ready handoff.",
  "wineries-events-hospitality":
    "Event inquiries, booking flows, and follow-up for visitor season.",
  "professional-offices":
    "Client intake, document collection, and admin task visibility.",
  "local-service-businesses":
    "Lead intake, job boards, and field tools instead of spreadsheets.",
};

export const painPoints = [
  "Leads come in through calls, texts, emails, Facebook, and forms.",
  "Quotes take too long to prepare.",
  "Job details get lost between office, customer, and crew.",
  "Customers send files, photos, and specs in random places.",
  "Nobody knows the exact status of every job.",
  "Follow-up depends on memory.",
  "Reports are manual.",
  "Your software does not match how your business actually works.",
];

export const systemsBuilt = [
  "Lead intake systems",
  "Quote request systems",
  "Job tracking dashboards",
  "Customer portals",
  "File upload portals",
  "Proof approval systems",
  "Mobile apps for crews or field teams",
  "Estimate calculators",
  "AI-assisted admin tools",
  "Reporting dashboards",
  "CRM-lite systems",
  "Internal operations tools",
];

export const whyGdgCopy =
  "My background spans graphic design, production operations, manufacturing-ready artwork, workflow optimization, and business ownership. After years of working inside operational businesses, I shifted toward building software that eliminates repetitive work, simplifies communication, and gives owners better visibility into their operations. Today, Grogan Development Group builds practical business software using modern web technologies, AI, mobile applications, and workflow automation — with a focus on Tri-Cities operators who need systems that match how their shops, crews, and offices actually run.";

export const differentiationPoints = [
  {
    title: "Demo showroom",
    body: "Interactive example systems you can click through — not slide decks or vague capability lists. See how intake, jobs, files, and follow-up work before you commit to a build.",
  },
  {
    title: "Transparent offer ladder",
    body: "Public ranges from Workflow Audit ($750–$1,500) through Prototype Sprint ($2,500–$5,000), Focused System Build ($4,500–$9,500), and Monthly Systems Support ($250–$900/mo). You know the path and the range before development starts.",
  },
  {
    title: "Production file and workflow depth",
    body: "Real experience with production-ready artwork, file handoffs, proof approval, and shop-floor friction — not generic “digital transformation” consulting.",
  },
];

export const companyCopy = {
  intro:
    "Grogan Development Group builds custom software, automation, and operational systems for businesses that need technology tailored to how they actually work.",
  encompasses: [
    "Custom software",
    "Mobile applications",
    "AI systems",
    "Workflow automation",
    "Internal business platforms",
    "SaaS products",
    "Consulting",
    "Future products and software ventures",
  ],
  positioning:
    "Grogan Development Group builds the custom software, automation, dashboards, portals, mobile applications, and AI-powered business systems that connect your website, customers, employees, and day-to-day operations into a workflow that is easier to manage and scale.",
  differentiation:
    "Local peers often pitch custom systems in broad strokes. GDG differentiates with a live demo showroom, a transparent offer ladder, and production file/workflow depth from years inside operational businesses — so Tri-Cities operators can evaluate proof, price path, and fit before a full build.",
};

export const processSteps = [
  {
    step: "1. Discovery",
    description: "Workflow audit or discovery call to map how leads, jobs, files, and follow-up move through your business.",
  },
  {
    step: "2. Design",
    description: "System design, feature list, wireframes, and build estimate. You see what will be built before development starts.",
  },
  {
    step: "3. Build",
    description: "Iterative development with working demos. Prototype sprint or full build depending on scope.",
  },
  {
    step: "4. Launch",
    description: "Deployment, training, documentation, and handoff. Your team knows how to use the system.",
  },
  {
    step: "5. Support",
    description: "Ongoing improvements, fixes, and new features through monthly systems support if needed.",
  },
];
