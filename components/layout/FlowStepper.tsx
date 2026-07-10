type FlowStepperProps = {
  steps: string[];
  className?: string;
};

/** Horizontal stepper on md+; vertical stack on mobile. */
export function FlowStepper({ steps, className = "" }: FlowStepperProps) {
  return (
    <ol
      className={`flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:gap-0 ${className}`}
      aria-label="How it works"
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step}
            className="relative flex gap-3 md:min-w-0 md:flex-1 md:flex-col md:items-center md:px-2 md:text-center"
          >
            <div className="flex shrink-0 flex-col items-center md:w-full">
              <span
                className="flex size-8 items-center justify-center border border-accent bg-surface font-mono text-[length:var(--text-label)] font-medium tabular-nums text-accent"
                aria-hidden
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {!isLast ? (
                <span
                  className="mt-1 w-px flex-1 bg-line md:mt-0 md:hidden"
                  aria-hidden
                />
              ) : null}
            </div>
            {!isLast ? (
              <span
                className="absolute top-4 left-[calc(50%+1rem)] hidden h-px bg-line md:block md:w-[calc(100%-2rem)]"
                aria-hidden
              />
            ) : null}
            <p className="pt-1 font-sans text-[length:var(--text-small)] leading-snug text-ink md:pt-3">
              {step}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
