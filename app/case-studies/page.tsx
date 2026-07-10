import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/layout/Button";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Case Studies",
  description: "Client case studies from Grogan Development Group — coming as projects complete.",
};

const upcomingFields = [
  "Business type and problem solved",
  "Systems built (intake, tracking, portal, mobile, automation)",
  "Before/after workflow summary",
  "Results where measurable (time saved, fewer dropped leads, faster quotes)",
  "Screenshots and demo links where permitted",
];

export default function CaseStudiesPage() {
  return (
    <>
      <PageHeader
        label="Case studies"
        title="Case studies"
        description="Real client work will appear here as projects complete. No fabricated case studies."
      />
      <Section label="Coming soon" title="What will appear here">
        <div className="border-y border-line py-8 sm:py-10">
          <p className="max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
            Each study will document a real engagement — problem, system, and outcome — once
            projects are complete and clients approve sharing.
          </p>
          <ol className="mt-8 divide-y divide-line border-t border-line">
            {upcomingFields.map((field, index) => (
              <li key={field} className="flex gap-4 py-4 sm:gap-6">
                <span className="w-8 shrink-0 font-mono text-[length:var(--text-small)] tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="font-sans text-[length:var(--text-body)] text-ink">{field}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <Section className="bg-surface">
        <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
      </Section>
    </>
  );
}
