import { describe, expect, it } from "vitest";
import { examples } from "@/content/examples";

describe("example preview content", () => {
  it("gives every showroom example its own static preview kind", () => {
    expect(examples.map(({ slug, previewKind }) => ({ slug, previewKind }))).toEqual([
      { slug: "contractor-quote-job-tracker", previewKind: "quote-job-pipeline" },
      { slug: "production-file-upload-portal", previewKind: "file-intake-preflight" },
      { slug: "proof-approval-system", previewKind: "proof-approval" },
      { slug: "lead-follow-up-dashboard", previewKind: "lead-follow-up-dashboard" },
      { slug: "mobile-field-checklist-app", previewKind: "mobile-field-checklist" },
      { slug: "ai-job-request-summarizer", previewKind: "ai-request-extraction" },
      {
        slug: "production-file-processing-automation",
        previewKind: "file-processing-pipeline",
      },
    ]);
  });
});
