import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/layout/Card";
import { Button } from "@/components/layout/Button";
import { Container } from "@/components/layout/Container";
import { ServiceJsonLd } from "@/components/seo/JsonLd";
import { getExample } from "@/content/examples";
import { getIndustry } from "@/content/industries";
import { getTypicalRangeByServiceSlug } from "@/content/pricing";
import type { ServicePage } from "@/lib/types";
import { PRIMARY_CTA } from "@/lib/site";

type ServicePageTemplateProps = {
  service: ServicePage;
};

export function ServicePageTemplate({ service }: ServicePageTemplateProps) {
  const typicalRange = getTypicalRangeByServiceSlug(service.slug);

  return (
    <>
      <ServiceJsonLd name={service.title} description={service.description} />
      <PageHeader
        label="Service"
        title={service.headline}
        description={service.description}
      />

      <section data-section="service-layout" className="border-b border-line py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-12">
            <div className="space-y-10">
              {typicalRange ? (
                <p className="font-sans text-[length:var(--text-small)] text-muted">
                  Typical range:{" "}
                  <Link
                    href="/pricing"
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {typicalRange.display}
                  </Link>
                </p>
              ) : null}

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">The core idea</h2>
                <p className="max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
                  {service.coreMessage}
                </p>
              </div>

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">Target businesses</h2>
                <ul className="space-y-2.5">
                  {service.targets.map((t) => (
                    <li
                      key={t}
                      className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 bg-accent"
                        aria-hidden
                      />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">What you get</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {service.features.map((f) => (
                    <Card key={f} className="p-4">
                      <p className="font-sans text-[length:var(--text-small)] leading-snug text-ink">
                        {f}
                      </p>
                    </Card>
                  ))}
                </div>
              </div>

              {service.relatedIndustries?.length ? (
                <div>
                  <h2 className="mb-4 font-display text-[length:var(--text-h2)]">Industries</h2>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {service.relatedIndustries.map((slug) => {
                      const industry = getIndustry(slug);
                      return (
                        <li key={slug}>
                          <Link
                            href={`/industries/${slug}`}
                            className="font-sans text-[length:var(--text-small)] text-accent underline-offset-4 hover:underline"
                          >
                            {industry?.title ?? slug.replace(/-/g, " ")}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {service.relatedExamples?.length ? (
                <div>
                  <h2 className="mb-4 font-display text-[length:var(--text-h2)]">See it in action</h2>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2">
                    {service.relatedExamples.map((slug) => {
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

            <aside className="lg:sticky lg:top-24">
              <Card className="space-y-4 p-6">
                <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                  Next step
                </p>
                <h2 className="font-display text-[length:var(--text-h3)] text-ink">
                  {service.title}
                </h2>
                <p className="font-sans text-[length:var(--text-small)] text-muted">
                  Ready to map this to your workflow? Start with a conversation or a full audit.
                </p>
                <div className="flex flex-col gap-3 pt-1">
                  <Button href="/contact">{service.cta}</Button>
                  <Button href={PRIMARY_CTA.href} variant="secondary">
                    {PRIMARY_CTA.label}
                  </Button>
                </div>
              </Card>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
