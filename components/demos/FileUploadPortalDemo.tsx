"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { DemoButton, DemoInput, DemoLabel, DemoSelect } from "./demoUi";

const STEPS = ["Upload", "Checklist", "Proof", "Approve"] as const;

export function FileUploadPortalDemo() {
  const [step, setStep] = useState(0);
  const [checks, setChecks] = useState({ format: false, size: false, bleed: false });
  const [selectedFileName, setSelectedFileName] = useState("");

  const allChecked = Object.values(checks).every(Boolean);

  return (
    <DemoWindow
      title="File upload portal"
      subtitle="shop intake · customer view"
      toolbar={<DemoStepper steps={STEPS} current={step} />}
    >
      <DemoPanel panelKey={step}>
        {step === 0 && (
          <>
          <div>
            <DemoLabel htmlFor="production-file">Production file (local only)</DemoLabel>
            <DemoInput
              id="production-file"
              type="file"
              accept=".pdf,.ai,.eps"
              aria-describedby="production-file-help"
              onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
            />
            <p id="production-file-help" className="mt-1.5 text-xs text-muted">
              PDF, AI, or EPS · max 250 MB · this demo never uploads files.
            </p>
            {selectedFileName ? (
              <p className="mt-1.5 text-xs text-ink">{selectedFileName} selected locally</p>
            ) : null}
          </div>
          <div>
            <DemoLabel htmlFor="production-product-type">Product type</DemoLabel>
            <DemoSelect id="production-product-type" defaultValue="Vinyl banner">
              <option>Vinyl banner</option>
              <option>Vehicle wrap</option>
              <option>Coroplast sign</option>
            </DemoSelect>
          </div>
          <DemoButton onClick={() => setStep(1)}>Upload →</DemoButton>
          </>
        )}
        {step === 1 && (
          <>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Preflight checklist
          </p>
          {(["format", "size", "bleed"] as const).map((key) => (
            <label
              key={key}
              className="flex min-h-[var(--tap-min)] items-center gap-2.5 border border-line bg-surface-alt/40 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checks[key]}
                onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              {key === "format" && "Correct file format (PDF/AI)"}
              {key === "size" && "Dimensions confirmed"}
              {key === "bleed" && "Bleed included"}
            </label>
          ))}
          {allChecked && (
            <DemoButton onClick={() => setStep(2)}>Generate proof →</DemoButton>
          )}
          </>
        )}
        {step === 2 && (
          <>
          <DemoPlaceholder
            variant="proof"
            label="Proof preview"
            hint="Banner 4×8 · auto-generated from upload"
            tall
          />
          <DemoButton onClick={() => setStep(3)}>Send for approval →</DemoButton>
          </>
        )}
        {step === 3 && (
          <>
          <div className="border border-line bg-surface-alt/50 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Awaiting decision
            </p>
            <p className="mt-1 text-sm text-ink">
              Proof sent to customer · production holds until approve or revise
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DemoButton>Approve</DemoButton>
            <DemoButton variant="secondary">Request revision</DemoButton>
          </div>
          </>
        )}
      </DemoPanel>
    </DemoWindow>
  );
}
