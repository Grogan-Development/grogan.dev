import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/layout/Button";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { differentiationPoints, whyGdgCopy } from "@/content/home";
import { SITE_IMAGES } from "@/lib/images";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Grogan Development Group builds practical business software for Tri-Cities operators who understand messy real-world workflows.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        label="About"
        title="About Grogan Development Group"
        description="Local business systems builder for the Tri-Cities and surrounding region."
      />
      <Section label="Background">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] lg:items-start">
          <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
            {whyGdgCopy}
          </p>
          <ImagePlaceholder
            image={SITE_IMAGES.founder}
            sizes="(max-width: 1024px) 100vw, 32vw"
          />
        </div>
      </Section>
      <Section label="Differentiation" title="How GDG is different" className="bg-surface">
        <p className="mb-8 max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
          Other local firms pitch custom systems too. We lead with a demo showroom, a transparent
          offer ladder, and production file/workflow depth — so you can evaluate proof and fit
          before a full build.
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
      <Section label="More" title="Learn more">
        <ul className="space-y-1">
          {[
            { href: "/company", label: "Company" },
            { href: "/process", label: "Process" },
            { href: "/case-studies", label: "Case studies" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
              >
                {item.label} →
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section className="bg-surface">
        <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
      </Section>
    </>
  );
}
