import type { ServicePage } from "@/lib/types";

export const services: ServicePage[] = [
  {
    slug: "custom-business-software",
    title: "Custom Business Software",
    headline: "Software built around how your business actually runs",
    description:
      "Grogan Development Group designs and builds custom web applications, internal tools, and operational platforms for local businesses that have outgrown spreadsheets and disconnected tools.",
    targets: ["Contractors", "Manufacturers", "Service businesses", "Production shops", "Professional offices"],
    coreMessage:
      "Off-the-shelf software rarely matches how your team works. Custom systems connect your website, customers, employees, and day-to-day operations into one workflow that is easier to manage and scale.",
    features: [
      "Custom web applications tailored to your workflow",
      "Internal operations tools for owners and staff",
      "Role-based dashboards and admin panels",
      "Integrations with email, SMS, and existing tools",
      "Scalable architecture for future features",
      "Training and documentation for your team",
    ],
    cta: "Discuss a custom system",
    relatedIndustries: ["contractors-home-services", "manufacturing-fabrication", "local-service-businesses"],
    relatedExamples: ["contractor-quote-job-tracker", "lead-follow-up-dashboard"],
  },
  {
    slug: "workflow-automation",
    title: "Workflow Automation",
    headline: "Stop doing the same manual steps every day",
    description:
      "Automate repetitive admin work — notifications, file routing, status updates, follow-up reminders, and handoffs between office, crew, and customer.",
    targets: ["Any operations-heavy business", "Production shops", "Contractors", "Service companies"],
    coreMessage:
      "If your team repeats the same steps for every lead, job, or file, those steps can usually be automated. The goal is fewer dropped balls and less time spent on admin.",
    features: [
      "Automated notifications and alerts",
      "Status change triggers",
      "File routing and folder organization",
      "Follow-up reminders",
      "Email and SMS automation",
      "Handoff workflows between roles",
    ],
    cta: "Map your automation opportunities",
    relatedIndustries: ["manufacturing-fabrication", "sign-print-wrap-cnc-shops"],
    relatedExamples: ["production-file-processing-automation", "lead-follow-up-dashboard"],
  },
  {
    slug: "lead-intake-quote-systems",
    title: "Lead Intake & Quote Systems",
    headline: "Stop letting leads disappear into calls, emails, texts, and messy contact forms",
    description:
      "Custom intake forms, quote request flows, file uploads, automatic notifications, lead dashboards, follow-up reminders, and estimate preparation for businesses that quote before they work.",
    targets: ["Contractors", "Home services", "Fabrication shops", "Sign shops", "Event businesses", "Professional offices"],
    coreMessage:
      "Leads come in through too many channels. A single intake system captures every request, collects the right details upfront, and makes follow-up impossible to forget.",
    features: [
      "Custom intake and quote request forms",
      "Photo and file uploads at submission",
      "Automatic notifications to the right person",
      "Lead dashboard with source tracking",
      "Follow-up reminders and next actions",
      "Estimate preparation and status tracking",
    ],
    cta: "Build a cleaner quote workflow",
    relatedIndustries: ["contractors-home-services", "sign-print-wrap-cnc-shops", "professional-offices"],
    relatedExamples: ["contractor-quote-job-tracker", "lead-follow-up-dashboard"],
  },
  {
    slug: "job-tracking-dashboards",
    title: "Job Tracking Dashboards",
    headline: "Know what jobs exist, who owns them, what stage they are in, and what is stuck",
    description:
      "Job status boards, assignments, due dates, notes, files, internal comments, customer status, and reporting for teams juggling multiple jobs at once.",
    targets: ["Production shops", "Service businesses", "Contractors", "Manufacturers"],
    coreMessage:
      "When job details live in texts, spreadsheets, and memory, things get lost. A job tracking dashboard gives everyone the same picture of what is in progress, what is waiting, and what is overdue.",
    features: [
      "Job status board with filters",
      "Assignments and due dates",
      "Notes and internal comments",
      "File attachments per job",
      "Customer-facing status updates",
      "Reporting and bottleneck visibility",
    ],
    cta: "See how job tracking could work",
    relatedIndustries: ["contractors-home-services", "manufacturing-fabrication"],
    relatedExamples: ["contractor-quote-job-tracker", "lead-follow-up-dashboard"],
  },
  {
    slug: "customer-portals",
    title: "Customer Portals",
    headline: "Give customers one clean place to submit details, files, approvals, and requests",
    description:
      "Login or magic-link portals where customers submit information, upload files, check job status, approve proofs, and request revisions — without email chaos.",
    targets: ["Companies where customers submit information repeatedly", "Production shops", "Service businesses"],
    coreMessage:
      "Customers should not have to dig through email threads to find where they left off. A portal gives them one place to interact with your business.",
    features: [
      "Login or magic link access",
      "File upload and form submission",
      "Job status visibility",
      "Approval and revision requests",
      "Customer history and reorder",
      "Branded experience matching your business",
    ],
    cta: "Plan a customer portal",
    relatedIndustries: ["sign-print-wrap-cnc-shops", "wineries-events-hospitality"],
    relatedExamples: ["production-file-upload-portal", "proof-approval-system"],
  },
  {
    slug: "file-upload-proof-approval",
    title: "File Upload & Proof Approval",
    headline: "Stop managing customer files and proof approvals through email chaos",
    description:
      "Upload portals, file checklists, production notes, proof preview, approve/request revision buttons, job handoff, and folder automation for production-heavy businesses.",
    targets: ["Sign shops", "Print shops", "Wrap shops", "CNC/laser/router shops", "Designers", "Agencies", "Manufacturers"],
    coreMessage:
      "This page leverages hands-on experience working with production-ready artwork, manufacturing workflows, proof approval, and file preparation inside production environments.",
    features: [
      "Customer file upload portal",
      "File checklist and validation",
      "Production notes and specs",
      "Proof preview and approval flow",
      "Revision request handling",
      "Automated folder organization and handoff",
    ],
    cta: "Fix your file and proof workflow",
    relatedIndustries: ["sign-print-wrap-cnc-shops", "manufacturing-fabrication"],
    relatedExamples: ["production-file-upload-portal", "proof-approval-system", "production-file-processing-automation"],
  },
  {
    slug: "mobile-apps-for-local-businesses",
    title: "Mobile Apps for Local Businesses",
    headline: "Mobile apps for crews, field teams, inspectors, production staff, and owners who need business tools outside the office",
    description:
      "Operational mobile apps — not consumer app ideas. Field checklists, job photos, crew tasks, delivery checklists, inspection forms, quote walkthroughs, and inventory-lite tools.",
    targets: ["Contractors", "Field service companies", "Production crews", "Inspectors", "Delivery teams"],
    coreMessage:
      "This is not about building apps for anyone with an idea. It is about giving your team practical tools they can use on a job site, in a shop, or on the road.",
    features: [
      "Field checklist apps",
      "Job photo capture and upload",
      "Crew task assignment",
      "Delivery and inspection forms",
      "Quote walkthrough tools",
      "iOS, Android, and web from one codebase",
    ],
    cta: "Explore mobile options for your team",
    relatedIndustries: ["contractors-home-services", "local-service-businesses"],
    relatedExamples: ["mobile-field-checklist-app"],
  },
  {
    slug: "ai-automation-for-small-business",
    title: "AI Automation for Small Business",
    headline: "AI that turns messy requests into usable job details",
    description:
      "Job request summarization, intake parsing, follow-up drafts, and document extraction — tools that cut reading and sorting so your team can quote and follow up faster.",
    targets: ["Any business drowning in unstructured requests", "Service companies", "Production shops"],
    coreMessage:
      "Paste a long customer message and get clear scope, materials, and next steps. We build AI into the workflow you already run — review, quote, assign — not a separate chatbot layer.",
    features: [
      "Job request summarization",
      "Intake form parsing and categorization",
      "Follow-up email drafting",
      "Document and spec extraction",
      "Workflow bottleneck suggestions",
      "Review step before anything goes out",
    ],
    cta: "See where AI fits your workflow",
    relatedIndustries: ["professional-offices", "local-service-businesses"],
    relatedExamples: ["ai-job-request-summarizer"],
  },
];

export function getService(slug: string): ServicePage | undefined {
  return services.find((s) => s.slug === slug);
}

export function getAllServiceSlugs(): string[] {
  return services.map((s) => s.slug);
}
