import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/layout/Button";
import { services } from "@/content/services";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Custom business software, workflow automation, lead intake, job tracking, portals, mobile apps, and AI for Tri-Cities businesses.",
};

const [featuredService, ...remainingServices] = services;

const serviceGroups = [
  { title: "Capture and coordinate", items: remainingServices.slice(0, 3) },
  { title: "Run the work", items: remainingServices.slice(3) },
];

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        label="Services"
        layout="split"
        title="What we build"
        description="Custom software, automation, dashboards, portals, and mobile apps for businesses that have outgrown spreadsheets."
      />
      <Section label="Featured service" density="roomy">
        <Link
          href={`/services/${featuredService.slug}`}
          className="group block min-h-[var(--tap-min)] focus-visible:outline-offset-4"
        >
          <article
            aria-label="Featured service"
            className="grid gap-6 border border-control bg-surface p-6 transition-colors group-hover:border-ink sm:p-8 lg:grid-cols-[0.45fr_1fr] lg:items-end"
          >
            <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-accent">
              01 / Featured service
            </p>
            <div>
              <h2 className="font-display text-[length:var(--text-h2)] text-ink group-hover:text-accent">
                {featuredService.title}
              </h2>
              <p className="mt-3 max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
                {featuredService.headline}
              </p>
            </div>
          </article>
        </Link>
      </Section>
      <Section label="Service groups" title="Additional services" tone="wash">
        <ul aria-label="Additional services" className="space-y-8">
          {serviceGroups.map((group) => (
            <li key={group.title}>
              <h3 className="mb-3 font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                {group.title}
              </h3>
              <ul className="divide-y divide-line border-y border-line">
                {group.items.map((service) => (
                  <li key={service.slug}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="group grid min-h-[var(--tap-min)] gap-3 py-4 focus-visible:outline-offset-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(12rem,0.7fr)] sm:items-baseline sm:gap-5"
                    >
                      <span className="font-mono text-[length:var(--text-label)] tabular-nums text-accent">
                        {String(services.indexOf(service) + 1).padStart(2, "0")}
                      </span>
                      <h4 className="font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                        {service.title}
                      </h4>
                      <p className="font-sans text-[length:var(--text-small)] text-muted">
                        {service.headline}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Not sure where to start?" tone="surface" density="compact">
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
