import { SidebarInset } from "../ui/sidebar";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "../WorkspaceBreadcrumb";
import { WorkspacePageContainer } from "../WorkspacePageContainer";
import { WorkspacePageHeader } from "../WorkspacePageHeader";

export function UsagePage() {
  return (
    <SidebarInset>
      <WorkspacePageHeader>
        <WorkspaceBreadcrumb ariaLabel="Usage breadcrumb">
          <WorkspaceBreadcrumbItem current>
            <h1>Usage</h1>
          </WorkspaceBreadcrumbItem>
        </WorkspaceBreadcrumb>
      </WorkspacePageHeader>
      <WorkspacePageContainer>
        <p className="text-sm text-muted-foreground">
          Usage is hidden until Nero has a usage contract.
        </p>
      </WorkspacePageContainer>
    </SidebarInset>
  );
}
