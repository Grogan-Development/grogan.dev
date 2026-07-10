type UiThumbnailProps = {
  title: string;
  className?: string;
};

/** Lightweight fake UI chrome for example hub cards. */
export function UiThumbnail({ title, className = "" }: UiThumbnailProps) {
  return (
    <div
      className={`overflow-hidden border border-line bg-surface-alt ${className}`}
      aria-hidden
    >
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-2.5 py-1.5">
        <span className="size-1.5 rounded-full bg-line" />
        <span className="size-1.5 rounded-full bg-line" />
        <span className="size-1.5 rounded-full bg-accent/50" />
        <span className="ml-1 truncate font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
          {title}
        </span>
      </div>
      <div className="grid aspect-[16/10] grid-cols-[0.35fr_1fr] gap-2 p-3">
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-line/80" />
          <div className="h-2 w-4/5 bg-line/60" />
          <div className="h-2 w-3/5 bg-line/50" />
          <div className="mt-3 h-8 w-full border border-accent/40 bg-accent/10" />
        </div>
        <div className="space-y-2">
          <div className="h-12 border border-line bg-surface" />
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-6 bg-line/50" />
            <div className="h-6 bg-line/40" />
            <div className="h-6 border border-accent/25 bg-accent/5" />
          </div>
          <div className="h-2 w-2/3 bg-line/60" />
        </div>
      </div>
    </div>
  );
}
