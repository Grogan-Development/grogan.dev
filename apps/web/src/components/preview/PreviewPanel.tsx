"use client";

import type { PreviewAnnotationPayload, ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useRef } from "react";

import type { ComposerImageAttachment } from "~/composerDraftStore";
import { useThreadPreviewState } from "~/previewStateStore";
import { previewEnvironment } from "~/state/preview";
import { useAtomCommand } from "~/state/use-atom-command";

import { KasmVncFrame } from "./KasmVncFrame";
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
      <KasmVncFrame visible={visible} />
    </PreviewPanelShell>
  );
}
