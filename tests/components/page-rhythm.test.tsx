import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExamplesPage from "@/app/examples/page";
import PricingPage from "@/app/pricing/page";
import ResourcesPage from "@/app/resources/page";
import ServicesPage from "@/app/services/page";
import { IndustryPageTemplate } from "@/components/pages/IndustryPageTemplate";
import { examples } from "@/content/examples";
import { industries } from "@/content/industries";
import { resources } from "@/content/resources";
import { services } from "@/content/services";

describe("hub and detail page rhythm", () => {
  it("presents the primary service separately from grouped service rows", () => {
    render(<ServicesPage />);

    expect(screen.getByRole("article", { name: "Featured service" })).toHaveTextContent(
      services[0].title,
    );
    expect(screen.getByRole("list", { name: "Additional services" })).toHaveTextContent(
      services[1].title,
    );
  });

  it("uses one featured example showcase before the two-column preview list", () => {
    render(<ExamplesPage />);

    expect(screen.getByRole("article", { name: "Featured showcase" })).toHaveTextContent(
      examples[0].title,
    );
    expect(screen.getByRole("list", { name: "More example systems" })).toHaveTextContent(
      examples[1].title,
    );
  });

  it("lists resources as editorial articles instead of a card grid", () => {
    render(<ResourcesPage />);

    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(resources.length);
    expect(articles[0]).toHaveTextContent(resources[0].title);
  });

  it("renders industry pain points as a numbered operational list", () => {
    render(<IndustryPageTemplate industry={industries[0]} />);

    const painPoints = screen.getByRole("list", { name: "Operational pain points" });
    expect(painPoints.tagName).toBe("OL");
    expect(within(painPoints).getAllByRole("listitem")).toHaveLength(
      industries[0].painPoints.length,
    );
  });

  it("gives each pricing table a named, focusable comparison region and caption", () => {
    render(<PricingPage />);

    const region = screen.getByRole("region", { name: "Starting point pricing" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table", { name: "Starting point pricing" })).toBeInTheDocument();
    expect(screen.getAllByText(/Scroll to compare all columns/).length).toBeGreaterThan(0);
  });
});
