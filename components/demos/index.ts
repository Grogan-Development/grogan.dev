import type { ComponentType } from "react";
import { ContractorQuoteDemo } from "./ContractorQuoteDemo";
import { FileUploadPortalDemo } from "./FileUploadPortalDemo";
import { ProofApprovalDemo } from "./ProofApprovalDemo";
import { LeadDashboardDemo } from "./LeadDashboardDemo";
import { MobileChecklistDemo } from "./MobileChecklistDemo";
import { AiSummarizerDemo } from "./AiSummarizerDemo";
import { FileProcessingDemo } from "./FileProcessingDemo";

export { DemoWindow } from "./DemoWindow";
export { DemoPhone } from "./DemoPhone";
export { DemoStepper } from "./DemoStepper";
export { DemoPlaceholder } from "./DemoPlaceholder";
export { DemoPanel } from "./DemoPanel";

export const demoComponents: Record<string, ComponentType> = {
  "contractor-quote-job-tracker": ContractorQuoteDemo,
  "production-file-upload-portal": FileUploadPortalDemo,
  "proof-approval-system": ProofApprovalDemo,
  "lead-follow-up-dashboard": LeadDashboardDemo,
  "mobile-field-checklist-app": MobileChecklistDemo,
  "ai-job-request-summarizer": AiSummarizerDemo,
  "production-file-processing-automation": FileProcessingDemo,
};
