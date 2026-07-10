import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
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
        layout="split"
        title="Resources"
        description="Practical guides for business owners dealing with leads, quotes, jobs, files, and software decisions."
      />
      <Section label="Articles" density="roomy">
        <div className="divide-y divide-line border-y border-line">
          {resources.map((resource, index) => (
            <article key={resource.slug} className="py-5 sm:py-6">
              <Link
                href={`/resources/${resource.slug}`}
                className="group grid min-h-[var(--tap-min)] gap-3 focus-visible:outline-offset-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(12rem,0.55fr)] sm:items-baseline sm:gap-6"
              >
                <span className="font-mono text-[length:var(--text-label)] tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                  {resource.title}
                </h2>
                <p className="font-sans text-[length:var(--text-small)] leading-snug text-muted">
                  {resource.description}
                </p>
              </Link>
            </article>
          ))}
        </div>
      </Section>
      <Section tone="surface" density="compact">
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
