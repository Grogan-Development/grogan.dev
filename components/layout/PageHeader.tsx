import { Container } from "./Container";

export type PageHeaderLayout = "standard" | "split" | "compact";

type PageHeaderProps = {
  /** Optional section key for tooling; not rendered in the UI */
  label?: string;
  title: string;
  description?: string;
  layout?: PageHeaderLayout;
};

const layoutClasses: Record<PageHeaderLayout, string> = {
  standard: "max-w-3xl",
  split: "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] lg:items-end lg:gap-12",
  compact: "max-w-2xl",
};

const headerSpacing: Record<PageHeaderLayout, string> = {
  standard: "py-[var(--section-standard)]",
  split: "py-[var(--section-roomy)]",
  compact: "py-[var(--section-compact)]",
};

export function PageHeader({ label, title, description, layout = "standard" }: PageHeaderProps) {
  return (
    <header
      data-section={label}
      data-layout={layout}
      className={`border-b border-line bg-surface ${headerSpacing[layout]}`}
    >
      <Container>
        <div className={layoutClasses[layout]}>
          <h1 className="font-display text-[length:var(--text-h1)]">{title}</h1>
          {description ? (
            <p
              className={`${layout === "split" ? "mt-4 lg:mt-0" : "mt-4"} font-sans text-[length:var(--text-body)] text-muted`}
            >
              {description}
            </p>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
