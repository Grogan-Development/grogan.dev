import { useId, type ReactNode } from "react";
import { Container } from "./Container";

export type SectionTone = "paper" | "surface" | "wash";
export type SectionDensity = "compact" | "standard" | "roomy";
export type SectionBorder = "none" | "top" | "bottom" | "both";

type SectionProps = {
  id?: string;
  /** Optional section key for tooling; not rendered in the UI */
  label?: string;
  title?: string;
  children: ReactNode;
  className?: string;
  tone?: SectionTone;
  density?: SectionDensity;
  border?: SectionBorder;
};

const toneClasses: Record<SectionTone, string> = {
  paper: "",
  surface: "bg-surface",
  wash: "bg-[var(--wash-blue)]",
};

const densityClasses: Record<SectionDensity, string> = {
  compact: "py-[var(--section-compact)]",
  standard: "py-[var(--section-standard)]",
  roomy: "py-[var(--section-roomy)]",
};

const borderClasses: Record<SectionBorder, string> = {
  none: "",
  top: "border-t border-line",
  bottom: "border-b border-line",
  both: "border-y border-line",
};

export function Section({
  id,
  label,
  title,
  children,
  className = "",
  tone = "paper",
  density = "standard",
  border = "bottom",
}: SectionProps) {
  const titleId = useId();

  return (
    <section
      id={id}
      data-section={label}
      data-tone={tone}
      data-density={density}
      data-border={border}
      aria-labelledby={title ? titleId : undefined}
      className={`${borderClasses[border]} ${toneClasses[tone]} ${densityClasses[density]} ${className}`}
    >
      <Container>
        {title ? (
          <h2 id={titleId} className="mb-6 font-display text-[length:var(--text-h2)]">
            {title}
          </h2>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
