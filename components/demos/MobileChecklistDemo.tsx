"use client";

import { useState } from "react";
import { DemoPhone } from "./DemoPhone";
import { DemoInput, DemoLabel, DemoTextarea } from "./demoUi";

const TASKS = [
  "Verify site access",
  "Measure opening",
  "Photo: before",
  "Install hardware",
  "Photo: after",
  "Customer sign-off",
];

export function MobileChecklistDemo() {
  const [checked, setChecked] = useState<boolean[]>(TASKS.map(() => false));
  const [notes, setNotes] = useState("");
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const done = checked.filter(Boolean).length;
  const progress = Math.round((done / TASKS.length) * 100);

  return (
    <DemoPhone appLabel="Field checklist">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-ink">Job #441 — Front door install</p>
          <p aria-live="polite" aria-atomic="true" className="mt-0.5 font-mono text-[11px] tabular-nums text-muted">
            {done}/{TASKS.length} complete
          </p>
          <div className="mt-2 h-1 w-full bg-line">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-1.5">
          {TASKS.map((task, i) => (
            <li key={task}>
              <label
                className={`flex min-h-[var(--tap-min)] items-center gap-2.5 border px-2.5 py-2 text-sm ${
                  checked[i]
                    ? "border-accent/30 bg-accent/5 text-muted line-through"
                    : "border-line bg-surface text-ink"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => {
                    const next = [...checked];
                    next[i] = e.target.checked;
                    setChecked(next);
                  }}
                  className="accent-[var(--accent)]"
                />
                {task}
              </label>
            </li>
          ))}
        </ul>

        <div>
          <DemoLabel htmlFor="field-notes">Field notes</DemoLabel>
          <DemoTextarea
            id="field-notes"
            placeholder="Add notes for the office"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>

        <div>
          <DemoLabel htmlFor="field-job-photo">Job photo (local only)</DemoLabel>
          <DemoInput
            id="field-job-photo"
            type="file"
            accept=".jpg,.jpeg,.heic"
            aria-describedby="field-job-photo-help"
            onChange={(event) => setSelectedPhotoName(event.target.files?.[0]?.name ?? "")}
          />
          <p id="field-job-photo-help" className="mt-1.5 text-xs text-muted">
            JPG or HEIC · this demo keeps photos in your browser.
          </p>
          {selectedPhotoName ? (
            <p className="mt-1.5 text-xs text-ink">{selectedPhotoName} selected locally</p>
          ) : null}
        </div>

        {done === TASKS.length && (
          <div className="border border-accent/40 bg-accent/5 px-3 py-2.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
              Synced
            </p>
            <p className="mt-0.5 text-xs text-ink">Pushed to office dashboard</p>
          </div>
        )}
      </div>
    </DemoPhone>
  );
}
