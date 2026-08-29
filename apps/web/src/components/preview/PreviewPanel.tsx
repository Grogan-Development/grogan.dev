"use client";

import type { PreviewAnnotationPayload, ScopedThreadRef } from "@t3tools/contracts";

import type { ComposerImageAttachment } from "~/composerDraftStore";

import { PreviewPanelShell, type PreviewPanelMode } from "./PreviewPanelShell";

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

export function PreviewPanel({ mode }: Props) {
  return (
    <PreviewPanelShell mode={mode}>
      {/* PR 7 embeds interactive KasmVNC of the agent seat in this tab. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Agent seat preview will load here. KasmVNC is embedded in PR 7.
        </p>
      </div>
    </PreviewPanelShell>
  );
}
