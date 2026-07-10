import type { ReactNode } from "react";

type DemoWindowProps = {
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Desktop product-chrome frame for interactive demos. */
export function DemoWindow({
  title,
  subtitle,
  toolbar,
  children,
  className = "",
}: DemoWindowProps) {
  return (
    <div
      className={`overflow-hidden border border-line bg-surface shadow-[0_1px_0_var(--line)] ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-line bg-surface-alt px-3 py-2.5">
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-accent/45" />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="truncate font-mono text-[length:var(--text-label)] uppercase tracking-[0.12em] text-muted">
            {title}
          </p>
          {subtitle ? (
            <p className="truncate font-sans text-[length:var(--text-small)] text-muted">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="hidden w-[42px] shrink-0 sm:block" aria-hidden />
      </div>
      {toolbar ? (
        <div className="border-b border-line bg-surface px-3 py-2.5 sm:px-4">
          {toolbar}
        </div>
      ) : null}
      <div className="bg-surface p-4 sm:p-5">{children}</div>
    </div>
  );
}
