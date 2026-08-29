/**
 * Backend paths the web dev server proxies in single-origin browser dev.
 *
 * Two consumers must agree on this list: the Vite proxy map
 * (apps/web/vite.config.ts) that forwards these to the backend, and any
 * catch-all that 404s them instead of serving index.html.
 */
export const DEV_PROXIED_PATH_PREFIXES = [
  "/api",
  "/oauth",
  "/.well-known",
  "/ws",
  "/vnc",
  "/websockify",
] as const;

const WORKSPACE_DAEMON_PATH =
  /^\/w\/[^/]+(\/(?:api|oauth|\.well-known|ws|vnc|websockify)(?:\/.*)?)$/;

/** `/w/:id/vnc/…` → `/vnc/…` so the SPA prefix still hits the daemon. */
export function stripWorkspaceDaemonPrefix(url: string): string {
  const q = url.search(/[?#]/);
  const path = q < 0 ? url : url.slice(0, q);
  const rest = q < 0 ? "" : url.slice(q);
  const match = path.match(WORKSPACE_DAEMON_PATH);
  if (match === null || match[1] === undefined) return url;
  return `${match[1]}${rest}`;
}

export function isDevProxiedPath(pathname: string): boolean {
  const stripped = stripWorkspaceDaemonPrefix(pathname);
  const path = stripped.split("?")[0] ?? stripped;
  return DEV_PROXIED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
