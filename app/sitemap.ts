import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getAllServiceSlugs } from "@/content/services";
import { getAllIndustrySlugs } from "@/content/industries";
import { getAllExampleSlugs } from "@/content/examples";
import { getAllResourceSlugs } from "@/content/resources";
import { getAllCitySlugs } from "@/content/cities";

const staticRoutes = [
  "",
  "/services",
  "/industries",
  "/examples",
  "/pricing",
  "/workflow-audit",
  "/about",
  "/company",
  "/process",
  "/case-studies",
  "/contact",
  "/resources",
  "/tri-cities",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url;

  const routes = [
    ...staticRoutes.map((path) => ({ url: `${base}${path}`, lastModified: new Date() })),
    ...getAllServiceSlugs().map((slug) => ({
      url: `${base}/services/${slug}`,
      lastModified: new Date(),
    })),
    ...getAllIndustrySlugs().map((slug) => ({
      url: `${base}/industries/${slug}`,
      lastModified: new Date(),
    })),
    ...getAllExampleSlugs().map((slug) => ({
      url: `${base}/examples/${slug}`,
      lastModified: new Date(),
    })),
    ...getAllResourceSlugs().map((slug) => ({
      url: `${base}/resources/${slug}`,
      lastModified: new Date(),
    })),
    ...getAllCitySlugs().map((slug) => ({
      url: `${base}/tri-cities/${slug}`,
      lastModified: new Date(),
    })),
  ];

  return routes;
}
