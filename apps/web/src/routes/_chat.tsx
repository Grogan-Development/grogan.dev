import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import { useEffect, useMemo, useRef } from "react";

import { isCommandPaletteOpen } from "../commandPaletteBus";
import { useClientSettings } from "../hooks/useSettings";
import { openCommandPalette } from "../commandPaletteBus";
import { useProjects } from "../state/entities";
import { usePrimaryEnvironmentId } from "../state/environments";
import { selectProjectGroupingSettings } from "../logicalProject";
import { buildSidebarProjectSnapshots } from "../sidebarProjectGrouping";
import { dispatchPreviewAction } from "../components/preview/previewActionBus";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../lib/chatThreadActions";
import {
  correctiveUnpinNeroWorkspace,
  isNeroHostAuthError,
  NERO_LOGIN_PATH,
  neroWorkspaceIdFromPath,
  pinNeroWorkspace,
  unpinNeroWorkspace,
} from "../lib/neroHost";
import { isPreviewFocused } from "../lib/previewFocus";
import { isTerminalFocused } from "../lib/terminalFocus";
import { resolveShortcutCommand } from "../keybindings";
import { selectThreadTerminalUiState, useTerminalUiStateStore } from "../terminalUiStateStore";
import { selectActiveRightPanel, useRightPanelStore } from "../rightPanelStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { primaryServerKeybindingsAtom } from "~/state/server";

const WORKSPACE_HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * The host idle-stops a workspace ~5 minutes after it stops seeing a
 * "connected" heartbeat, so every mounted /w/:id route pins its workspace:
 * POST /api/workspaces/:id/heartbeat {"connected":true} every 30s while the
 * route is mounted and the tab is visible. Hidden/closed tabs (and SPA
 * navigation away) unpin via sendBeacon so scale-to-zero stays honest. The
 * picker route ("/") never pins — listing must not keep anything awake.
 */
function NeroWorkspaceHeartbeat({ workspaceId }: { readonly workspaceId: string }) {
  const hasSurfacedAuthErrorRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let isStopped = false;
    // Monotonic watermark for the unpin-vs-inflight-pin race: an unpin
    // beacon can reach the host BEFORE a pin that is still in flight, and
    // the host applies last-write-wins — which would re-pin a hidden or
    // closed tab for the whole zombie grace. Any unpin bumps the watermark;
    // when a pin started before it settles, a corrective unpin follows.
    let seq = 0;
    let unpinRequestedAt = -1;
    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const pin = async () => {
      const startedAt = ++seq;
      try {
        await pinNeroWorkspace(workspaceId);
      } catch (error) {
        if (isStopped || !isNeroHostAuthError(error)) {
          // Transient failures keep the loop; the next tick retries.
          return;
        }
        // AuthKit session gone: stop pinning and surface sign-in once.
        isStopped = true;
        stopPolling();
        if (hasSurfacedAuthErrorRef.current) {
          return;
        }
        hasSurfacedAuthErrorRef.current = true;
        toastManager.add(
          stackedThreadToast({
            type: "warning",
            title: "Nero session expired",
            description: "Sign in again or this workspace will stop until then.",
            actionVariant: "outline",
            actionProps: {
              children: "Sign in",
              onClick: () => {
                window.location.assign(NERO_LOGIN_PATH);
              },
            },
          }),
        );
        return;
      }
      if (unpinRequestedAt >= startedAt && !isStopped) {
        correctiveUnpinNeroWorkspace(workspaceId);
      }
    };
    const unpin = () => {
      // The unpin consumes a sequence number: a pin that starts afterwards
      // (e.g. visible again) outranks it and must not be corrected away.
      unpinRequestedAt = ++seq;
      unpinNeroWorkspace(workspaceId);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        unpin();
      } else if (!isStopped) {
        void pin();
      }
    };
    // A tab that mounts hidden (background restore) must not pin: the
    // interval skips hidden tabs, so one stray pin would last 20 minutes.
    if (document.visibilityState === "visible" && !isStopped) {
      void pin();
    }
    timer = setInterval(() => {
      if (isStopped || document.visibilityState !== "visible") {
        return;
      }
      void pin();
    }, WORKSPACE_HEARTBEAT_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", unpin);
    return () => {
      isStopped = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", unpin);
      // Leaving the workspace route inside the SPA unpins promptly too.
      unpin();
    };
  }, [workspaceId]);

  return null;
}

/** Renders the heartbeat only on workspace routes; the picker route never pins. */
function NeroWorkspaceHeartbeatWatcher() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const workspaceId = neroWorkspaceIdFromPath(pathname);
  return workspaceId === null ? null : <NeroWorkspaceHeartbeat workspaceId={workspaceId} />;
}

function ChatRouteGlobalShortcuts() {
  const clearSelection = useThreadSelectionStore((state) => state.clearSelection);
  const selectedThreadKeysSize = useThreadSelectionStore((state) => state.selectedThreadKeys.size);
  const { activeDraftThread, activeThread, defaultProjectRef, handleNewThread, routeThreadRef } =
    useHandleNewThread();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projects = useProjects();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const terminalOpen = useTerminalUiStateStore((state) =>
    routeThreadRef
      ? selectThreadTerminalUiState(state.terminalUiStateByThreadKey, routeThreadRef).terminalOpen
      : false,
  );
  // The `previewOpen` shortcut-context flag here uses the store-only value;
  // the URL-aware arbitration lives inside ChatView's `onTogglePreview`,
  // which we invoke via the action bus to avoid duplicating the rule.
  const previewOpen = useRightPanelStore((state) =>
    routeThreadRef
      ? selectActiveRightPanel(state.byThreadKey, routeThreadRef) === "preview"
      : false,
  );
  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          terminalOpen,
          previewFocus: isPreviewFocused(),
          previewOpen,
        },
      });

      if (isCommandPaletteOpen()) {
        return;
      }

      if (event.key === "Escape" && selectedThreadKeysSize > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (command === "chat.newLocal") {
        event.preventDefault();
        event.stopPropagation();
        void startNewThreadFromContext({
          activeDraftThread,
          activeThread: activeThread ?? undefined,
          defaultProjectRef,
          handleNewThread,
        });
        return;
      }

      if (command === "chat.new") {
        event.preventDefault();
        event.stopPropagation();
        // Nero is single-project: new threads are created in the workspace
        // project directly.
        void startNewThreadFromContext({
          activeDraftThread,
          activeThread: activeThread ?? undefined,
          defaultProjectRef,
          handleNewThread,
        });
        return;
      }

      if (command === "preview.toggle") {
        event.preventDefault();
        event.stopPropagation();
        if (!routeThreadRef) return;
        dispatchPreviewAction("toggle-panel");
        return;
      }

      // The remaining preview commands only fire when the panel is the
      // currently-focused tenant. The `when: previewFocus` rule already
      // gates this, but defend against the keybinding being misconfigured.
      if (
        command === "preview.refresh" ||
        command === "preview.focusUrl" ||
        command === "preview.zoomIn" ||
        command === "preview.zoomOut" ||
        command === "preview.resetZoom"
      ) {
        event.preventDefault();
        event.stopPropagation();
        const action =
          command === "preview.refresh"
            ? "refresh"
            : command === "preview.focusUrl"
              ? "focus-url"
              : command === "preview.zoomIn"
                ? "zoom-in"
                : command === "preview.zoomOut"
                  ? "zoom-out"
                  : "reset-zoom";
        dispatchPreviewAction(action);
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    activeDraftThread,
    activeThread,
    clearSelection,
    handleNewThread,
    keybindings,
    defaultProjectRef,
    previewOpen,
    routeThreadRef,
    selectedThreadKeysSize,
    terminalOpen,
  ]);

  return null;
}

function ChatRouteLayout() {
  return (
    <>
      <NeroWorkspaceHeartbeatWatcher />
      <ChatRouteGlobalShortcuts />
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
