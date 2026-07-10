type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function LocalBusinessJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Grogan Development Group LLC",
        url: "https://grogan.dev",
        description:
          "Custom software, workflow automation, mobile applications, and AI solutions for Tri-Cities businesses.",
        areaServed: {
          "@type": "GeoCircle",
          geoMidpoint: {
            "@type": "GeoCoordinates",
            latitude: 46.211,
            longitude: -119.137,
          },
          geoRadius: "50000",
        },
        serviceType: [
          "Custom Business Software",
          "Workflow Automation",
          "Mobile Applications",
          "AI Solutions",
        ],
      }}
    />
  );
}

export function ServiceJsonLd({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name,
        description,
        provider: {
          "@type": "LocalBusiness",
          name: "Grogan Development Group LLC",
          url: "https://grogan.dev",
        },
        areaServed: "Tri-Cities, Washington",
      }}
    />
  );
}
