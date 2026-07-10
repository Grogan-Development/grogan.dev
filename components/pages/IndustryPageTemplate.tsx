import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/layout/Card";
import { Button } from "@/components/layout/Button";
import { Container } from "@/components/layout/Container";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { IndustryMark } from "@/components/icons/IndustryMarks";
import { getExample } from "@/content/examples";
import { getPriorityAIndustryLine } from "@/content/pricing";
import { getService } from "@/content/services";
import { industryImageSrc } from "@/lib/images";
import type { IndustryPage } from "@/lib/types";
import { PRIMARY_CTA } from "@/lib/site";

const industryCaptions: Record<string, string> = {
  "contractors-home-services": "Job site",
  "manufacturing-fabrication": "Shop floor",
  "sign-print-wrap-cnc-shops": "Wrap bay",
  "wineries-events-hospitality": "Vineyard",
  "professional-offices": "Office desk",
  "local-service-businesses": "Service van",
};

type IndustryPageTemplateProps = {
  industry: IndustryPage;
};

export function IndustryPageTemplate({ industry }: IndustryPageTemplateProps) {
  const priorityALine = getPriorityAIndustryLine(industry.slug);
  const caption = industryCaptions[industry.slug] ?? "Operations";

  return (
    <>
      <PageHeader
        label="Industry"
        title={industry.headline}
        description={industry.description}
      />

      <section data-section="industry-layout" className="border-b border-line py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-12">
            <div className="space-y-10">
              {priorityALine ? (
                <p className="max-w-3xl font-sans text-[length:var(--text-small)] text-muted">
                  {priorityALine}{" "}
                  <Link
                    href="/pricing"
                    className="text-accent underline-offset-4 hover:underline"
                  >
                    See pricing
                  </Link>
                </p>
              ) : null}

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                  If this sounds familiar
                </h2>
                <ol aria-label="Operational pain points" className="divide-y divide-line border-y border-line">
                  {industry.painPoints.map((painPoint, index) => (
                    <li key={painPoint} className="flex gap-4 py-4 sm:gap-6">
                      <span className="w-8 shrink-0 font-mono text-[length:var(--text-small)] tabular-nums text-accent">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="font-sans text-[length:var(--text-small)] leading-snug text-muted">
                        {painPoint}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                  What we build for this industry
                </h2>
                <ul aria-label="Operational systems" className="space-y-2.5">
                  {industry.systems.map((s) => (
                    <li
                      key={s}
                      className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
                    >
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-accent font-mono text-[length:var(--text-label)] text-accent"
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {industry.seoTargets?.length ? (
                <div>
                  <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                    Common searches
                  </p>
                  <p className="mt-2 font-sans text-[length:var(--text-small)] text-muted">
                    {industry.seoTargets.join(" · ")}
                  </p>
                </div>
              ) : null}

              {industry.relatedServices?.length ? (
                <div>
                  <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                    Related services
                  </h2>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {industry.relatedServices.map((slug) => {
                      const service = getService(slug);
                      return (
                        <li key={slug}>
                          <Link
                            href={`/services/${slug}`}
                            className="font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
                          >
                            {service?.title ?? slug.replace(/-/g, " ")}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {industry.relatedExamples?.length ? (
                <div>
                  <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                    Example systems
                  </h2>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {industry.relatedExamples.map((slug) => {
                      const example = getExample(slug);
                      return (
                        <li key={slug}>
                          <Link
                            href={`/examples/${slug}`}
                            className="font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
                          >
                            {example?.title ?? slug.replace(/-/g, " ")}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <ImagePlaceholder
                aspect="industry"
                label={`${industry.title} photography`}
                caption={caption}
              >
                <Image
                  src={industryImageSrc(industry.slug)}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 20rem"
                  className="object-cover object-center"
                />
              </ImagePlaceholder>
              <Card className="space-y-4 p-6">
                <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                  Next step
                </p>
                <div className="flex items-center gap-3">
                  <IndustryMark slug={industry.slug} className="h-6 w-6 shrink-0 text-ink" />
                  <h2 className="font-display text-[length:var(--text-h3)] text-ink">
                    {industry.title}
                  </h2>
                </div>
                <p className="font-sans text-[length:var(--text-small)] text-muted">
                  See how a custom system would fit your shop, crew, or office — start with an
                  audit.
                </p>
                <div className="pt-1">
                  <Button href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Button>
                </div>
              </Card>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
