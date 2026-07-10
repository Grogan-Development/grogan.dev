"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DemoPanelProps = {
  /** Stable key so the panel body remounts and the enter animation runs on step change. */
  panelKey: string | number;
  children: ReactNode;
  className?: string;
  busy?: boolean;
};

/** Crossfade-friendly content panel for demo step bodies (CSS in globals.css). */
export function DemoPanel({ panelKey, children, className = "", busy = false }: DemoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousPanelKey = useRef(panelKey);

  useEffect(() => {
    if (previousPanelKey.current !== panelKey) {
      panelRef.current?.focus();
    }
    previousPanelKey.current = panelKey;
  }, [panelKey]);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      data-testid="demo-panel"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={busy || undefined}
    >
      <div key={panelKey} className={`demo-crossfade-panel space-y-3 ${className}`}>
        {children}
      </div>
    </div>
  );
}
