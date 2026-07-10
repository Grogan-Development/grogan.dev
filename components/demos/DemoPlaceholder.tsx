type DemoPlaceholderVariant = "upload" | "image" | "file" | "proof" | "photo";

type DemoPlaceholderProps = {
  label: string;
  hint?: string;
  variant?: DemoPlaceholderVariant;
  tall?: boolean;
  className?: string;
};

/** Structured empty-state panel for demo media / upload slots. */
export function DemoPlaceholder({
  label,
  hint,
  variant = "image",
  tall = false,
  className = "",
}: DemoPlaceholderProps) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center gap-2.5 border border-dashed border-line bg-surface-alt/70 px-4 text-center",
        tall ? "min-h-40 py-8" : "min-h-28 py-6",
        className,
      ].join(" ")}
    >
      <PlaceholderIcon variant={variant} />
      <div className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
        {hint ? <p className="max-w-[16rem] text-xs leading-snug text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function PlaceholderIcon({ variant }: { variant: DemoPlaceholderVariant }) {
  const common = "size-8 text-muted/70";

  switch (variant) {
    case "upload":
      return (
        <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path
            d="M16 22V8M16 8l-5 5M16 8l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
          <path
            d="M6 22v4h20v-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      );
    case "file":
      return (
        <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden>
          <path
            d="M9 5h10l6 6v16H9V5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
          <path d="M19 5v6h6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M13 17h6M13 21h8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "proof":
      return (
        <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect
            x="5"
            y="7"
            width="22"
            height="18"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M5 12h22" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 20l2.5 2.5L20 17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      );
    case "photo":
      return (
        <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect
            x="4"
            y="8"
            width="24"
            height="16"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="14" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 20l6-5 5 4 4-3 9 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </svg>
      );
    case "image":
      return (
        <svg className={common} viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect
            x="5"
            y="7"
            width="22"
            height="18"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 21l6-5 4 3 3-2 9 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </svg>
      );
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}
