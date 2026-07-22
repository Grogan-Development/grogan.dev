import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zack Grogan",
  description:
    "Personal site of Zack Grogan, a software developer. Not a development agency, studio, or group for hire.",
  metadataBase: new URL("https://grogan.dev"),
  openGraph: {
    type: "website",
    url: "https://grogan.dev",
    title: "Zack Grogan",
    description:
      "Personal site of Zack Grogan, a software developer. Not a development agency, studio, or group for hire.",
  },
  twitter: {
    card: "summary",
    title: "Zack Grogan",
    description:
      "Personal site of Zack Grogan, a software developer. Not a development agency, studio, or group for hire.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
