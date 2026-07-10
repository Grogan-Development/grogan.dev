import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/layout/SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/services",
}));

describe("SiteHeader", () => {
  it("renders the home link and mobile navigation control", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Grogan Development Group" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
  });

  it("marks the active route and opens a mobile disclosure instead of a modal", () => {
    render(<SiteHeader />);

    expect(screen.getAllByRole("link", { name: "Services" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

    const mobileNavigation = screen.getByRole("navigation", { name: "Mobile" });
    expect(mobileNavigation).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mobileNavigation).toHaveAttribute("aria-label", "Mobile");
  });
});
