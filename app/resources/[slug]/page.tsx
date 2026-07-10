import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResource, getAllResourceSlugs } from "@/content/resources";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/layout/Card";
import { Button } from "@/components/layout/Button";
import { Container } from "@/components/layout/Container";
import { PRIMARY_CTA } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllResourceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getResource(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
  };
}

export default async function ResourceArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getResource(slug);
  if (!article) notFound();

  return (
    <>
      <PageHeader label="Resource" title={article.title} description={article.description} />
      <section data-section="resource-layout" className="border-b border-line py-12">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start lg:gap-12">
            <article className="max-w-3xl space-y-10">
              {article.sections.map((section, index) => (
                <div key={section.heading}>
                  <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 font-display text-[length:var(--text-h2)]">
                    {section.heading}
                  </h2>
                  <p className="mt-3 font-sans text-[length:var(--text-body)] text-muted">
                    {section.body}
                  </p>
                </div>
              ))}
            </article>

            <aside className="lg:sticky lg:top-24">
              <Card className="space-y-4 p-6">
                <p className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                  Next step
                </p>
                <h2 className="font-display text-[length:var(--text-h3)] text-ink">
                  Ready to map your workflow?
                </h2>
                <p className="font-sans text-[length:var(--text-small)] text-muted">
                  If this guide matches a problem you are living with, start with a Workflow Audit.
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
