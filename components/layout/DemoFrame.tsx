import type { ReactNode } from "react";

type DemoFrameProps = {
  children: ReactNode;
  title?: string;
  className?: string;
};

/**
 * Structural device/window chrome around demo shells.
 * Demo-chrome pass can deepen internals; this reserves the frame layout.
 */
export function DemoFrame({ children, title = "Demo", className = "" }: DemoFrameProps) {
  return (
    <div
      data-section="demo-frame"
      className={`overflow-hidden border border-line bg-surface shadow-[0_1px_0_var(--line)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-line bg-surface-alt px-3 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-accent/45" />
        </span>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
          {title}
        </span>
        <span className="w-10" aria-hidden />
      </div>
      <div className="min-h-[280px] bg-paper p-4 sm:p-6">{children}</div>
    </div>
  );
}
