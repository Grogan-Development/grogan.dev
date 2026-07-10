"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { DemoButton, DemoInput, DemoLabel, DemoMeta, DemoSelect } from "./demoUi";

const STEPS = ["Request", "Lead", "Assign", "Status"] as const;

export function ContractorQuoteDemo() {
  const [step, setStep] = useState(0);
  const [assigned, setAssigned] = useState(false);
  const [status, setStatus] = useState("New");

  return (
    <DemoWindow
      title="Quote & job tracker"
      subtitle="ops.gdg · demo workspace"
      toolbar={<DemoStepper steps={STEPS} current={step} onSelect={setStep} />}
    >
      <DemoPanel panelKey={step}>
        {step === 0 && (
          <>
          <div>
            <DemoLabel htmlFor="quote-customer-name">Customer name</DemoLabel>
            <DemoInput id="quote-customer-name" placeholder="Name or business" />
          </div>
          <div>
            <DemoLabel htmlFor="quote-project-description">Project description</DemoLabel>
            <DemoInput id="quote-project-description" placeholder="What needs to be quoted?" />
          </div>
          <DemoPlaceholder
            variant="photo"
            label="Photo upload"
            hint="Drop site photos or tap to attach — JPG, HEIC, or PDF"
            tall
          />
          <DemoButton onClick={() => setStep(1)}>Submit request →</DemoButton>
          </>
        )}
        {step === 1 && (
          <>
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
          </>
        )}
        {step === 2 && (
          <>
          <div>
            <DemoLabel htmlFor="quote-assignee">Assign to</DemoLabel>
            <DemoSelect id="quote-assignee" onChange={() => setAssigned(true)} defaultValue="Owner">
            <option>Owner</option>
            <option>Estimator</option>
            </DemoSelect>
          </div>
          {assigned && (
            <DemoButton onClick={() => setStep(3)}>Assign & view board →</DemoButton>
          )}
          </>
        )}
        {step === 3 && (
          <>
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
          <div>
            <DemoLabel htmlFor="quote-status">Quote status</DemoLabel>
            <DemoSelect id="quote-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>New</option>
              <option>Quoting</option>
              <option>Follow-up scheduled</option>
            </DemoSelect>
          </div>
          <DemoMeta>Follow-up reminder: tomorrow 9am</DemoMeta>
          </>
        )}
      </DemoPanel>
    </DemoWindow>
  );
}
