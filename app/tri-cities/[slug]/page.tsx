import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCity, getAllCitySlugs } from "@/content/cities";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/layout/Card";
import { Button } from "@/components/layout/Button";
import { Container } from "@/components/layout/Container";
import { PRIMARY_CTA } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllCitySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const city = getCity(slug);
  if (!city) return {};
  return {
    title: `Custom Software ${city.name}`,
    description: city.description,
  };
}

export default async function CityPage({ params }: Props) {
  const { slug } = await params;
  const city = getCity(slug);
  if (!city) notFound();

  return (
    <>
      <PageHeader label="Tri-Cities" title={city.headline} description={city.description} />
      <section data-section="city-layout" className="border-b border-line py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-12">
            <div className="space-y-10">
              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                  Businesses in {city.name}
                </h2>
                <ul className="space-y-2.5">
                  {city.industries.map((i) => (
                    <li
                      key={i}
                      className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
                    >
                      <span className="mt-2 size-1.5 shrink-0 bg-accent" aria-hidden />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="mb-4 font-display text-[length:var(--text-h2)]">
                  Example systems for this area
                </h2>
                <ul className="space-y-2.5">
                  {city.examples.map((e) => (
                    <li
                      key={e}
                      className="flex gap-3 font-sans text-[length:var(--text-small)] text-muted"
                    >
                      <span
                        className="mt-0.5 flex size-5 shrink-0 items-center justify-center border border-accent font-mono text-[length:var(--text-label)] text-accent"
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <aside className="lg:sticky lg:top-24">
              <Card className="space-y-4 p-6">
                <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                  Next step
                </p>
                <h2 className="font-display text-[length:var(--text-h3)] text-ink">
                  Serving {city.name}
                </h2>
                <p className="font-sans text-[length:var(--text-small)] text-muted">
                  Tell us about the workflow problem — we will point you to the right next step.
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
