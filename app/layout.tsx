import type { Metadata } from "next";
import { Fraunces, Geist, IBM_Plex_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { LocalBusinessJsonLd } from "@/components/seo/JsonLd";
import { SITE_IMAGES } from "@/lib/images";
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

export const metadata: Metadata = {
  title: {
    default: `${SITE.shortName} | ${SITE.tagline}`,
    template: `%s | ${SITE.shortName}`,
  },
  description:
    "Grogan Development Group builds custom software, automation, dashboards, portals, and mobile apps for Tri-Cities businesses that have outgrown spreadsheets.",
  metadataBase: new URL(SITE.url),
  openGraph: {
    images: [{ url: SITE_IMAGES.og, width: 1536, height: 1024, alt: SITE.shortName }],
  },
  twitter: {
    card: "summary_large_image",
    images: [SITE_IMAGES.og],
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
