"use client";

import type { PreviewAnnotationPayload, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { ComposerImageAttachment } from "~/composerDraftStore";
import { useThreadPreviewState } from "~/previewStateStore";
import { useSeatVncStore } from "~/seatVncStore";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";

import { openPreviewSession } from "./openPreviewSession";
import { PreviewPanelShell, type PreviewPanelMode } from "./PreviewPanelShell";
import { usePreviewSession } from "./usePreviewSession";

interface Props {
  mode: PreviewPanelMode;
  threadRef: ScopedThreadRef;
  tabId?: string | null;
  configuredUrls?: ReadonlyArray<string> | undefined;
  visible: boolean;
  onSendAnnotation?: (
    annotation: PreviewAnnotationPayload,
    image: ComposerImageAttachment | null,
  ) => void;
}

export function PreviewPanel({ mode, threadRef, tabId, visible }: Props) {
  usePreviewSession(threadRef);
  const previewState = useThreadPreviewState(threadRef);
  const open = useAtomCommand(previewEnvironment.open);
  const openedForThread = useRef<string | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!visible) return;
    useSeatVncStore.getState().setSlot(slotRef.current);
    return () => {
      useSeatVncStore.getState().setSlot(null);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const existing = tabId
      ? previewState.sessions[tabId]
      : (previewState.snapshot ??
        (previewState.activeTabId === null
          ? undefined
          : previewState.sessions[previewState.activeTabId]));
    if (existing !== undefined) return;
    if (openedForThread.current === threadRef.threadId) return;
    openedForThread.current = threadRef.threadId;
    void openPreviewSession({
      openPreview: open,
      threadRef,
    });
  }, [
    open,
    previewState.activeTabId,
    previewState.sessions,
    previewState.snapshot,
    tabId,
    threadRef,
    visible,
  ]);

  return (
    <PreviewPanelShell mode={mode}>
      <div ref={slotRef} className="min-h-0 flex-1" data-seat-vnc-slot />
    </PreviewPanelShell>
  );
}
