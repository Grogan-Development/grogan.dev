import type { Metadata } from "next";
import { Fraunces, Geist, IBM_Plex_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";
import { isReleasedImage, SITE_IMAGES } from "@/lib/images";
import { SITE } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const releasedSocialImage = isReleasedImage(SITE_IMAGES.og)
  ? {
      url: SITE_IMAGES.og.src,
      width: 1200,
      height: 630,
      alt: SITE.shortName,
    }
  : null;

export const metadata: Metadata = {
  title: {
    default: `${SITE.shortName} | ${SITE.tagline}`,
    template: `%s | ${SITE.shortName}`,
  },
  description:
    "Grogan Development Group builds custom software, automation, dashboards, portals, and mobile apps for Tri-Cities businesses that have outgrown spreadsheets.",
  metadataBase: new URL(SITE.url),
  openGraph: {
    type: "website",
    url: SITE.url,
    title: `${SITE.shortName} | ${SITE.tagline}`,
    description:
      "Grogan Development Group builds custom software, automation, dashboards, portals, and mobile apps for Tri-Cities businesses that have outgrown spreadsheets.",
    ...(releasedSocialImage ? { images: [releasedSocialImage] } : {}),
  },
  twitter: {
    card: releasedSocialImage ? "summary_large_image" : "summary",
    ...(releasedSocialImage ? { images: [releasedSocialImage.url] } : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <LocalBusinessJsonLd />
        <SkipToContent />
        <SiteHeader />
        <main id="main-content" className="flex-1" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
