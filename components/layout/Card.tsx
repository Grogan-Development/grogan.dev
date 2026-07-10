import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Optional section key for tooling; not rendered in the UI */
  "data-section"?: string;
};

export function Card({ children, className = "", "data-section": dataSection }: CardProps) {
  return (
    <div
      data-section={dataSection}
      className={`border border-line bg-surface p-5 ${className}`}
    >
      {children}
    </div>
  );
}
