"use client";

import { useLayoutEffect, useState } from "react";

import { useSeatVncStore } from "~/seatVncStore";

import { KasmVncFrame } from "./KasmVncFrame";

/**
 * Keeps the Kasm iframe mounted at app root. Positioned over the preview
 * panel slot while that surface is open; hidden (not unmounted) otherwise.
 */
export function SeatVncHost() {
  const slot = useSeatVncStore((state) => state.slot);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (slot === null) {
      setRect(null);
      return;
    }
    const measure = () => {
      setRect(slot.getBoundingClientRect());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [slot]);

  const visible = slot !== null && rect !== null && rect.width > 1 && rect.height > 1;

  return (
    <div
      data-seat-vnc-host
      className={visible ? "pointer-events-auto" : "pointer-events-none"}
      style={
        visible && rect !== null
          ? {
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              zIndex: 40,
            }
          : { position: "fixed", width: 0, height: 0, overflow: "hidden", opacity: 0 }
      }
    >
      <KasmVncFrame visible={visible} />
    </div>
  );
}
