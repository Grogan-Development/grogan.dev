import { RouterProvider } from "@tanstack/react-router";

import { PreviewAutomationHosts } from "./components/preview/PreviewAutomationHosts";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";

/**
 * Owns renderer-wide providers. Preview automation hosts sit outside the
 * router so a later KasmVNC guest (PR 7) can survive route transitions.
 */
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
      <PreviewAutomationHosts />
    </AppAtomRegistryProvider>
  );
}
