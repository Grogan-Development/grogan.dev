"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { DemoButton, DemoInput, DemoMeta, DemoSelect } from "./demoUi";

const STEPS = ["Request", "Lead", "Assign", "Status"] as const;

export function ContractorQuoteDemo() {
  const [step, setStep] = useState(0);
  const [assigned, setAssigned] = useState(false);
  const [status, setStatus] = useState("New");

  return (
    <DemoWindow
      title="Quote & job tracker"
      subtitle="ops.gdg · live shell"
      toolbar={<DemoStepper steps={STEPS} current={step} onSelect={setStep} />}
    >
      {step === 0 && (
        <DemoPanel panelKey="request">
          <DemoInput placeholder="Customer name" />
          <DemoInput placeholder="Project description" />
          <DemoPlaceholder
            variant="photo"
            label="Photo upload"
            hint="Drop site photos or tap to attach — JPG, HEIC, or PDF"
            tall
          />
          <DemoButton onClick={() => setStep(1)}>Submit request →</DemoButton>
        </DemoPanel>
      )}
      {step === 1 && (
        <DemoPanel panelKey="lead">
          <div className="border border-line bg-surface-alt/50 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Lead #1042
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              Kitchen remodel · 3 photos attached
            </p>
            <DemoMeta>Source: Website form · Created just now</DemoMeta>
          </div>
          <DemoButton onClick={() => setStep(2)}>Open lead →</DemoButton>
        </DemoPanel>
      )}
      {step === 2 && (
        <DemoPanel panelKey="assign">
          <p className="text-sm text-ink">Assign to</p>
          <DemoSelect onChange={() => setAssigned(true)} defaultValue="Owner">
            <option>Owner</option>
            <option>Estimator</option>
          </DemoSelect>
          {assigned && (
            <DemoButton onClick={() => setStep(3)}>Assign & view board →</DemoButton>
          )}
        </DemoPanel>
      )}
      {step === 3 && (
        <DemoPanel panelKey="status">
          <div className="grid grid-cols-3 gap-2">
            {(["New", "Quoting", "Follow-up"] as const).map((col) => (
              <div
                key={col}
                className={`border p-2.5 ${
                  col === "New" ? "border-accent bg-accent/5" : "border-line bg-surface-alt/40"
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                  {col}
                </p>
                {col === "New" && (
                  <p className="mt-2 text-xs text-ink">#1042 Kitchen remodel</p>
                )}
              </div>
            ))}
          </div>
          <DemoSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>New</option>
            <option>Quoting</option>
            <option>Follow-up scheduled</option>
          </DemoSelect>
          <DemoMeta>Follow-up reminder: tomorrow 9am</DemoMeta>
        </DemoPanel>
      )}
    </DemoWindow>
  );
}
