import type { ReactNode } from "react";
import { Container } from "./Container";

type SectionProps = {
  id?: string;
  /** Optional section key for tooling; not rendered in the UI */
  label?: string;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Section({ id, label, title, children, className = "" }: SectionProps) {
  return (
    <section
      id={id}
      data-section={label}
      className={`border-b border-line py-12 ${className}`}
    >
      <Container>
        {title ? (
          <h2 className="mb-6 font-display text-[length:var(--text-h2)]">{title}</h2>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
