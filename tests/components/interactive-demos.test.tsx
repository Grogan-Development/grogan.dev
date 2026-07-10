import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    { name: "quote photos", Demo: ContractorQuoteDemo, label: "Site photos (local only)" },
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
    { name: "field photo", Demo: MobileChecklistDemo, label: "Job photo (local only)" },
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

  it("requires a production file before starting preflight", () => {
    render(<FileUploadPortalDemo />);

    const start = screen.getByRole("button", { name: /Upload/ });
    expect(start).toBeDisabled();
    expect(screen.getByText("Choose a production file to begin preflight.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Production file (local only)"), {
      target: { files: [new File(["art"], "banner-art.pdf")] },
    });
    expect(start).toBeEnabled();

    fireEvent.click(start);
    expect(screen.getByText("Preflight for banner-art.pdf")).toBeInTheDocument();
  });

  it("requires artwork before starting file processing", () => {
    render(<FileProcessingDemo />);

    const start = screen.getByRole("button", { name: /Upload file/ });
    expect(start).toBeDisabled();
    expect(screen.getByText("Choose an artwork file to begin validation.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Artwork file (local only)"), {
      target: { files: [new File(["art"], "vehicle-wrap.ai")] },
    });
    expect(start).toBeEnabled();

    fireEvent.click(start);
    expect(screen.getByText("Validation for vehicle-wrap.ai")).toBeInTheDocument();
  });

  it("requires site photos before creating the quote-demo lead", () => {
    render(<ContractorQuoteDemo />);

    const submit = screen.getByRole("button", { name: /Submit request/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Choose at least one site photo to continue.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Site photos (local only)"), {
      target: { files: [new File(["photo"], "kitchen-before.jpg")] },
    });
    expect(screen.getByText("1 photo selected locally")).toBeInTheDocument();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(screen.getByText("Kitchen remodel · 1 photo selected locally")).toBeInTheDocument();
  });

  it("counts multiple selected contractor site photos", () => {
    render(<ContractorQuoteDemo />);

    const input = screen.getByLabelText("Site photos (local only)");
    expect(input).toHaveAttribute("multiple");

    fireEvent.change(input, {
      target: {
        files: [
          new File(["before"], "kitchen-before.jpg"),
          new File(["after"], "kitchen-after.jpg"),
        ],
      },
    });

    expect(screen.getByText("2 photos selected locally")).toBeInTheDocument();
  });

  it.each([
    {
      name: "quote site photos",
      Demo: ContractorQuoteDemo,
      label: "Site photos (local only)",
      fileName: "kitchen-before.jpg",
      selectionText: "1 photo selected locally",
    },
    {
      name: "field job photos",
      Demo: MobileChecklistDemo,
      label: "Job photo (local only)",
      fileName: "front-door-after.jpg",
      selectionText: "front-door-after.jpg selected locally",
    },
  ])("keeps $name in the browser without a network request", ({
    Demo,
    label,
    fileName,
    selectionText,
  }) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    render(<Demo />);

    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { files: [new File(["photo"], fileName)] } });

    expect(screen.getByText(selectionText)).toBeInTheDocument();
    expect(input.closest("form")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
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

    fireEvent.change(screen.getByLabelText("Site photos (local only)"), {
      target: { files: [new File(["photo"], "kitchen-before.jpg")] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit request/ }));

    expect(screen.getByTestId("demo-panel")).toBe(liveRegion);
  });

  it("announces mobile checklist progress", () => {
    render(<MobileChecklistDemo />);

    expect(screen.getByText("0/6 complete")).toHaveAttribute("aria-live", "polite");
  });

  it("moves focus to the changed panel", () => {
    render(<ContractorQuoteDemo />);

    fireEvent.change(screen.getByLabelText("Site photos (local only)"), {
      target: { files: [new File(["photo"], "kitchen-before.jpg")] },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit request/ }));

    expect(screen.getByTestId("demo-panel")).toHaveFocus();
  });

  it("marks file automation as busy while processing", () => {
    render(<FileProcessingDemo />);

    fireEvent.change(screen.getByLabelText("Artwork file (local only)"), {
      target: { files: [new File(["art"], "vehicle-wrap.ai")] },
    });
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
