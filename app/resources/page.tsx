import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { CardGrid } from "@/components/layout/CardGrid";
import { Button } from "@/components/layout/Button";
import { resources } from "@/content/resources";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Guides on lead intake, job tracking, file portals, proof approval, custom software, and mobile apps for small businesses.",
};

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        label="Resources"
        title="Resources"
        description="Practical guides for business owners dealing with leads, quotes, jobs, files, and software decisions."
      />
      <Section>
        <CardGrid
          items={resources.map((r, index) => ({
            label: String(index + 1).padStart(2, "0"),
            title: r.title,
            description: r.description,
            href: `/resources/${r.slug}`,
          }))}
          columns={2}
        />
      </Section>
      <Section className="bg-surface">
        <p className="max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Not sure where to start? A Workflow Audit maps the bottlenecks before you commit to a
          build.
        </p>
        <div className="mt-6">
          <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
        </div>
      </Section>
    </>
  );
}
