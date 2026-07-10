import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/layout/Button";
import { processSteps } from "@/content/home";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Process",
  description: "How projects work at Grogan Development Group — from discovery to launch and support.",
};

function stepTitle(step: string) {
  return step.replace(/^\d+\.\s*/, "");
}

export default function ProcessPage() {
  return (
    <>
      <PageHeader
        label="Process"
        title="How projects work"
        description="Discovery, design, build, launch, and ongoing support — structured so you see progress at every step."
      />
      <Section>
        <ol className="divide-y divide-line border-y border-line">
          {processSteps.map((step, index) => (
            <li key={step.step} className="flex gap-4 py-5 sm:gap-6 sm:py-6">
              <span className="w-8 shrink-0 font-mono text-[length:var(--text-small)] tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-[length:var(--text-h3)] text-ink">
                  {stepTitle(step.step)}
                </h3>
                <p className="mt-2 font-sans text-[length:var(--text-small)] leading-relaxed text-muted sm:text-[length:var(--text-body)]">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
      <Section className="bg-surface">
        <Button href={PRIMARY_CTA.href}>Start with a Workflow Audit</Button>
      </Section>
    </>
  );
}
