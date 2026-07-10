import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { UiThumbnail } from "@/components/layout/UiThumbnail";
import { examples } from "@/content/examples";
import { Button } from "@/components/layout/Button";
import { PRIMARY_CTA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Example Systems",
  description:
    "Interactive demo showroom — contractor quotes, file portals, proof approval, mobile checklists, and production automation.",
};

const [featuredExample, ...previewExamples] = examples;

export default function ExamplesPage() {
  return (
    <>
      <PageHeader
        label="Examples"
        layout="split"
        title="Example systems"
        description="Clickable demos that show what custom business software looks like in practice — not a portfolio, a showroom."
      />
      <Section label="Featured showcase" density="roomy">
        <article
          aria-label="Featured showcase"
          className="grid overflow-hidden border border-control bg-surface lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]"
        >
          <UiThumbnail title={featuredExample.title} className="border-0 border-b border-line lg:border-b-0 lg:border-r" />
          <div className="flex flex-col justify-between p-6 sm:p-8">
            <div>
              <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-accent">
                Featured showcase
              </p>
              <h2 className="mt-3 font-display text-[length:var(--text-h2)] text-ink">
                {featuredExample.title}
              </h2>
              <p className="mt-3 font-sans text-[length:var(--text-body)] text-muted">
                {featuredExample.proves}
              </p>
            </div>
            <Link
              href={`/examples/${featuredExample.slug}`}
              className="interactive-link mt-6 inline-flex min-h-[var(--tap-min)] items-center font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
            >
              Open the interactive demo
            </Link>
          </div>
        </article>
      </Section>
      <Section label="More examples" title="More showroom systems" tone="wash">
        <ul aria-label="More example systems" className="grid gap-x-6 sm:grid-cols-2">
          {previewExamples.map((example, index) => (
            <li key={example.slug} className="border-t border-line py-5 first:sm:border-t-0 sm:nth-[2]:border-t-0">
              <Link
                href={`/examples/${example.slug}`}
                className="group block min-h-[var(--tap-min)] focus-visible:outline-offset-4"
              >
                <UiThumbnail title={example.title} className="border-control group-hover:border-ink" />
                <div className="mt-4 flex gap-3">
                  <span className="pt-1 font-mono text-[length:var(--text-label)] tabular-nums text-accent">
                    {String(index + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="interactive-link font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent">
                      {example.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                      {example.proves}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <Section density="compact">
        <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
      </Section>
    </>
  );
}
