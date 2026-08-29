import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkspacePageHeader } from "../components/WorkspacePageHeader";
import { useEnvironments } from "../state/environments";
import { APP_DISPLAY_NAME } from "~/branding";
import { WORKSPACE_ROUTE } from "../threadRoutes";
import { readLastWorkspaceId, writeLastWorkspaceId } from "../workspaceIdentity";

function ChatIndexRouteView() {
  const navigate = useNavigate();
  const { environments } = useEnvironments();
  const lastWorkspaceId = readLastWorkspaceId();
  const lastWorkspace = useMemo(
    () => environments.find((environment) => environment.environmentId === lastWorkspaceId) ?? null,
    [environments, lastWorkspaceId],
  );
  const onlyWorkspace = environments.length === 1 ? environments[0] : null;
  const target = lastWorkspace ?? onlyWorkspace ?? null;

  useEffect(() => {
    if (!target) {
      return;
    }
    writeLastWorkspaceId(target.environmentId);
    void navigate({
      to: WORKSPACE_ROUTE,
      params: { workspaceId: target.environmentId },
      replace: true,
    });
  }, [navigate, target]);

  if (target) {
    return null;
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <WorkspacePageHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
              {APP_DISPLAY_NAME}
            </span>
          </div>
        </WorkspacePageHeader>
        <Empty className="flex-1">
          <div className="w-full max-w-lg px-8 py-12">
            <EmptyHeader className="max-w-none">
              <EmptyTitle className="text-foreground text-2xl sm:text-3xl">
                Choose a workspace
              </EmptyTitle>
              <EmptyDescription className="mt-2 text-sm text-muted-foreground/78">
                {environments.length === 0
                  ? "No workspaces are connected yet. Create one from the host control plane, then refresh."
                  : "Pick a workspace to open threads, files, and the agent seat."}
              </EmptyDescription>
              {environments.length > 0 ? (
                <div className="mt-6 flex flex-col items-center gap-2">
                  {environments.map((environment) => (
                    <Button
                      key={environment.environmentId}
                      size="sm"
                      onClick={() => {
                        writeLastWorkspaceId(environment.environmentId);
                        void navigate({
                          to: WORKSPACE_ROUTE,
                          params: { workspaceId: environment.environmentId },
                        });
                      }}
                    >
                      {environment.label || environment.environmentId}
                    </Button>
                  ))}
                </div>
              ) : null}
            </EmptyHeader>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
