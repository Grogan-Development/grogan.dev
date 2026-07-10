"use client";

import type { ReactNode } from "react";

type DemoCrossfadeProps = {
  /** Active panel key — changing this triggers CSS crossfade */
  activeKey: string | number;
  children: ReactNode;
  className?: string;
};

/**
 * CSS crossfade wrapper for demo step panel content.
 * Prefer remounting children with a stable key so the enter animation runs.
 */
export function DemoCrossfade({ activeKey, children, className = "" }: DemoCrossfadeProps) {
  return (
    <div className={`demo-crossfade ${className}`.trim()} data-active-key={String(activeKey)}>
      <div key={String(activeKey)} className="demo-crossfade-panel">
        {children}
      </div>
    </div>
  );
}
