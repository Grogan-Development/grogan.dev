import { FolderClosedIcon } from "lucide-react";
import { memo } from "react";

import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useRightPanelStore } from "~/rightPanelStore";

/**
 * "Open" opens the workspace file browser in the right panel. The T3 control
 * launched a desktop editor over SSH/deep-links; Nero is web-only with a
 * remote workspace, so the browser surface IS the editor.
 */
export const OpenInPicker = memo(function OpenInPicker({
  threadRef,
  openInCwd,
  compact = false,
}: {
  threadRef: { readonly environmentId: EnvironmentId; readonly threadId: ThreadId } | null;
  openInCwd: string | null;
  compact?: boolean;
}) {
  const disabled = threadRef === null || openInCwd === null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={compact ? "Open workspace files" : undefined}
            aria-disabled={disabled}
            className="ps-[8.5px]"
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              if (threadRef === null || openInCwd === null) return;
              useRightPanelStore.getState().open(threadRef, "files");
            }}
          >
            <FolderClosedIcon aria-hidden className="size-3.5" />
            <span
              className={
                compact
                  ? "sr-only"
                  : "sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5"
              }
            >
              Open
            </span>
          </Button>
        }
      >
        <TooltipPopup>Open workspace files</TooltipPopup>
      </TooltipTrigger>
    </Tooltip>
  );
});
