import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { companyCopy, differentiationPoints } from "@/content/home";

export const metadata: Metadata = {
  title: "Company",
  description:
    "Grogan Development Group LLC — custom software, automation, mobile apps, and AI for local businesses.",
};

export default function CompanyPage() {
  return (
    <>
      <PageHeader
        label="Company"
        title="Grogan Development Group LLC"
        description={companyCopy.intro}
      />
      <Section label="Scope" title="What GDG encompasses">
        <ul className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
          {companyCopy.encompasses.map((item, index) => (
            <li
              key={item}
              className="flex items-baseline gap-4 border-t border-line py-4"
            >
              <span className="w-6 shrink-0 font-mono text-[length:var(--text-label)] tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-[length:var(--text-h3)] text-ink">{item}</h3>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Positioning" className="bg-surface">
        <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {companyCopy.positioning}
        </p>
      </Section>
      <Section label="Differentiation" title="Built differently for operators">
        <p className="mb-8 max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          {companyCopy.differentiation}
        </p>
        <ul className="grid gap-6 sm:grid-cols-3">
          {differentiationPoints.map((point) => (
            <li key={point.title} className="border-t border-line pt-4">
              <h3 className="font-display text-[length:var(--text-h3)] text-ink">{point.title}</h3>
              <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
