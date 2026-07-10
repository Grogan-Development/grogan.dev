import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/layout/Card";
import { Container } from "@/components/layout/Container";
import { IntakeForm } from "@/components/forms/IntakeForm";
import { positioning, startingPoints } from "@/content/pricing";

export const metadata: Metadata = {
  title: "Workflow Audit",
  description:
    "Find the bottlenecks before building software. A Workflow Audit maps how leads, jobs, files, and follow-up move through your business.",
};

const auditStartingPoint = startingPoints[0];

const deliverables = [
  "45–60 minute discovery call",
  "Workflow map",
  "Bottleneck list",
  "Recommended system design",
  "Feature list",
  "Build estimate",
  "Implementation plan",
];

const nextSteps = [
  "You submit the form with your biggest workflow problem.",
  "We review and schedule a 45–60 minute discovery call.",
  "You receive a written map, bottleneck list, and build estimate.",
  "If you move forward, the audit fee can credit toward the project.",
];

export default function WorkflowAuditPage() {
  return (
    <>
      <PageHeader
        label="Offer"
        title="Find the bottlenecks before building software."
        description="A Workflow Audit maps how leads, jobs, files, quotes, approvals, follow-up, and reporting move through your business. You get a clear breakdown of what is broken, what can be automated, what should not be automated, and what a practical custom system would cost."
      />

      <section data-section="audit-layout" className="border-b border-line py-12 sm:py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)] lg:items-start lg:gap-10 xl:gap-14">
            <div className="space-y-10">
              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">What you get</h2>
                <ul className="space-y-2.5">
                  {deliverables.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 font-sans text-[length:var(--text-small)]"
                    >
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-accent font-mono text-[length:var(--text-label)] text-accent"
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Card className="border-accent/30 bg-surface p-5 sm:p-6">
                <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                  Starting at
                </p>
                <p className="price-display mt-2">{positioning.auditsStartAt}</p>
                <p className="price-inline mt-1 text-muted">
                  Typical range {auditStartingPoint.range.display}
                </p>
                <p className="mt-3 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                  If you move forward with a full build, the audit can be credited toward the
                  project.
                </p>
              </Card>

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                  Request a Workflow Audit
                </h2>
                <IntakeForm formType="workflow-audit" />
              </div>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Card className="space-y-5 p-5 sm:p-6">
                <div>
                  <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                    Process
                  </p>
                  <h2 className="mt-2 font-display text-[length:var(--text-h3)]">
                    What happens next
                  </h2>
                </div>
                <ol className="divide-y divide-line border-y border-line">
                  {nextSteps.map((step, index) => (
                    <li
                      key={step}
                      className="flex gap-3 py-3.5 font-sans text-[length:var(--text-small)] leading-snug text-muted first:pt-3 last:pb-3"
                    >
                      <span
                        className="w-5 shrink-0 font-mono text-[length:var(--text-label)] tabular-nums text-accent"
                        aria-hidden
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
