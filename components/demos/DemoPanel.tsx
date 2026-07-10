import type { ReactNode } from "react";

type DemoPanelProps = {
  /** Stable key so React remounts and the enter animation runs on step change. */
  panelKey: string | number;
  children: ReactNode;
  className?: string;
};

/** Crossfade-friendly content panel for demo step bodies (CSS in globals.css). */
export function DemoPanel({ panelKey, children, className = "" }: DemoPanelProps) {
  return (
    <div key={panelKey} className={`demo-crossfade-panel space-y-3 ${className}`}>
      {children}
    </div>
  );
}
