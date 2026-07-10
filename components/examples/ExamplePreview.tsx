import type { ReactNode } from "react";
import type { ExamplePreviewKind } from "@/lib/types";

type ExamplePreviewProps = {
  kind: ExamplePreviewKind | string;
  title: string;
  className?: string;
};

type PreviewFrameProps = {
  kind: string;
  title: string;
  className?: string;
  children: ReactNode;
};

type PreviewComponent = () => ReactNode;

const label = "font-mono text-[10px] uppercase tracking-[0.1em] text-muted";
const panel = "border border-line bg-surface px-2.5 py-2";

/** Static, non-interactive product previews for showroom cards. */
export function ExamplePreview({ kind, title, className = "" }: ExamplePreviewProps) {
  const hasPreview = Object.hasOwn(previews, kind);
  const Preview = hasPreview ? previews[kind as ExamplePreviewKind] : FallbackPreview;
  const previewKind = hasPreview ? kind : "fallback";

  return (
    <PreviewFrame kind={previewKind} title={title} className={className}>
      <Preview />
    </PreviewFrame>
  );
}

function PreviewFrame({ kind, title, className, children }: PreviewFrameProps) {
  return (
    <div
      aria-hidden="true"
      data-preview-kind={kind}
      className={`overflow-hidden border border-line bg-surface-alt ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-line" aria-hidden />
        <span className="size-1.5 rounded-full bg-line" aria-hidden />
        <span className="size-1.5 rounded-full bg-accent/50" aria-hidden />
        <p className="ml-1 truncate font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
          {title}
        </p>
      </div>
      <div className="aspect-[16/10] bg-paper p-3">{children}</div>
    </div>
  );
}

function QuoteJobPipelinePreview() {
  return (
    <div className="grid h-full grid-cols-[1.1fr_0.9fr] gap-2">
      <div className="space-y-2">
        <p className={label}>New quote</p>
        <dl className={`${panel} space-y-1.5`}>
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-muted">Customer</dt>
            <dd className="text-xs font-medium text-ink">Riverbend Kitchen</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-xs text-muted">Scope</dt>
            <dd className="text-xs text-ink">Remodel quote</dd>
          </div>
        </dl>
        <div className="flex gap-1.5" aria-label="Attached job photos">
          <span className="h-7 flex-1 border border-line bg-surface-alt" />
          <span className="h-7 flex-1 border border-line bg-surface-alt" />
          <span className="h-7 flex-1 border border-line bg-surface-alt" />
        </div>
      </div>
      <div className="border-l border-line pl-2">
        <p className={label}>Job pipeline</p>
        <ol className="mt-2 space-y-1.5">
          {[
            ["Lead", "active"],
            ["Quote", "next"],
            ["Schedule", ""],
          ].map(([step, state], index) => (
            <li key={step} className="flex items-center gap-1.5 text-xs text-ink">
              <span
                className={`size-2 border ${state === "active" ? "border-accent bg-accent" : state === "next" ? "border-accent bg-accent/20" : "border-line"}`}
                aria-hidden
              />
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function FileIntakePreflightPreview() {
  return (
    <div className="grid h-full grid-cols-[1.05fr_0.95fr] gap-2">
      <div className={`${panel} flex flex-col justify-between`}>
        <div>
          <p className={label}>Production intake</p>
          <p className="mt-2 text-sm font-medium text-ink">banner-art-v3.pdf</p>
          <p className="mt-1 text-xs text-muted">PDF · 18.4 MB · 4 × 8 ft</p>
        </div>
        <div className="mt-3 border border-dashed border-line bg-surface-alt px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted">
          Local file selected
        </div>
      </div>
      <div>
        <p className={label}>Preflight</p>
        <ul className="mt-2 space-y-1.5">
          {["CMYK profile", "Bleed included", "Scale confirmed"].map((item, index) => (
            <li key={item} className={`${panel} flex items-center gap-1.5 text-xs text-ink`}>
              <span className={`size-2 border ${index < 2 ? "border-accent bg-accent" : "border-line"}`} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProofApprovalPreview() {
  return (
    <div className="grid h-full grid-cols-[1.2fr_0.8fr] gap-2">
      <figure className="relative flex min-h-0 flex-col border border-line bg-surface-alt p-2">
        <div className="flex-1 border border-accent/30 bg-accent/5" />
        <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          Banner proof · v2
        </figcaption>
      </figure>
      <dl className={`${panel} space-y-3`}>
        <div>
          <dt className={label}>Status</dt>
          <dd className="mt-1 text-sm font-medium text-accent">Awaiting approval</dd>
        </div>
        <div>
          <dt className={label}>Customer</dt>
          <dd className="mt-1 text-xs text-ink">Shoreline Market</dd>
        </div>
        <div className="border-t border-line pt-2 text-xs text-muted">Revision trail ready</div>
      </dl>
    </div>
  );
}

function LeadFollowUpDashboardPreview() {
  return (
    <div className="h-full">
      <div className="mb-2 flex items-center justify-between">
        <p className={label}>Follow-up queue</p>
        <p className="font-mono text-xs text-accent">3 due</p>
      </div>
      <table className="w-full border-collapse text-left text-xs">
        <thead className="border-y border-line bg-surface-alt text-muted">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-normal">Lead</th>
            <th scope="col" className="px-2 py-1.5 font-normal">Next action</th>
            <th scope="col" className="px-2 py-1.5 font-normal">Due</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["L. Parker", "Send quote", "Today"],
            ["Mesa Dental", "Call back", "Thu"],
            ["Palouse Co.", "Follow up", "Fri"],
          ].map(([lead, action, due]) => (
            <tr key={lead} className="border-b border-line">
              <td className="px-2 py-1.5 text-ink">{lead}</td>
              <td className="px-2 py-1.5 text-muted">{action}</td>
              <td className="px-2 py-1.5 text-ink">{due}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileFieldChecklistPreview() {
  return (
    <div className="mx-auto flex h-full max-w-[11rem] flex-col rounded-[1rem] border-2 border-ink bg-surface p-2">
      <div className="mx-auto h-1 w-8 rounded-full bg-ink/30" aria-hidden />
      <div className="mt-2 flex items-baseline justify-between">
        <p className={label}>Job 441</p>
        <p className="font-mono text-[10px] text-accent">3/6</p>
      </div>
      <div className="mt-1 h-1 bg-line"><div className="h-full w-1/2 bg-accent" /></div>
      <ol className="mt-2 space-y-1.5">
        {["Site access", "Measure opening", "Before photo", "Install hardware"].map((task, index) => (
          <li key={task} className="flex items-center gap-1.5 text-[11px] text-ink">
            <span className={`size-2 border ${index < 3 ? "border-accent bg-accent" : "border-line"}`} aria-hidden />
            {task}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AiRequestExtractionPreview() {
  return (
    <div className="grid h-full grid-cols-2 gap-2">
      <article className={`${panel} flex flex-col`}>
        <p className={label}>Raw request</p>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          Need a fleet wrap for our white Chevy van by month end. EPS logo available.
        </p>
      </article>
      <dl className={`${panel} space-y-1.5`}>
        <div>
          <dt className={label}>Project</dt>
          <dd className="text-xs text-ink">Fleet wrap</dd>
        </div>
        <div>
          <dt className={label}>Timeline</dt>
          <dd className="text-xs text-ink">Month end</dd>
        </div>
        <div>
          <dt className={label}>Next</dt>
          <dd className="text-xs text-accent">Request EPS</dd>
        </div>
      </dl>
    </div>
  );
}

function FileProcessingPipelinePreview() {
  return (
    <div className="flex h-full flex-col">
      <p className={label}>Production pipeline</p>
      <ol className="mt-2 grid flex-1 grid-cols-4 gap-1.5">
        {[
          ["Source art", "PDF"],
          ["Validate", "Passed"],
          ["Clean vectors", "Running"],
          ["Export", "Ready"],
        ].map(([step, status], index) => (
          <li key={step} className="flex min-w-0 flex-col border border-line bg-surface px-1.5 py-2">
            <span className="font-mono text-[10px] text-muted">{String(index + 1).padStart(2, "0")}</span>
            <span className="mt-1 text-[11px] leading-tight text-ink">{step}</span>
            <span className={`mt-auto pt-2 text-[10px] ${index === 2 ? "text-accent" : "text-muted"}`}>
              {status}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FallbackPreview() {
  return (
    <div className="flex h-full flex-col justify-between border border-dashed border-line bg-surface px-3 py-2.5">
      <p className={label}>Custom operations system</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Intake", "Ready"],
          ["Review", "Tracked"],
          ["Handoff", "Clear"],
        ].map(([stage, state]) => (
          <div key={stage} className="border border-line bg-paper px-1 py-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{stage}</dt>
            <dd className="mt-1 text-xs text-ink">{state}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const previews: Record<ExamplePreviewKind, PreviewComponent> = {
  "quote-job-pipeline": QuoteJobPipelinePreview,
  "file-intake-preflight": FileIntakePreflightPreview,
  "proof-approval": ProofApprovalPreview,
  "lead-follow-up-dashboard": LeadFollowUpDashboardPreview,
  "mobile-field-checklist": MobileFieldChecklistPreview,
  "ai-request-extraction": AiRequestExtractionPreview,
  "file-processing-pipeline": FileProcessingPipelinePreview,
};
