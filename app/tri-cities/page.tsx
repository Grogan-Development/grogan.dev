import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { CardGrid } from "@/components/layout/CardGrid";
import { Button } from "@/components/layout/Button";
import { triCitiesOverview, cities } from "@/content/cities";

export const metadata: Metadata = {
  title: "Tri-Cities",
  description: "Custom business software for Kennewick, Pasco, Richland, and surrounding areas.",
};

export default function TriCitiesPage() {
  return (
    <>
      <PageHeader
        label="Local"
        title={triCitiesOverview.headline}
        description={triCitiesOverview.description}
      />
      <Section label="Industries" title="Businesses we serve">
        <ul className="grid gap-3 sm:grid-cols-2">
          {triCitiesOverview.industries.map((i, index) => (
            <li
              key={i}
              className="flex gap-3 border-t border-line py-3 font-sans text-[length:var(--text-small)] text-ink"
            >
              <span className="w-6 shrink-0 font-mono text-[length:var(--text-label)] tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{i}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section label="Cities" title="Service area" className="bg-surface">
        <CardGrid
          items={cities.map((c) => ({
            title: c.name,
            description: c.headline,
            href: `/tri-cities/${c.slug}`,
          }))}
          columns={3}
        />
      </Section>
      <Section>
        <Button href="/contact">Contact us</Button>
      </Section>
    </>
  );
}
