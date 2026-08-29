import {
  FILL_PREVIEW_VIEWPORT,
  type PreviewOpenInput,
  type PreviewSessionSnapshot,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/unstable/reactivity";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  applyPreviewServerSnapshot,
  readThreadPreviewState,
  resetPreviewStateForTests,
} from "~/previewStateStore";
import { selectThreadRightPanelState, useRightPanelStore } from "~/rightPanelStore";

import { addBrowserSurface } from "./addBrowserSurface";

const threadRef = {
  environmentId: "local" as ScopedThreadRef["environmentId"],
  threadId: "thread-1" as ScopedThreadRef["threadId"],
};

const seat = (): PreviewSessionSnapshot => ({
  threadId: threadRef.threadId,
  tabId: "seat",
  navStatus: { _tag: "Success", url: "/vnc/", title: "Agent seat" },
  canGoBack: false,
  canGoForward: false,
  updatedAt: "2026-06-18T19:00:00.000Z",
});

beforeEach(() => {
  resetPreviewStateForTests();
  useRightPanelStore.setState({ byThreadKey: {} });
});

describe("addBrowserSurface", () => {
  it("reuses the seat tab instead of minting a second URL preview", async () => {
    applyPreviewServerSnapshot(threadRef, seat());
    useRightPanelStore.getState().openBrowser(threadRef, "seat");
    const openPreview = vi.fn(async (_input: PreviewOpenInput) => AsyncResult.success(seat()));

    await addBrowserSurface({ threadRef, openPreview: ({ input }) => openPreview(input) });

    expect(openPreview).toHaveBeenCalledWith({
      threadId: "thread-1",
      viewport: FILL_PREVIEW_VIEWPORT,
    });
    expect(Object.keys(readThreadPreviewState(threadRef).sessions)).toEqual(["seat"]);
    expect(
      selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        threadRef,
      ).surfaces.map((surface) => surface.id),
    ).toEqual(["browser:seat"]);
  });
});
