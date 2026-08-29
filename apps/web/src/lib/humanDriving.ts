import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";

import { HUMAN_DRIVING_PATH } from "./seatVnc";

let inflight: AbortController | undefined;

/**
 * Tell the workspace daemon the human has the VNC tab focused.
 * The daemon holds `$NERO_SEAT_LOCK` (`/run/nero/seat.lock`) so `nero-desktop`
 * click/type queue.
 */
export async function reportHumanDriving(driving: boolean): Promise<void> {
  if (typeof window === "undefined") return;
  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;
  const url = resolvePrimaryEnvironmentHttpUrl(HUMAN_DRIVING_PATH);
  try {
    await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ driving }),
      keepalive: !driving,
      ...(driving ? { signal: controller.signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
  } finally {
    if (inflight === controller) inflight = undefined;
  }
}
