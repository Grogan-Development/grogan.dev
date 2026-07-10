"use client";

import { useState } from "react";
import { DemoWindow } from "./DemoWindow";
import { DemoStepper } from "./DemoStepper";
import { DemoPanel } from "./DemoPanel";
import { DemoButton, DemoMeta, DemoTextarea } from "./demoUi";

const SAMPLE =
  "Hi we need a wrap for our fleet van chevy 2500 white. Logo on both sides and back. Have eps file can send. Need by end of month thanks - jim";

const STEPS = ["Intake", "Summarize", "Review"] as const;

export function AiSummarizerDemo() {
  const [input, setInput] = useState(SAMPLE);
  const [summarized, setSummarized] = useState(false);
  const step = summarized ? 2 : 0;

  function summarize() {
    setSummarized(true);
  }

  return (
    <DemoWindow
      title="Job request summarizer"
      subtitle="AI assist · human review required"
      toolbar={<DemoStepper steps={STEPS} current={step} />}
    >
      <DemoPanel panelKey={summarized ? "out" : "in"}>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Raw request
        </p>
        <DemoTextarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSummarized(false);
          }}
          rows={4}
        />
        <DemoButton onClick={summarize}>Summarize request</DemoButton>

        {summarized ? (
          <div className="space-y-2 border border-line bg-surface-alt/50 p-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
              Structured summary
            </p>
            <dl className="space-y-1.5 text-sm">
              <Row term="Project" detail="Fleet vehicle wrap" />
              <Row term="Vehicle" detail="Chevy 2500, white" />
              <Row term="Scope" detail="Logo both sides + rear" />
              <Row term="Files" detail="EPS available" />
              <Row term="Timeline" detail="End of month" />
              <Row term="Next action" detail="Request EPS + vehicle photos" />
            </dl>
            <DemoMeta>Human review before lead created</DemoMeta>
          </div>
        ) : (
          <div className="border border-dashed border-line bg-surface-alt/40 px-4 py-6 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              Summary panel
            </p>
            <p className="mt-1 text-xs text-muted">
              Run summarize to extract project fields for review
            </p>
          </div>
        )}
      </DemoPanel>
    </DemoWindow>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
        {term}
      </dt>
      <dd className="text-ink">{detail}</dd>
    </div>
  );
}
