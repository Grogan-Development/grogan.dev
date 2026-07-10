import type { ReactNode } from "react";

type DemoPhoneProps = {
  appLabel?: string;
  children: ReactNode;
  className?: string;
};

/** Mobile product-chrome frame for field / checklist demos. */
export function DemoPhone({
  appLabel = "Field checklist",
  children,
  className = "",
}: DemoPhoneProps) {
  return (
    <div className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div className="overflow-hidden rounded-[1.85rem] border-[3px] border-ink bg-ink p-1.5 shadow-[0_12px_32px_-16px_oklch(0.22_0.02_250_/_0.35)]">
        <div className="overflow-hidden rounded-[1.45rem] bg-surface">
          <div className="relative flex items-center justify-between bg-surface-alt px-4 pb-1.5 pt-2.5">
            <span className="font-mono text-[length:var(--text-label)] tabular-nums text-muted">
              9:41
            </span>
            <div
              className="absolute left-1/2 top-1.5 h-5 w-[5.5rem] -translate-x-1/2 rounded-full bg-ink"
              aria-hidden
            />
            <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
              LTE
            </span>
          </div>
          <div className="border-b border-line px-4 py-2.5">
            <p className="font-mono text-[length:var(--text-label)] uppercase tracking-[0.14em] text-muted">
              {appLabel}
            </p>
          </div>
          <div className="min-h-[22rem] bg-surface p-4">{children}</div>
          <div className="flex justify-center bg-surface pb-2.5 pt-1">
            <div className="h-1 w-24 rounded-full bg-ink/15" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
