import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { CardGrid } from "@/components/layout/CardGrid";
import { Button } from "@/components/layout/Button";
import { services } from "@/content/services";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Custom business software, workflow automation, lead intake, job tracking, portals, mobile apps, and AI for Tri-Cities businesses.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        label="Services"
        title="What we build"
        description="Custom software, automation, dashboards, portals, and mobile apps for businesses that have outgrown spreadsheets."
      />
      <Section>
        <CardGrid
          items={services.map((s, index) => ({
            label: String(index + 1).padStart(2, "0"),
            title: s.title,
            description: s.headline,
            href: `/services/${s.slug}`,
          }))}
          columns={2}
        />
      </Section>
      <Section label="Not sure where to start?" className="bg-surface">
        <p className="max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Not sure which service fits? A Workflow Audit maps the bottlenecks before you commit to a
          build.
        </p>
        <div className="mt-6">
          <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
        </div>
      </Section>
    </>
  );
}
