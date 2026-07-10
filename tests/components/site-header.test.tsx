import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/components/layout/SiteHeader";

describe("SiteHeader", () => {
  it("renders the home link and mobile navigation control", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Grogan Development Group" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });
});
