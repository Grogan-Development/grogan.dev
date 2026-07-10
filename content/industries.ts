import type { IndustryPage } from "@/lib/types";

export const industries: IndustryPage[] = [
  {
    slug: "contractors-home-services",
    title: "Contractors & Home Services",
    headline: "Custom quote, job tracking, and follow-up systems for contractors and home-service businesses",
    description:
      "Systems for contractors and home service companies in the Tri-Cities who lose leads to missed calls, slow quotes, and scattered job details.",
    painPoints: [
      "Missed calls and slow callback",
      "Quotes take too long to prepare",
      "No photo upload at intake",
      "Weak follow-up on open leads",
      "Job details scattered across texts and notes",
      "No service dashboard for the owner",
    ],
    systems: [
      "Quote request form with photo upload",
      "Job tracker with status board",
      "Review request automation",
      "Field checklist app for crews",
      "Estimate calculator",
      "Customer follow-up reminders",
    ],
    seoTargets: [
      "contractor quote system Tri-Cities",
      "job tracking dashboard for contractors",
      "custom software for home service business",
      "lead intake system for contractors",
    ],
    relatedServices: ["lead-intake-quote-systems", "job-tracking-dashboards", "mobile-apps-for-local-businesses"],
    relatedExamples: ["contractor-quote-job-tracker", "mobile-field-checklist-app"],
  },
  {
    slug: "manufacturing-fabrication",
    title: "Manufacturing & Fabrication",
    headline: "Custom workflow tools for food/ag processing, fabrication, and production shops",
    description:
      "In the Tri-Cities, manufacturing employment leans heavily toward food and ag processing, with fabrication and specialty production shops alongside. Job intake, file management, production checklists, and visibility tools for shops where specs, files, and handoffs create daily friction.",
    painPoints: [
      "Messy job specs from customers",
      "Manual quoting and rework",
      "Poor handoff between sales and production",
      "File and version confusion",
      "Production bottlenecks with no visibility",
      "No single view of jobs in progress",
    ],
    systems: [
      "Job intake with spec capture",
      "File upload and validation",
      "Material calculator",
      "Production checklist",
      "Job dashboard and reporting",
      "Quote logic and internal tools",
    ],
    seoTargets: [
      "custom software for fabrication shops",
      "job tracking system for fabrication shops",
      "workflow automation manufacturing Tri-Cities",
      "food processing job tracking software",
    ],
    relatedServices: ["job-tracking-dashboards", "file-upload-proof-approval", "workflow-automation"],
    relatedExamples: ["production-file-upload-portal", "production-file-processing-automation"],
  },
  {
    slug: "sign-print-wrap-cnc-shops",
    title: "Sign, Print, Wrap & CNC Shops",
    headline: "File upload, proof approval, cutline, and job tracking systems for sign, print, wrap, and CNC shops",
    description:
      "Deep credibility in production file workflows — upload portals, proof approval, production-ready handoff, cutline automation, and rush job tracking for local production shops.",
    painPoints: [
      "Customer files arrive in random formats",
      "Proof approval stuck in email threads",
      "Production handoff details get lost",
      "Rush jobs buried in the queue",
      "Repeat customers re-send the same info",
      "Manual file prep eats production time",
    ],
    systems: [
      "Customer file upload portal",
      "Proof approval flow",
      "Production-ready handoff",
      "Cutline and file prep automation",
      "Vector and file checklist",
      "Rush job tracker and reorder portal",
    ],
    seoTargets: [
      "proof approval system for sign shops",
      "file upload portal for print shops",
      "custom software for sign shops Tri-Cities",
    ],
    relatedServices: ["file-upload-proof-approval", "workflow-automation", "job-tracking-dashboards"],
    relatedExamples: ["production-file-upload-portal", "proof-approval-system", "production-file-processing-automation"],
  },
  {
    slug: "wineries-events-hospitality",
    title: "Wineries, Events & Hospitality",
    headline: "Booking, event, follow-up, and customer systems for wineries, venues, and visitor-facing businesses",
    description:
      "Visitor spending in the Tri-Cities topped $643.4M in 2024, with 200+ wineries within an hour of town. Event inquiry forms, booking flows, tasting pages, review requests, and simple dashboards help hospitality operators keep up with wine, events, and seasonal visitor demand without drowning in email.",
    painPoints: [
      "Event inquiries lost in email",
      "No structured booking request flow",
      "Manual follow-up after events",
      "Customer lists scattered across tools",
      "No simple way to track inquiries vs bookings",
      "Seasonal demand overwhelms admin",
    ],
    systems: [
      "Event inquiry forms",
      "Booking request flows",
      "Tasting and event landing pages",
      "Review request automation",
      "Email follow-up sequences",
      "Simple customer and event dashboards",
    ],
    seoTargets: [
      "automation for wineries",
      "event booking system small business",
      "custom software hospitality Tri-Cities",
      "winery tasting room booking system",
    ],
    relatedServices: ["lead-intake-quote-systems", "customer-portals"],
    relatedExamples: ["lead-follow-up-dashboard"],
  },
  {
    slug: "professional-offices",
    title: "Professional Offices",
    headline: "Custom intake and admin workflow systems for local offices",
    description:
      "Client intake, document collection, task dashboards, reminders, and internal request forms for professional offices. Start with non-sensitive intake unless compliance is handled properly.",
    painPoints: [
      "Client intake scattered across email and paper",
      "Document collection is manual and slow",
      "Internal requests fall through cracks",
      "No visibility into open tasks",
      "Reminders depend on memory",
      "Reporting requires manual assembly",
    ],
    systems: [
      "Client intake forms",
      "Document collection portal",
      "Task dashboards",
      "Reminder automation",
      "Internal request forms",
      "Appointment request workflows",
    ],
    seoTargets: [
      "client intake system small business",
      "custom admin workflow software",
      "document collection portal",
    ],
    relatedServices: ["lead-intake-quote-systems", "customer-portals", "ai-automation-for-small-business"],
    relatedExamples: ["lead-follow-up-dashboard", "ai-job-request-summarizer"],
  },
  {
    slug: "local-service-businesses",
    title: "Local Service Businesses",
    headline: "Operational systems for local service companies tired of spreadsheets and texts",
    description:
      "Lead intake, job tracking, customer communication, and field tools for any local service business that runs on quotes, schedules, and follow-up.",
    painPoints: [
      "Leads from too many channels",
      "No central job view",
      "Crew and office out of sync",
      "Follow-up is inconsistent",
      "Customer communication is reactive",
      "Owner is the bottleneck for everything",
    ],
    systems: [
      "Lead intake and quote systems",
      "Job tracking dashboards",
      "Customer portals",
      "Mobile field tools",
      "Follow-up automation",
      "Owner reporting dashboard",
    ],
    seoTargets: [
      "custom software for small business Tri-Cities",
      "workflow automation local business",
      "lead intake system small business",
    ],
    relatedServices: ["custom-business-software", "lead-intake-quote-systems", "mobile-apps-for-local-businesses"],
    relatedExamples: ["contractor-quote-job-tracker", "lead-follow-up-dashboard", "mobile-field-checklist-app"],
  },
];

export function getIndustry(slug: string): IndustryPage | undefined {
  return industries.find((i) => i.slug === slug);
}

export function getAllIndustrySlugs(): string[] {
  return industries.map((i) => i.slug);
}
