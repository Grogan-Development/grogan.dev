"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoButton, DemoInput, DemoLabel, DemoMeta, DemoSelect } from "./demoUi";

const STEPS = ["Request", "Lead", "Assign", "Status"] as const;

export function ContractorQuoteDemo() {
  const [step, setStep] = useState(0);
  const [assigned, setAssigned] = useState(false);
  const [status, setStatus] = useState("New");
  const [selectedPhotoNames, setSelectedPhotoNames] = useState<string[]>([]);
  const photoCount = selectedPhotoNames.length;
  const photoSelectionLabel = `${photoCount} ${photoCount === 1 ? "photo" : "photos"} selected locally`;

  function submitRequest() {
    if (photoCount > 0) setStep(1);
  }

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
          <div>
            <DemoLabel htmlFor="quote-site-photos">Site photos (local only)</DemoLabel>
            <DemoInput
              id="quote-site-photos"
              type="file"
              multiple
              accept=".jpg,.jpeg,.heic,.pdf"
              aria-describedby="quote-site-photos-help"
              onChange={(event) =>
                setSelectedPhotoNames(Array.from(event.target.files ?? [], (file) => file.name))
              }
            />
            <p id="quote-site-photos-help" className="mt-1.5 text-xs text-muted">
              JPG, HEIC, or PDF · this demo never uploads files.
            </p>
            {photoCount > 0 ? (
              <p className="mt-1.5 text-xs text-ink">{photoSelectionLabel}</p>
            ) : null}
          </div>
          {photoCount === 0 ? (
            <p className="text-xs text-muted">Choose at least one site photo to continue.</p>
          ) : null}
          <DemoButton onClick={submitRequest} disabled={photoCount === 0}>
            Submit request →
          </DemoButton>
          </>
        )}
        {step === 1 && (
          <>
          <div className="border border-line bg-surface-alt/50 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Lead #1042
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              Kitchen remodel · {photoSelectionLabel}
            </p>
            <DemoMeta>Local demo lead · Created just now</DemoMeta>
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
