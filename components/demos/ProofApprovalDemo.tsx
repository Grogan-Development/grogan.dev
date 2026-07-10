"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoPlaceholder } from "./DemoPlaceholder";
import { DemoButton, DemoLabel, DemoMeta, DemoTextarea } from "./demoUi";

const STEPS = ["Review", "Decide", "Logged"] as const;

export function ProofApprovalDemo() {
  const [status, setStatus] = useState<"pending" | "approved" | "revision">("pending");
  const [note, setNote] = useState("");

  const currentStep = status === "pending" ? 0 : 2;

  return (
    <DemoWindow
      title="Proof approval"
      subtitle="job #8821 · customer portal"
      toolbar={<DemoStepper steps={STEPS} current={currentStep} />}
    >
      <DemoPanel panelKey={status}>
        <DemoPlaceholder
          variant="proof"
          label="Proof · Banner 4×8 — v2"
          hint="Scale preview · colors approximate"
          tall
        />
        <DemoMeta>Submitted yesterday · Awaiting customer</DemoMeta>

        {status === "pending" && (
          <div className="space-y-3">
            <div>
              <DemoLabel htmlFor="proof-revision-notes">Revision notes</DemoLabel>
              <DemoTextarea
                id="proof-revision-notes"
                placeholder="Optional notes for the production team"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <DemoButton onClick={() => setStatus("approved")}>Approve proof</DemoButton>
              <DemoButton variant="secondary" onClick={() => setStatus("revision")}>
                Request revision
              </DemoButton>
            </div>
          </div>
        )}

        {status === "approved" && (
          <div className="border border-accent/40 bg-accent/5 px-3 py-2.5 text-sm text-ink">
            <p className="font-medium">Approved</p>
            <p className="mt-1 text-xs text-muted">
              Production notified · timestamp logged
            </p>
          </div>
        )}

        {status === "revision" && (
          <div className="border border-line bg-surface-alt/50 px-3 py-2.5 text-sm text-ink">
            <p className="font-medium">Revision requested</p>
            <p className="mt-1 text-xs text-muted">
              {note || "See customer notes"} · Designer notified
            </p>
          </div>
        )}
      </DemoPanel>
    </DemoWindow>
  );
}
