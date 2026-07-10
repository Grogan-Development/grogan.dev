import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/layout/Button";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { industries } from "@/content/industries";
import { industryHomeBlurbs } from "@/content/home";
import { getIndustryImage } from "@/lib/images";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Custom software for contractors, manufacturers, production shops, wineries, offices, and local service businesses.",
};

export default function IndustriesPage() {
  return (
    <>
      <PageHeader
        label="Industries"
        title="Built around the way your business actually works"
        description="Industry-specific systems for Tri-Cities businesses — not generic templates."
      />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => {
            const blurb =
              industryHomeBlurbs[industry.slug] ?? industry.description;
            return (
              <Link
                key={industry.slug}
                href={`/industries/${industry.slug}`}
                className="group block focus-visible:outline-offset-4"
              >
                <ImagePlaceholder
                  image={getIndustryImage(industry.slug)}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="transition-transform duration-500 group-hover:scale-[1.01]"
                  imageClassName="transition-[filter] duration-500 group-hover:brightness-[1.03]"
                />
                <h3 className="mt-3 font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                  {industry.title}
                </h3>
                <p className="mt-1 line-clamp-2 font-sans text-[length:var(--text-small)] text-muted">
                  {blurb}
                </p>
              </Link>
            );
          })}
        </div>
      </Section>
      <Section className="bg-surface">
        <p className="max-w-2xl font-sans text-[length:var(--text-body)] text-muted">
          Serving Kennewick, Pasco, Richland, and surrounding areas.
        </p>
        <div className="mt-6">
          <Button href="/tri-cities" variant="ghost">
            Tri-Cities service area →
          </Button>
        </div>
      </Section>
    </>
  );
}
