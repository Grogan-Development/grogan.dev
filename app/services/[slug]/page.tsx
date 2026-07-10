import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getService, getAllServiceSlugs } from "@/content/services";
import { ServicePageTemplate } from "@/components/pages/ServicePageTemplate";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.description,
  };
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  return <ServicePageTemplate service={service} />;
}
