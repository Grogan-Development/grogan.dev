type DemoStepperProps = {
  steps: readonly string[];
  current: number;
  onSelect?: (index: number) => void;
};

/** Step progress control — accent marks the active step. */
export function DemoStepper({ steps, current, onSelect }: DemoStepperProps) {
  return (
    <nav aria-label="Demo steps" className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => {
        const isActive = i === current;
        const isComplete = i < current;
        const interactive = Boolean(onSelect);

        const className = [
          "demo-stepper-btn inline-flex min-h-9 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[length:var(--text-label)] uppercase tracking-[0.08em] transition-colors",
          isActive
            ? "border-accent bg-accent/10 text-accent"
            : isComplete
              ? "border-line bg-surface text-ink hover:border-ink"
              : "border-line text-muted",
          interactive ? "cursor-pointer" : "cursor-default",
        ].join(" ");

        if (interactive) {
          return (
            <button
              key={step}
              type="button"
              onClick={() => onSelect?.(i)}
              className={className}
              aria-current={isActive ? "step" : undefined}
            >
              <StepIndex index={i} isActive={isActive} isComplete={isComplete} />
              {step}
            </button>
          );
        }

        return (
          <span
            key={step}
            className={className}
            aria-current={isActive ? "step" : undefined}
          >
            <StepIndex index={i} isActive={isActive} isComplete={isComplete} />
            {step}
          </span>
        );
      })}
    </nav>
  );
}

function StepIndex({
  index,
  isActive,
  isComplete,
}: {
  index: number;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <span
      className={[
        "flex size-4 items-center justify-center text-[length:var(--text-label)] tabular-nums",
        isActive ? "text-accent" : isComplete ? "text-ink" : "text-muted",
      ].join(" ")}
      aria-hidden
    >
      {isComplete ? "✓" : String(index + 1).padStart(2, "0")}
    </span>
  );
}
