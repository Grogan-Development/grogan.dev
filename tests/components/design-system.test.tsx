import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardGrid } from "@/components/layout/CardGrid";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";

describe("layout design-system variants", () => {
  it.each([
    ["paper", "compact", "none"],
    ["surface", "standard", "top"],
    ["wash", "roomy", "both"],
  ] as const)("marks the %s/%s/%s section variant in its semantic section", (tone, density, border) => {
    render(
      <Section tone={tone} density={density} border={border} title="Operating context">
        <p>Content</p>
      </Section>,
    );

    const section = screen.getByRole("region", { name: "Operating context" });
    expect(section).toHaveAttribute("data-tone", tone);
    expect(section).toHaveAttribute("data-density", density);
    expect(section).toHaveAttribute("data-border", border);
  });

  it.each(["standard", "split", "compact"] as const)(
    "marks the %s page-header layout while retaining the page heading",
    (layout) => {
      render(
        <PageHeader
          layout={layout}
          title="Operational systems"
          description="A practical starting point."
        />,
      );

      const header = screen.getByRole("banner");
      expect(header).toHaveAttribute("data-layout", layout);
      expect(within(header).getByRole("heading", { level: 1 })).toHaveTextContent(
        "Operational systems",
      );
    },
  );

  it("uses h2 for hub cards by default and permits an explicit lower heading level", () => {
    const item = { title: "Job tracking", description: "A clear shared view." };
    const { rerender } = render(<CardGrid items={[item]} />);

    expect(screen.getByRole("heading", { level: 2, name: item.title })).toBeInTheDocument();

    rerender(<CardGrid items={[item]} headingLevel={3} />);

    expect(screen.getByRole("heading", { level: 3, name: item.title })).toBeInTheDocument();
  });
});
