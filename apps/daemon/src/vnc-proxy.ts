import * as Http from "node:http";
import * as Https from "node:https";
import * as Net from "node:net";
import * as Tls from "node:tls";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Socket } from "node:net";

import type { Daemon } from "./daemon.ts";

/** Same-origin path Caddy (and this daemon) use for the KasmVNC HTML client. */
export const VNC_PATH_PREFIX = "/vnc";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const DROP_FROM_UPSTREAM = new Set([
  "x-frame-options",
  "content-security-policy",
  "content-length",
  "transfer-encoding",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
]);

const DROP_TO_KASM = new Set(["x-nero-access", "x-nero-workspace", "x-nero-dial"]);

export const isBearerAuthorization = (value: string | string[] | undefined): boolean => {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim().toLowerCase().startsWith("bearer ");
};

export const stripCookieName = (
  header: string | string[] | undefined,
  name: string,
): string | undefined => {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (raw === undefined || raw.length === 0) return undefined;
  const kept: string[] = [];
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.slice(0, Math.max(0, trimmed.indexOf("="))).trim();
    if (key.toLowerCase() === name.toLowerCase()) continue;
    kept.push(trimmed);
  }
  return kept.length === 0 ? undefined : kept.join("; ");
};

export const pathnameOf = (url: string | undefined): string => {
  if (url === undefined || url.length === 0) return "/";
  const path = url.split("?")[0] ?? "/";
  return path.length === 0 ? "/" : path;
};

/** `/w/:id/vnc` → `/vnc` when Caddy has not yet stripped the workspace prefix. */
export const stripWorkspacePrefix = (path: string): string => {
  const match = path.match(/^\/w\/[^/]+(\/.*)?$/);
  if (match === null) return path;
  const rest = match[1];
  return rest === undefined || rest.length === 0 ? "/" : rest;
};

export const isVncPath = (url: string | undefined): boolean => {
  const path = stripWorkspacePrefix(pathnameOf(url));
  return (
    path === VNC_PATH_PREFIX ||
    path.startsWith(`${VNC_PATH_PREFIX}/`) ||
    path === "/websockify" ||
    path.startsWith("/websockify/")
  );
};

export const stripVncPrefix = (url: string): string => {
  const q = url.indexOf("?");
  const rawPath = q < 0 ? url : url.slice(0, q);
  const search = q < 0 ? "" : url.slice(q);
  const path = stripWorkspacePrefix(rawPath);
  let stripped = path;
  if (path === VNC_PATH_PREFIX) stripped = "/";
  else if (path.startsWith(`${VNC_PATH_PREFIX}/`)) stripped = path.slice(VNC_PATH_PREFIX.length);
  if (!stripped.startsWith("/")) stripped = `/${stripped}`;
  return `${stripped}${search}`;
};

const headerRecord = (headers: IncomingMessage["headers"]): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
};

export const cookiesFromHeader = (
  cookieHeader: string | undefined,
): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  if (cookieHeader === undefined || cookieHeader.length === 0) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (name.length === 0) continue;
    out[name] = part.slice(idx + 1).trim();
  }
  return out;
};

const unauthorized = (res: ServerResponse): void => {
  res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
  res.end("unauthorized");
};

const authorized = (daemon: Daemon, req: IncomingMessage): boolean => {
  const headers = headerRecord(req.headers);
  return daemon.authorizeHttp(headers, cookiesFromHeader(headers.cookie));
};

const targetFromOrigin = (origin: string): URL => new URL(origin);

const requestModule = (target: URL): typeof Http | typeof Https =>
  target.protocol === "https:" ? Https : Http;

const rewriteLocation = (value: string | string[] | undefined, target: URL): string | undefined => {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return `/vnc${value}`;
  try {
    const loc = new URL(value, target.origin);
    if (loc.origin === target.origin) return `/vnc${loc.pathname}${loc.search}`;
  } catch {
    return undefined;
  }
  return undefined;
};

export const handleVncHttp = (daemon: Daemon, req: IncomingMessage, res: ServerResponse): void => {
  if (!authorized(daemon, req)) {
    unauthorized(res);
    return;
  }
  let target: URL;
  try {
    target = targetFromOrigin(daemon.options.vncOrigin);
  } catch {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("vnc origin invalid");
    return;
  }
  const headers: Record<string, string | number | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || DROP_TO_KASM.has(lower)) continue;
    if (lower === "authorization" && isBearerAuthorization(value)) continue;
    if (lower === "cookie") {
      const stripped = stripCookieName(value, "wos-session");
      if (stripped !== undefined) headers[key] = stripped;
      continue;
    }
    headers[key] = value;
  }
  headers.host = target.host;
  const proxy = requestModule(target).request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: stripVncPrefix(req.url ?? "/"),
      method: req.method,
      headers,
    },
    (upstream) => {
      const outHeaders: Record<string, string | number | string[] | undefined> = {};
      for (const [key, value] of Object.entries(upstream.headers)) {
        if (DROP_FROM_UPSTREAM.has(key.toLowerCase())) continue;
        if (key.toLowerCase() === "location") {
          const rewritten = rewriteLocation(value, target);
          if (rewritten !== undefined) {
            outHeaders[key] = rewritten;
            continue;
          }
        }
        outHeaders[key] = value;
      }
      res.writeHead(upstream.statusCode ?? 502, outHeaders);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("kasmvnc unreachable");
  });
  req.pipe(proxy);
};

export const handleVncUpgrade = (
  daemon: Daemon,
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
): void => {
  if (!authorized(daemon, req)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  let target: URL;
  try {
    target = targetFromOrigin(daemon.options.vncOrigin);
  } catch {
    socket.destroy();
    return;
  }
  const port =
    target.port.length > 0 ? Number(target.port) : target.protocol === "https:" ? 443 : 80;
  let upstream: Socket;
  const onConnect = () => {
    const path = stripVncPrefix(req.url ?? "/");
    let headBuf = `${req.method ?? "GET"} ${path} HTTP/${req.httpVersion}\r\n`;
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const lower = key.toLowerCase();
      if (DROP_TO_KASM.has(lower)) continue;
      if (lower === "authorization" && isBearerAuthorization(value)) continue;
      let rendered = Array.isArray(value) ? value.join(", ") : value;
      if (lower === "cookie") {
        const stripped = stripCookieName(value, "wos-session");
        if (stripped === undefined) continue;
        rendered = stripped;
      }
      if (lower === "host") {
        headBuf += `Host: ${target.host}\r\n`;
        continue;
      }
      headBuf += `${key}: ${rendered}\r\n`;
    }
    if (!("host" in req.headers)) headBuf += `Host: ${target.host}\r\n`;
    headBuf += "\r\n";
    upstream.write(headBuf);
    if (head.length > 0) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  };
  upstream =
    target.protocol === "https:"
      ? Tls.connect({ port, host: target.hostname, servername: target.hostname }, onConnect)
      : Net.connect(port, target.hostname, onConnect);
  upstream.on("error", () => {
    socket.destroy();
  });
  socket.on("error", () => {
    upstream.destroy();
  });
};

export const attachVncProxy = (server: Server, daemon: Daemon): void => {
  const rawEmit = server.emit.bind(server);
  server.emit = ((event: string, ...args: unknown[]) => {
    if (event === "request") {
      const req = args[0] as IncomingMessage;
      if (isVncPath(req.url)) {
        handleVncHttp(daemon, req, args[1] as ServerResponse);
        return true;
      }
    }
    if (event === "upgrade") {
      const req = args[0] as IncomingMessage;
      if (isVncPath(req.url)) {
        handleVncUpgrade(
          daemon,
          req,
          args[1] as Socket,
          (args[2] as Buffer | undefined) ?? Buffer.alloc(0),
        );
        return true;
      }
    }
    return rawEmit(event, ...args);
  }) as Server["emit"];
};

export const createNeroHttpServer = (daemon: Daemon): typeof Http.createServer =>
  ((...args: Parameters<typeof Http.createServer>) => {
    const server = Http.createServer(...args);
    attachVncProxy(server, daemon);
    return server;
  }) as typeof Http.createServer;
