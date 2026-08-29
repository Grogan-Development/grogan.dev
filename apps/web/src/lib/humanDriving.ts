import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";

import { HUMAN_DRIVING_PATH } from "./seatVnc";

/**
 * Tell the workspace daemon the human has the VNC tab focused.
 * The daemon holds `$NERO_SEAT_LOCK` so `nero-desktop` click/type queue.
 */
export async function reportHumanDriving(driving: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  const url = resolvePrimaryEnvironmentHttpUrl(HUMAN_DRIVING_PATH);
  try {
    await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ driving }),
      keepalive: !driving,
    });
  } catch {
    // Daemon down or proxy not wired yet; inject will not queue.
  }
}
