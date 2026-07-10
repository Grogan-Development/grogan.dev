import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExample, getAllExampleSlugs } from "@/content/examples";
import { ExamplePageTemplate } from "@/components/pages/ExamplePageTemplate";
import { demoComponents } from "@/components/demos";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllExampleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const example = getExample(slug);
  if (!example) return {};
  return {
    title: example.title,
    description: example.description,
  };
}

export default async function ExampleDetailPage({ params }: Props) {
  const { slug } = await params;
  const example = getExample(slug);
  if (!example) notFound();

  const DemoComponent = demoComponents[slug];
  if (!DemoComponent) notFound();

  return <ExamplePageTemplate example={example} demo={<DemoComponent />} />;
}
