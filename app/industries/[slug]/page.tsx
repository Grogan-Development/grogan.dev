import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIndustry, getAllIndustrySlugs } from "@/content/industries";
import { IndustryPageTemplate } from "@/components/pages/IndustryPageTemplate";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllIndustrySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) return {};
  return {
    title: industry.title,
    description: industry.description,
  };
}

export default async function IndustryDetailPage({ params }: Props) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();
  return <IndustryPageTemplate industry={industry} />;
}
