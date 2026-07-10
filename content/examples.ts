import type { ExamplePage } from "@/lib/types";

export const examples: ExamplePage[] = [
  {
    slug: "contractor-quote-job-tracker",
    title: "Contractor Quote & Job Tracker",
    description:
      "A quote request flow that captures photos, creates a lead, assigns a job, tracks quote status, and triggers follow-up.",
    flow: [
      "Customer submits request",
      "Uploads photos",
      "System creates lead",
      "Owner assigns job",
      "Quote status changes",
      "Follow-up reminder fires",
      "Customer gets update",
    ],
    proves: "End-to-end lead-to-quote workflow with assignment, status tracking, and automated follow-up.",
    previewKind: "quote-job-pipeline",
  },
  {
    slug: "production-file-upload-portal",
    title: "Production Shop File Upload Portal",
    description:
      "Customer uploads files, selects material and specs, runs a checklist, generates a proof, and requests approval or revision.",
    flow: [
      "Customer uploads file",
      "Selects material/size/use case",
      "Checklist runs",
      "Proof is generated",
      "Approval or revision requested",
      "Production package prepared",
    ],
    proves: "Structured file intake with validation, proof generation, and production handoff.",
    previewKind: "file-intake-preflight",
  },
  {
    slug: "proof-approval-system",
    title: "Customer Proof Approval System",
    description:
      "Proof preview with approve and request-revision actions, keeping approval out of email threads.",
    flow: [
      "Proof uploaded",
      "Customer notified",
      "Customer reviews proof",
      "Approves or requests revision",
      "Production notified",
      "Job status updated",
    ],
    proves: "Clear proof approval workflow with audit trail and status updates.",
    previewKind: "proof-approval",
  },
  {
    slug: "lead-follow-up-dashboard",
    title: "Local Business Lead Dashboard",
    description:
      "Lead source tracking, next action assignment, follow-up reminders, and simple reporting.",
    flow: [
      "Lead comes in",
      "Source is tracked",
      "Next action assigned",
      "Follow-up reminder",
      "Review request",
      "Simple report",
    ],
    proves: "Centralized lead management so nothing falls through the cracks.",
    previewKind: "lead-follow-up-dashboard",
  },
  {
    slug: "mobile-field-checklist-app",
    title: "Mobile Field Checklist App",
    description:
      "Crew opens a job, checks tasks, uploads photos, captures notes, and marks complete while the office sees status.",
    flow: [
      "Crew opens job",
      "Checks tasks",
      "Uploads photos",
      "Captures notes",
      "Marks complete",
      "Office sees status",
    ],
    proves: "Field-to-office sync for crews working outside the office.",
    previewKind: "mobile-field-checklist",
  },
  {
    slug: "ai-job-request-summarizer",
    title: "AI Job Request Summarizer",
    description:
      "Paste a messy customer request and get structured fields: scope, materials, timeline, and next action.",
    flow: [
      "Customer request received",
      "Text pasted or forwarded",
      "AI extracts key fields",
      "Human reviews summary",
      "Lead created with structured data",
      "Follow-up assigned",
    ],
    proves: "Paste a messy request. Get structured job details ready to quote.",
    previewKind: "ai-request-extraction",
  },
  {
    slug: "production-file-processing-automation",
    title: "Production File Processing Automation",
    description:
      "Example: production automation built from real workflow experience — cutline generation, file validation, vector cleanup, and export automation.",
    flow: [
      "File uploaded",
      "Validation runs",
      "Cutline detected/generated",
      "Vector cleanup applied",
      "Manual review step",
      "Export to production format",
    ],
    proves: "Real production automation — not a portfolio trick, but proof of build capability from years solving operational workflow problems inside production businesses.",
    previewKind: "file-processing-pipeline",
  },
];

export function getExample(slug: string): ExamplePage | undefined {
  return examples.find((e) => e.slug === slug);
}

export function getAllExampleSlugs(): string[] {
  return examples.map((e) => e.slug);
}
