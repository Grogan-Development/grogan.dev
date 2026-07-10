import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Card } from "@/components/layout/Card";
import { UiThumbnail } from "@/components/layout/UiThumbnail";
import { examples } from "@/content/examples";
import { Button } from "@/components/layout/Button";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Example Systems",
  description:
    "Interactive demo showroom — contractor quotes, file portals, proof approval, mobile checklists, and production automation.",
};

export default function ExamplesPage() {
  return (
    <>
      <PageHeader
        label="Examples"
        title="Example systems"
        description="Clickable demos that show what custom business software looks like in practice — not a portfolio, a showroom."
      />
      <Section label="Showroom">
        <div className="grid gap-5 sm:grid-cols-2">
          {examples.map((e) => (
            <Link
              key={e.slug}
              href={`/examples/${e.slug}`}
              className="group block min-h-[var(--tap-min)] focus-visible:outline-offset-4"
            >
              <Card className="interactive-card h-full overflow-hidden p-0 group-hover:border-ink group-focus-visible:border-accent">
                <UiThumbnail title={e.title} className="border-0 border-b border-line" />
                <div className="space-y-2 p-5">
                  <h3 className="interactive-link font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                    {e.title}
                  </h3>
                  <p className="line-clamp-2 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                    {e.proves}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
      <Section>
        <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
      </Section>
    </>
  );
}
