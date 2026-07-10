import type { CityPage } from "@/lib/types";

export const triCitiesOverview = {
  headline: "Custom business software for Tri-Cities operators",
  description:
    "Grogan Development Group serves Kennewick, Pasco, Richland, and surrounding areas. The Tri-Cities economy is diversified — industrial parks and fabrication, commercial and hospitality growth, professional and tech-adjacent offices, and a strong visitor economy around wine and events. Local operators across these sectors still run on quotes, jobs, files, and follow-up that generic software rarely handles well.",
  industries: [
    "Contractors and home services",
    "Manufacturing and fabrication",
    "Sign, print, wrap, and CNC shops",
    "Wineries, events, and hospitality",
    "Professional offices",
    "Local service businesses",
  ],
};

export const cities: CityPage[] = [
  {
    slug: "kennewick",
    name: "Kennewick",
    headline: "Custom software and workflow automation for Kennewick businesses",
    description:
      "Kennewick anchors much of the Tri-Cities commercial and hospitality corridor — retail and service businesses, hotels and venues, and contractors serving a growing residential and commercial base. Construction momentum and visitor-facing demand put pressure on lead intake, quoting, and customer communication. Grogan Development Group builds systems for Kennewick operators who have outgrown spreadsheets and manual admin.",
    industries: [
      "Contractors and home services serving Kennewick homeowners and commercial projects",
      "Retail and service businesses along commercial corridors",
      "Hotels, venues, and hospitality businesses drawing regional visitors",
    ],
    examples: [
      "Quote request systems with photo upload",
      "Lead follow-up dashboards",
      "Customer portals for repeat service",
    ],
  },
  {
    slug: "pasco",
    name: "Pasco",
    headline: "Business systems for Pasco manufacturers, ag businesses, and service companies",
    description:
      "Pasco’s industrial parks and agricultural base mean many businesses juggle job specs, seasonal demand, and field operations — from food and ag processing to fabrication and contractors. Custom software helps Pasco companies track jobs, manage production files, and keep office and field in sync without enterprise overhead.",
    industries: [
      "Food and ag processing, manufacturing, and fabrication",
      "Industrial and warehouse-adjacent operations",
      "Contractors and field service companies",
    ],
    examples: [
      "Job tracking dashboards",
      "File upload and production portals",
      "Mobile field checklist apps",
    ],
  },
  {
    slug: "richland",
    name: "Richland",
    headline: "Custom software for Richland professional offices and technology-adjacent businesses",
    description:
      "Richland’s professional and technology-oriented community — offices, consultancies, and specialty shops near energy and R&D work — needs intake systems, internal workflows, and automation that respect operational complexity without enterprise bloat. Grogan Development Group builds practical tools for Richland operators who want clarity, not another generic platform.",
    industries: [
      "Professional offices and consultancies",
      "Technology and R&D-adjacent service businesses",
      "Specialty manufacturing and production shops",
    ],
    examples: [
      "Client intake and document collection",
      "AI-assisted admin tools",
      "Internal operations dashboards",
    ],
  },
];

export function getCity(slug: string): CityPage | undefined {
  return cities.find((c) => c.slug === slug);
}

export function getAllCitySlugs(): string[] {
  return cities.map((c) => c.slug);
}
