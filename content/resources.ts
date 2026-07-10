import type { ResourceArticle } from "@/lib/types";

export const resources: ResourceArticle[] = [
  {
    slug: "how-to-stop-losing-leads-from-texts-and-emails",
    title: "How to Stop Losing Leads from Texts and Emails",
    description:
      "Leads that arrive through calls, texts, emails, and social messages need one intake path — not five inboxes nobody checks consistently.",
    sections: [
      {
        heading: "The problem",
        body: "Most small businesses lose leads not because demand is low, but because requests arrive in too many places. A text at 6pm, an email the next morning, a Facebook message on Saturday — each one is a separate thread with no shared status, no follow-up reminder, and no owner.",
      },
      {
        heading: "What a lead intake system does",
        body: "A proper intake system gives every lead one entry point: a form on your website, a link you text back to missed callers, or a QR code on your truck. The form captures name, contact, project details, photos, and how they found you. Every submission creates a record with a status and a next action.",
      },
      {
        heading: "Minimum features",
        body: "At minimum you need: a single submission form, automatic notification to the right person, a dashboard showing open leads, follow-up reminders, and source tracking so you know which channels actually convert.",
      },
      {
        heading: "When to build custom vs use a tool",
        body: "Off-the-shelf CRMs work for some businesses. Custom intake makes sense when your quote process needs photos, specs, file uploads, or steps that generic forms cannot handle. If your team quotes before they work, generic contact forms are usually not enough.",
      },
    ],
  },
  {
    slug: "quote-request-system-for-contractors",
    title: "Quote Request Systems for Contractors: What They Should Include",
    description:
      "Contractors need more than a contact form. Here is what a quote request system should capture before you ever pick up the phone.",
    sections: [
      {
        heading: "Why contact forms fail contractors",
        body: "A contact form asks for name, email, and message. A quote request needs address, scope, photos, timeline, budget range, and access details. Without that, every lead becomes a phone tag exercise.",
      },
      {
        heading: "Core fields",
        body: "Project type, location, description, photo upload, preferred contact method, timeline, and how they heard about you. Optional: square footage, material preferences, permit status.",
      },
      {
        heading: "After submission",
        body: "The owner gets notified immediately. The lead appears on a dashboard. A follow-up reminder fires if nobody responds within 24 hours. The customer gets a confirmation that their request was received.",
      },
      {
        heading: "Integration with job tracking",
        body: "The best systems connect intake directly to job tracking. When you accept a quote, it becomes a job with the same history — no re-entering details.",
      },
    ],
  },
  {
    slug: "job-tracking-software-for-small-business",
    title: "Job Tracking Dashboards for Small Businesses",
    description:
      "Spreadsheets work until they do not. Here is when a job tracking dashboard makes sense and what it should show.",
    sections: [
      {
        heading: "Signs you need job tracking software",
        body: "Jobs get lost between quote and completion. Nobody knows what is stuck. Due dates live in someone's head. Customers call asking for status and you have to dig through texts to answer.",
      },
      {
        heading: "What the dashboard should show",
        body: "Every active job, its stage, who owns it, due date, last update, and blockers. Filter by status, assignee, or customer. Click into a job for notes, files, and history.",
      },
      {
        heading: "Who uses it",
        body: "Owners see everything. Office staff update status and notes. Crew leads see their assigned jobs. Customers may see a simplified status view through a portal.",
      },
      {
        heading: "Build vs buy",
        body: "Generic project tools force your workflow into their structure. Custom job tracking matches how your shop or crew actually works — including stages, handoffs, and fields that matter to your business.",
      },
    ],
  },
  {
    slug: "file-upload-portal-for-sign-shops",
    title: "File Upload Portals for Sign and Print Shops",
    description:
      "Customer files should not arrive as email attachments with missing specs. A file upload portal structures intake before production starts.",
    sections: [
      {
        heading: "What goes wrong with email files",
        body: "Wrong format, missing bleed, no size confirmation, vague use case, multiple versions in one thread. Production staff spend time chasing details instead of producing.",
      },
      {
        heading: "Portal features",
        body: "Upload area with format guidance, material and size selection, use case checklist, production notes field, and automatic folder organization on your end.",
      },
      {
        heading: "Checklist automation",
        body: "Run validation on upload: resolution check, file type, color mode, missing fonts. Flag issues before the job hits the production queue.",
      },
      {
        heading: "Handoff to production",
        body: "Approved files and specs package automatically for the production team. No copying from email, no guessing what the customer wanted.",
      },
    ],
  },
  {
    slug: "proof-approval-system-for-print-shops",
    title: "Proof Approval Systems: Why Email Approval Gets Messy",
    description:
      "Email proof approval creates version confusion, lost approvals, and production delays. A dedicated approval flow fixes this.",
    sections: [
      {
        heading: "Email approval problems",
        body: "Which proof is approved? Did they approve the right version? Revision requests buried in reply chains. No timestamp on approval. Production starts on the wrong file.",
      },
      {
        heading: "What a proof approval system does",
        body: "Customer sees one proof at a time with clear approve and request-revision buttons. Each action is logged with timestamp. Production gets notified automatically. Job status updates without manual entry.",
      },
      {
        heading: "Revision workflow",
        body: "Customer requests changes with notes. Revised proof replaces the old one. Previous versions stay in history. No confusion about what is current.",
      },
      {
        heading: "Production experience",
        body: "Years spent solving operational workflow problems inside production businesses means these systems are designed around real shop constraints — not generic approval widgets.",
      },
    ],
  },
  {
    slug: "custom-software-vs-saas-for-small-business",
    title: "When a Small Business Should Build Custom Software Instead of Buying Another SaaS",
    description:
      "Another subscription is not always the answer. Here is when custom software makes more sense than forcing your workflow into someone else's product.",
    sections: [
      {
        heading: "SaaS works when",
        body: "Your workflow matches the product's assumptions. You need standard features. Integration is good enough. The monthly cost is less than building.",
      },
      {
        heading: "Custom makes sense when",
        body: "You quote before you work and need custom intake. Your job stages do not match any template. You need file workflows, proof approval, or production handoff. You are paying for three tools that do not talk to each other.",
      },
      {
        heading: "The real cost of mismatch",
        body: "Staff work around bad software with spreadsheets and texts. That hidden labor costs more than a focused custom build over 12–24 months.",
      },
      {
        heading: "Start small",
        body: "A workflow audit or prototype sprint lets you test whether custom is worth it before committing to a full build. Many businesses start with one system — intake or job tracking — and expand from there.",
      },
    ],
  },
  {
    slug: "mobile-apps-for-field-crews",
    title: "Mobile Apps for Field Crews: When They Make Sense",
    description:
      "Not every business needs a mobile app. Here is when field crew apps actually reduce friction instead of adding it.",
    sections: [
      {
        heading: "When mobile apps help",
        body: "Crews work off-site and need checklists, photos, and job notes. Paper forms get lost. Office staff re-enter field data manually. Owners want real-time job status from the field.",
      },
      {
        heading: "What to build first",
        body: "Start with one workflow: job checklist, photo upload, or inspection form. Do not build a full ERP for crews on day one.",
      },
      {
        heading: "One codebase, multiple platforms",
        body: "Modern frameworks like Expo let you ship iOS, Android, and web from one codebase. Your crew uses phones; your office uses a dashboard. Same data.",
      },
      {
        heading: "Operational, not consumer",
        body: "These are business tools for your team — not apps for the App Store aimed at random consumers. That distinction keeps scope realistic and ROI clear.",
      },
    ],
  },
  {
    slug: "how-much-does-custom-business-software-cost",
    title: "How Much Does Custom Business Software Cost for a Small Business?",
    description:
      "Honest ranges for workflow audits, prototypes, and full builds — so you can budget before the first call.",
    sections: [
      {
        heading: "Workflow audit",
        body: "$750–$1,500. Maps your current workflow, identifies bottlenecks, recommends what to build, and gives a build estimate. Audits start at $750. Credited toward the project if you move forward.",
      },
      {
        heading: "Prototype sprint",
        body: "$2,500–$5,000. Working version of one core flow — enough to see if the approach works before full investment.",
      },
      {
        heading: "Focused custom system",
        body: "$4,500–$9,500 for most focused first systems. Typical bands: intake / quote $4,500–$8,500; job-tracking dashboard or proof portal $5,500–$9,500. Scoped to solve one major workflow problem.",
      },
      {
        heading: "Mobile / multi-step and monthly support",
        body: "$6,500–$12,000 for mobile field app lite or multi-role workflows. Monthly systems support at $250–$900/mo for ongoing improvements with existing clients.",
      },
      {
        heading: "How to think about ROI",
        body: "If a system saves 5 hours a week of admin at $40/hour, that is $10,400/year. A focused build in the $4,500–$9,500 band can pay for itself in under a year. The audit helps you quantify this for your specific business.",
      },
    ],
  },
];

export function getResource(slug: string): ResourceArticle | undefined {
  return resources.find((r) => r.slug === slug);
}

export function getAllResourceSlugs(): string[] {
  return resources.map((r) => r.slug);
}
