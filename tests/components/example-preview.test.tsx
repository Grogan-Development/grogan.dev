import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExamplesPage from "@/app/examples/page";
import { ExamplePreview } from "@/components/examples/ExamplePreview";
import { HomePage } from "@/components/home/HomePage";
import { examples } from "@/content/examples";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
});

describe("ExamplePreview", () => {
  it.each(examples)("renders the $title preview as decorative card artwork", (example) => {
    const { container } = render(<ExamplePreview kind={example.previewKind} title={example.title} />);

    const preview = container.querySelector("[data-preview-kind]");
    if (!preview) {
      throw new Error("Expected a static example preview frame");
    }
    expect(preview).toHaveAttribute("data-preview-kind", example.previewKind);
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(preview).toHaveTextContent(example.title);
    expect(preview.querySelectorAll("button, input, select, textarea")).toHaveLength(0);
    expect(screen.queryByRole("region", { name: `${example.title} preview` })).not.toBeInTheDocument();
  });

  it.each(["future-operations-view", "toString"])(
    "uses a safe static fallback for unrecognized kind %s",
    (kind) => {
      const { container } = render(<ExamplePreview kind={kind} title="Future operations" />);

      expect(container.querySelector("[data-preview-kind]")).toHaveAttribute(
        "data-preview-kind",
        "fallback",
      );
    },
  );

  it("replaces generic thumbnails across the homepage showroom and example hub", () => {
    const { container, rerender } = render(<HomePage />);

    expect(container.querySelectorAll("[data-preview-kind]")).toHaveLength(examples.length);

    rerender(<ExamplesPage />);

    expect(container.querySelectorAll("[data-preview-kind]")).toHaveLength(examples.length);
  });

  it.each([
    ["home showroom", HomePage],
    ["examples hub", ExamplesPage],
  ] as const)("gives each %s card link a concise accessible name", (_pageName, Page) => {
    render(<Page />);

    for (const example of examples) {
      expect(
        screen.getByRole("link", { name: `View example: ${example.title}` }),
      ).toBeInTheDocument();
    }
  });
});
