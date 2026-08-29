"use client";

import { useEffect, useRef, useState } from "react";

import { reportHumanDriving } from "~/lib/humanDriving";
import { SEAT_VNC_TITLE, seatVncClientUrl } from "~/lib/seatVnc";

const HEARTBEAT_MS = 5_000;

interface Props {
  visible: boolean;
}

/**
 * Interactive KasmVNC HTML client for the agent seat. Same-origin `/vnc/`
 * (daemon reverse-proxies 127.0.0.1:8444; Caddy will later strip `/w/:id`).
 */
export function KasmVncFrame({ visible }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [src] = useState(() =>
    typeof window === "undefined"
      ? seatVncClientUrl("/")
      : seatVncClientUrl(window.location.pathname),
  );

  useEffect(() => {
    if (!visible) {
      void reportHumanDriving(false);
      return;
    }
    const root = rootRef.current;
    if (root === null) return;
    let focused = false;
    const setFocused = (next: boolean) => {
      if (focused === next) return;
      focused = next;
      void reportHumanDriving(next);
    };
    const onFocusIn = () => {
      setFocused(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && root.contains(next)) return;
      setFocused(false);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") setFocused(false);
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisibility);
    const beat = window.setInterval(() => {
      if (focused && document.visibilityState === "visible") {
        void reportHumanDriving(true);
      }
    }, HEARTBEAT_MS);
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(beat);
      void reportHumanDriving(false);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col" data-seat-vnc tabIndex={0}>
      <iframe
        title={SEAT_VNC_TITLE}
        src={src}
        className="h-full min-h-0 w-full flex-1 border-0 bg-black"
        allow="clipboard-read; clipboard-write; fullscreen"
        referrerPolicy="same-origin"
        data-preview-guest="kasmvnc"
      />
    </div>
  );
}
