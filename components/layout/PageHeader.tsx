import { Container } from "./Container";

type PageHeaderProps = {
  /** Optional section key for tooling; not rendered in the UI */
  label?: string;
  title: string;
  description?: string;
};

export function PageHeader({ label, title, description }: PageHeaderProps) {
  return (
    <header data-section={label} className="border-b border-line bg-surface py-12">
      <Container>
        <h1 className="font-display text-[length:var(--text-h1)]">{title}</h1>
        {description ? (
          <p className="mt-4 max-w-3xl font-sans text-[length:var(--text-body)] text-muted">
            {description}
          </p>
        ) : null}
      </Container>
    </header>
  );
}
