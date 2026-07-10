export const SITE = {
  name: "Grogan Development Group LLC",
  shortName: "Grogan Development Group",
  mark: "GDG",
  domain: "grogan.dev",
  url: "https://grogan.dev",
  tagline: "Custom Software for Businesses That Have Outgrown Spreadsheets",
  region: "Tri-Cities and surrounding areas",
  email: "hello@grogan.dev",
  /** Set when a public phone number is ready for GBP/NAP */
  phone: undefined as string | undefined,
  address: {
    locality: "Tri-Cities",
    region: "WA",
    country: "US",
  },
  serviceLine:
    "Custom Business Software · Workflow Automation · Mobile Applications · AI Solutions",
} as const;

export const PRIMARY_CTA = {
  label: "Get a Workflow Audit",
  href: "/workflow-audit",
} as const;

export const SECONDARY_CTA = {
  label: "See Example Systems",
  href: "/examples",
} as const;

/** Full nav — desktop */
export const NAV_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Examples", href: "/examples" },
  { label: "Pricing", href: "/pricing" },
  { label: "Workflow Audit", href: "/workflow-audit" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

/** Reduced set for mobile drawer primary links */
export const MOBILE_NAV_LINKS = [
  { label: "Services", href: "/services" },
  { label: "Examples", href: "/examples" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
] as const;

export const BUDGET_RANGES = [
  "Under $1,000 — audit only",
  "$1,000–$3,000 — prototype / small sprint",
  "$3,000–$6,000 — focused system (lower band)",
  "$6,000–$10,000 — focused system / dashboard / portal",
  "$10,000–$15,000 — mobile or multi-step",
  "$15,000+ — larger / advanced",
  "Not sure yet",
] as const;

export const NEED_TYPES = [
  "Web application",
  "Mobile app",
  "Dashboard",
  "Automation",
  "Not sure yet",
] as const;
