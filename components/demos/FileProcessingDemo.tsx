"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { DemoButton, DemoMeta } from "./demoUi";

const STEPS = ["Upload", "Validate", "Process", "Export"] as const;

export function FileProcessingDemo() {
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);

  function runProcess() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep(2);
    }, 800);
  }

  return (
    <DemoWindow
      title="File processing"
      subtitle="production automation · cutline pipeline"
      toolbar={<DemoStepper steps={STEPS} current={step} />}
    >
      {step === 0 && (
        <DemoPanel panelKey="upload">
          <div className="grid grid-cols-2 gap-3">
            <DemoPlaceholder
              variant="file"
              label="Before"
              hint="Customer art"
              className="min-h-28"
            />
            <DemoPlaceholder
              variant="image"
              label="After"
              hint="Pending process"
              className="min-h-28"
            />
          </div>
          <DemoButton onClick={() => setStep(1)}>Upload file →</DemoButton>
        </DemoPanel>
      )}
      {step === 1 && (
        <DemoPanel panelKey="validate">
          <div className="space-y-2 border border-line bg-surface-alt/50 p-3 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Validation
            </p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="font-mono text-accent">✓</span> Vector paths
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-accent">✓</span> Resolution
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-muted">✗</span>
                <span>
                  Fonts outlined <span className="text-muted">(flagged)</span>
                </span>
              </li>
            </ul>
          </div>
          <DemoButton onClick={runProcess} disabled={processing}>
            {processing ? "Processing..." : "Run automation →"}
          </DemoButton>
        </DemoPanel>
      )}
      {step === 2 && (
        <DemoPanel panelKey="process">
          <div className="grid grid-cols-2 gap-3">
            <DemoPlaceholder
              variant="file"
              label="Original"
              hint="As uploaded"
              className="min-h-28"
            />
            <div className="flex flex-col items-center justify-center gap-2 border border-accent bg-accent/5 px-3 py-6 text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                Processed
              </p>
              <p className="text-xs text-ink">Cutline detected · vector cleaned</p>
            </div>
          </div>
          <DemoMeta>Manual review: Approve export or adjust cutline offset</DemoMeta>
          <DemoButton onClick={() => setStep(3)}>Approve & export →</DemoButton>
        </DemoPanel>
      )}
      {step === 3 && (
        <DemoPanel panelKey="export">
          <div className="border border-line bg-surface-alt/50 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Package ready
            </p>
            <p className="mt-1 text-sm font-medium text-ink">production_package.zip</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-accent">01</span> Cutline layer
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-accent">02</span> Print-ready PDF
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-accent">03</span> Validation report
              </li>
            </ul>
          </div>
        </DemoPanel>
      )}
    </DemoWindow>
  );
}
