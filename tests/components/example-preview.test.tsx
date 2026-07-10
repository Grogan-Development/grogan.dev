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
  it.each(examples)("renders a differentiated semantic preview for $title", (example) => {
    render(<ExamplePreview kind={example.previewKind} title={example.title} />);

    const preview = screen.getByRole("region", { name: `${example.title} preview` });
    expect(preview).toHaveAttribute("data-preview-kind", example.previewKind);
    expect(preview).toHaveTextContent(example.title);
    expect(preview.querySelectorAll("button, input, select, textarea")).toHaveLength(0);
  });

  it.each(["future-operations-view", "toString"])(
    "uses a safe static fallback for unrecognized kind %s",
    (kind) => {
      render(<ExamplePreview kind={kind} title="Future operations" />);

      expect(screen.getByRole("region", { name: "Future operations preview" })).toHaveAttribute(
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
});
