import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContractorQuoteDemo } from "@/components/demos/ContractorQuoteDemo";
import { FileProcessingDemo } from "@/components/demos/FileProcessingDemo";
import { FileUploadPortalDemo } from "@/components/demos/FileUploadPortalDemo";
import { AiSummarizerDemo } from "@/components/demos/AiSummarizerDemo";
import { MobileChecklistDemo } from "@/components/demos/MobileChecklistDemo";
import { ProofApprovalDemo } from "@/components/demos/ProofApprovalDemo";
import { ExamplePageTemplate } from "@/components/pages/ExamplePageTemplate";
import { examples } from "@/content/examples";

describe("interactive demos", () => {
  it.each([
    { name: "quote request", Demo: ContractorQuoteDemo, label: "Customer name" },
    {
      name: "quote assignment",
      Demo: ContractorQuoteDemo,
      label: "Assign to",
      open: () => fireEvent.click(screen.getByRole("button", { name: "Assign" })),
    },
    { name: "file intake", Demo: FileUploadPortalDemo, label: "Production file (local only)" },
    { name: "file product type", Demo: FileUploadPortalDemo, label: "Product type" },
    { name: "proof approval", Demo: ProofApprovalDemo, label: "Revision notes" },
    { name: "field checklist", Demo: MobileChecklistDemo, label: "Field notes" },
    { name: "AI request", Demo: AiSummarizerDemo, label: "Customer request" },
    { name: "file processing", Demo: FileProcessingDemo, label: "Artwork file (local only)" },
  ])("gives the $name form control a visible label", ({ Demo, label, open }) => {
    render(<Demo />);
    open?.();

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it("keeps selected portal files local to the browser", () => {
    render(<FileUploadPortalDemo />);

    const file = new File(["art"], "banner-art.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText("Production file (local only)");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("banner-art.pdf selected locally")).toBeInTheDocument();
    expect(input.closest("form")).toBeNull();
  });

  it("keeps selected processing files local to the browser", () => {
    render(<FileProcessingDemo />);

    const file = new File(["art"], "vehicle-wrap.ai", { type: "application/postscript" });
    const input = screen.getByLabelText("Artwork file (local only)");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("vehicle-wrap.ai selected locally")).toBeInTheDocument();
    expect(input.closest("form")).toBeNull();
  });

  it("uses 44px minimum classes for demo controls and steppers", () => {
    render(<ContractorQuoteDemo />);

    expect(screen.getByRole("button", { name: "Request" })).toHaveClass(
      "min-h-[var(--tap-min)]",
    );
    expect(screen.getByRole("button", { name: /Submit request/ })).toHaveClass(
      "min-h-[var(--tap-min)]",
    );
  });

  it("announces a changed panel", () => {
    render(<ContractorQuoteDemo />);

    const liveRegion = screen.getByTestId("demo-panel");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveAttribute("aria-atomic", "true");

    fireEvent.click(screen.getByRole("button", { name: /Submit request/ }));

    expect(screen.getByTestId("demo-panel")).toBe(liveRegion);
  });

  it("announces mobile checklist progress", () => {
    render(<MobileChecklistDemo />);

    expect(screen.getByText("0/6 complete")).toHaveAttribute("aria-live", "polite");
  });

  it("moves focus to the changed panel", () => {
    render(<ContractorQuoteDemo />);

    fireEvent.click(screen.getByRole("button", { name: /Submit request/ }));

    expect(screen.getByTestId("demo-panel")).toHaveFocus();
  });

  it("marks file automation as busy while processing", () => {
    render(<FileProcessingDemo />);

    fireEvent.click(screen.getByRole("button", { name: /Upload file/ }));
    fireEvent.click(screen.getByRole("button", { name: /Run automation/ }));

    expect(screen.getByTestId("demo-panel")).toHaveAttribute("aria-busy", "true");
  });

  it("uses demo terminology in customer-facing example copy", () => {
    render(<ExamplePageTemplate example={examples[0]} demo={<p>Demo content</p>} />);
    render(<ContractorQuoteDemo />);

    expect(screen.getByRole("heading", { name: "Try the demo" })).toBeInTheDocument();
    expect(screen.queryByText(/live shell/i)).not.toBeInTheDocument();
  });
});
