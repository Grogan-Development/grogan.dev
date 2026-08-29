import {
  AuthAccessTokenResult,
  AuthAccessTokenType,
  AuthAdministrativeScopes,
  AuthBrowserSessionResult,
  AuthPairingCredentialResult,
  AuthPairingLink,
  AuthSessionState,
  AuthWebSocketTicketResult,
  ClientOrchestrationCommand,
  DispatchResult,
  EnvironmentAuthInvalidError,
  EnvironmentInternalError,
  EnvironmentResourceNotFoundError,
  ExecutionEnvironmentDescriptor,
  OrchestrationReadModel,
  OrchestrationShellSnapshot,
  OrchestrationThreadDetailSnapshot,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Fs from "node:fs";
import * as Path from "node:path";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import type { Daemon } from "./daemon.ts";
import { validAttachmentId } from "./daemon.ts";
import {
  getLoomFeature,
  getLoomStatus,
  isLoomConfigured,
  listLoomEvents,
  listLoomFeatures,
  LoomUnavailableError,
} from "./loom.ts";
import { resolveContained } from "./files.ts";
import { SESSION_COOKIE, djb2Hex, nextToken } from "./runtime.ts";

const json = (status: number, body: unknown) => HttpServerResponse.jsonUnsafe(body, { status });

const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

const ASSET_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

const sniffImageMime = (bytes: Buffer): string => {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && bytes.toString("ascii", 0, 3) === "GIF") {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
};

const projectFaviconSvg = (cwd: string): string => {
  const name = Path.basename(cwd) || "workspace";
  const initial = /^[A-Za-z0-9]$/.test(name[0] ?? "") ? (name[0] as string).toUpperCase() : "N";
  const hue = Math.round((Number.parseInt(djb2Hex(name).slice(0, 2), 16) / 255) * 360);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="hsl(${hue} 55% 42%)"/>` +
    `<text x="16" y="22" font-family="system-ui,sans-serif" font-size="17" font-weight="600" ` +
    `fill="#fff" text-anchor="middle">${initial}</text></svg>`
  );
};

const encode = (schema: Schema.Top, value: unknown) =>
  Schema.encodeUnknownSync(schema as never)(value);

const authError = (reason: "missing_credential" | "invalid_credential") =>
  new EnvironmentAuthInvalidError({
    code: "auth_invalid",
    reason,
    traceId: nextToken("tr"),
  });

const notFound = () =>
  new EnvironmentResourceNotFoundError({
    code: "not_found",
    reason: "thread_not_found",
    traceId: nextToken("tr"),
  });

const headerMap = (
  headers: Record<string, string | undefined>,
): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
};

const requireAuth = (daemon: Daemon) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const headers = headerMap(request.headers as Record<string, string | undefined>);
    const cookies = request.cookies as Record<string, string | undefined>;
    if (!daemon.authorizeHttp(headers, cookies)) {
      return yield* authError("missing_credential");
    }
  });

const respondError = (error: unknown) => {
  if (error instanceof EnvironmentAuthInvalidError) {
    return json(401, encode(EnvironmentAuthInvalidError, error));
  }
  if (error instanceof EnvironmentResourceNotFoundError) {
    return json(404, encode(EnvironmentResourceNotFoundError, error));
  }
  if (error instanceof EnvironmentInternalError) {
    return json(500, encode(EnvironmentInternalError, error));
  }
  return json(
    500,
    encode(
      EnvironmentInternalError,
      new EnvironmentInternalError({
        code: "internal_error",
        reason: "internal_error",
        traceId: nextToken("tr"),
      }),
    ),
  );
};

const recover = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.match({
      onFailure: (error) => respondError(error),
      onSuccess: (response) => response as HttpServerResponse.HttpServerResponse,
    }),
  );

export const httpRoutesLayer = (daemon: Daemon) =>
  HttpRouter.use((router) =>
    Effect.gen(function* () {
      yield* router.add("GET", "/healthz", HttpServerResponse.text("ok"));

      const descriptor = json(200, encode(ExecutionEnvironmentDescriptor, daemon.environment()));
      yield* router.add("GET", "/.well-known/nero/environment", descriptor);

      yield* router.add(
        "GET",
        "/api/auth/session",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const headers = headerMap(request.headers as Record<string, string | undefined>);
          const cookies = request.cookies as Record<string, string | undefined>;
          return json(
            200,
            encode(AuthSessionState, daemon.sessionState(daemon.authorizeHttp(headers, cookies))),
          );
        }),
      );

      yield* router.add(
        "POST",
        "/api/auth/websocket-ticket",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, encode(AuthWebSocketTicketResult, daemon.issueTicket()));
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/auth/pairing-token",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json.pipe(Effect.orElseSucceed(() => ({})));
            const label =
              body !== null &&
              typeof body === "object" &&
              "label" in body &&
              typeof body.label === "string"
                ? body.label
                : undefined;
            return json(200, encode(AuthPairingCredentialResult, daemon.issuePairing(label)));
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/auth/pairing-links",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, encode(Schema.Array(AuthPairingLink), daemon.pairingLinks()));
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/auth/browser-session",
        recover(
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json.pipe(Effect.orElseSucceed(() => ({})));
            const credential =
              body !== null &&
              typeof body === "object" &&
              "credential" in body &&
              typeof body.credential === "string"
                ? body.credential
                : "";
            if (!daemon.acceptPairingCredential(credential)) {
              return yield* authError("invalid_credential");
            }
            const issued = daemon.issueSession();
            const result: AuthBrowserSessionResult = {
              authenticated: true,
              scopes: [...AuthAdministrativeScopes],
              sessionMethod: "browser-session-cookie",
              expiresAt: issued.expiresAt,
            };
            return HttpServerResponse.setCookieUnsafe(
              json(200, encode(AuthBrowserSessionResult, result)),
              SESSION_COOKIE,
              issued.token,
              { httpOnly: true, path: "/", sameSite: "lax" },
            );
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/oauth/token",
        recover(
          Effect.gen(function* () {
            const request = yield* HttpServerRequest.HttpServerRequest;
            const contentType = (request.headers["content-type"] ?? "").toLowerCase();
            let subjectToken = "";
            if (contentType.includes("application/x-www-form-urlencoded")) {
              const text = yield* request.text;
              subjectToken = new URLSearchParams(text).get("subject_token") ?? "";
            } else {
              const body = yield* request.json.pipe(Effect.orElseSucceed(() => ({})));
              if (
                body !== null &&
                typeof body === "object" &&
                "subject_token" in body &&
                typeof body.subject_token === "string"
              ) {
                subjectToken = body.subject_token;
              }
            }
            if (!daemon.acceptPairingCredential(subjectToken)) {
              return yield* authError("invalid_credential");
            }
            const issued = daemon.issueSession();
            const result: AuthAccessTokenResult = {
              access_token: issued.token,
              issued_token_type: AuthAccessTokenType,
              token_type: "Bearer",
              expires_in: 86_400,
              scope:
                "orchestration:read orchestration:operate terminal:operate review:write access:read",
            };
            return json(200, encode(AuthAccessTokenResult, result));
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/orchestration/shell",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, encode(OrchestrationShellSnapshot, daemon.shellSnapshot(false)));
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/orchestration/snapshot",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, encode(OrchestrationReadModel, daemon.readModel()));
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/orchestration/threads/:threadId",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const params = yield* HttpRouter.params;
            const threadId = params.threadId;
            if (threadId === undefined) {
              return yield* notFound();
            }
            const snapshot = daemon.threadSnapshot(threadId);
            if (snapshot === undefined) {
              return yield* notFound();
            }
            return json(200, encode(OrchestrationThreadDetailSnapshot, snapshot));
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/orchestration/dispatch",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json;
            const command = Schema.decodeUnknownSync(ClientOrchestrationCommand)(body);
            return json(200, encode(DispatchResult, daemon.dispatch(command)));
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/seat/human-driving",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, { driving: daemon.humanDriving.driving });
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/seat/human-driving",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json.pipe(Effect.orElseSucceed(() => ({})));
            const driving =
              body !== null &&
              typeof body === "object" &&
              "driving" in body &&
              body.driving === true;
            const result = yield* Effect.promise(() => daemon.setHumanDriving(driving));
            return json(200, result);
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/assets/workspace",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const query = new URL(request.url, "http://localhost").searchParams;
            const threadId = query.get("threadId") ?? "";
            const relativePath = query.get("path") ?? "";
            const snapshot = daemon.threadSnapshot(threadId);
            const thread = snapshot?.thread;
            if (thread === undefined || relativePath.length === 0) {
              return yield* notFound();
            }
            // Workspace-file paths are relative to the thread's working
            // directory (worktree when set, else the project root).
            const project = daemon.projectSnapshot(thread.projectId);
            const root = Path.resolve(
              thread.worktreePath ?? project?.workspaceRoot ?? daemon.options.workspaceRoot,
            );
            const contained = resolveContained(root, relativePath);
            if (!contained.ok) {
              return yield* notFound();
            }
            const stat = yield* Effect.try({
              try: () => Fs.statSync(contained.path),
              catch: () => notFound(),
            });
            if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) {
              return yield* notFound();
            }
            const bytes = yield* Effect.try({
              try: () => Fs.readFileSync(contained.path),
              catch: () => notFound(),
            });
            const contentType =
              ASSET_MIME_BY_EXT[Path.extname(contained.path).toLowerCase()] ??
              "application/octet-stream";
            return HttpServerResponse.uint8Array(new Uint8Array(bytes), {
              contentType,
              headers: { "cache-control": "private, max-age=60" },
            });
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/assets/favicon",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const query = new URL(request.url, "http://localhost").searchParams;
            const cwd = query.get("cwd") ?? "";
            const contained = resolveContained(Path.resolve(daemon.options.workspaceRoot), cwd);
            if (!contained.ok) {
              return yield* notFound();
            }
            return HttpServerResponse.uint8Array(
              new Uint8Array(Buffer.from(projectFaviconSvg(contained.path), "utf8")),
              {
                contentType: "image/svg+xml",
                headers: { "cache-control": "private, max-age=300" },
              },
            );
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/router/status",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, daemon.router.status());
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/router/codex/login",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, { url: daemon.router.codexLogin.begin() });
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/router/codex/callback",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const query = new URL(request.url, "http://localhost").searchParams;
            const code = query.get("code") ?? "";
            const state = query.get("state") ?? "";
            if (code.length === 0) {
              return json(400, { error: "missing code" });
            }
            yield* Effect.promise(() => daemon.router.codexLogin.complete(code, state));
            return HttpServerResponse.text(
              "<!doctype html><title>Nero</title><p>Codex signed in. You can close this tab.</p>",
              { contentType: "text/html; charset=utf-8" },
            );
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/router/grok/import",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json;
            daemon.router.importGrokAuth(body);
            return json(200, { signedIn: true });
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/router/codex/import",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const request = yield* HttpServerRequest.HttpServerRequest;
            const body = yield* request.json;
            daemon.router.importCodexTokens(body);
            return json(200, { signedIn: true });
          }),
        ),
      );

      // ——— Loom (FRs + CI events) ———
      const loomNotConfigured = () =>
        json(503, { error: "Loom is not configured on this workspace (LOOM_TOKEN missing)." });
      const loomResponse = (
        outcome: Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>,
      ): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
        Effect.match(outcome, {
          onFailure: (error: unknown) =>
            json(
              503,
              error instanceof LoomUnavailableError
                ? { error: error.message }
                : { error: "Loom request failed." },
            ),
          onSuccess: (response) => response,
        });
      const loomFeatureList = () =>
        loomResponse(Effect.tryPromise(async () => json(200, await listLoomFeatures())));

      yield* router.add(
        "GET",
        "/api/loom/status",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            return json(200, yield* Effect.promise(() => getLoomStatus()));
          }),
        ),
      );

      const loomFeatureDetail = (featureId: string) =>
        loomResponse(Effect.tryPromise(async () => json(200, await getLoomFeature(featureId))));
      const loomEventPage = (limit: number | undefined, since: string | undefined) =>
        loomResponse(
          Effect.tryPromise(async () => json(200, await listLoomEvents({ limit, since }))),
        );

      yield* router.add(
        "GET",
        "/api/loom/features",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            if (!isLoomConfigured()) {
              return loomNotConfigured();
            }
            return yield* loomFeatureList();
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/loom/features/:featureId",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const params = yield* HttpRouter.params;
            if (!isLoomConfigured()) {
              return loomNotConfigured();
            }
            return yield* loomFeatureDetail(params.featureId ?? "");
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/loom/events",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            if (!isLoomConfigured()) {
              return loomNotConfigured();
            }
            const request = yield* HttpServerRequest.HttpServerRequest;
            const query = new URL(request.url, "http://localhost").searchParams;
            const limitRaw = query.get("limit");
            const limit =
              limitRaw !== null && Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : undefined;
            return yield* loomEventPage(limit, query.get("since") ?? undefined);
          }),
        ),
      );

      yield* router.add(
        "GET",
        "/api/attachments/:attachmentId",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const params = yield* HttpRouter.params;
            const attachmentId = params.attachmentId ?? "";
            if (!validAttachmentId(attachmentId)) {
              return yield* notFound();
            }
            const file = Path.join(daemon.options.dataDir, "attachments", attachmentId);
            const bytes = yield* Effect.try({
              try: () => Fs.readFileSync(file),
              catch: () => notFound(),
            });
            const asText = bytes.toString("utf8");
            if (asText.startsWith("data:")) {
              const comma = asText.indexOf(",");
              const header = comma >= 0 ? asText.slice(5, comma) : "";
              const payload =
                comma >= 0 ? Buffer.from(asText.slice(comma + 1), "base64") : Buffer.alloc(0);
              return HttpServerResponse.uint8Array(new Uint8Array(payload), {
                contentType: header.split(";")[0] || "application/octet-stream",
              });
            }
            return HttpServerResponse.uint8Array(new Uint8Array(bytes), {
              contentType: sniffImageMime(bytes),
            });
          }),
        ),
      );

      yield* router.add(
        "POST",
        "/api/attachments/:attachmentId",
        recover(
          Effect.gen(function* () {
            yield* requireAuth(daemon);
            const params = yield* HttpRouter.params;
            const attachmentId = params.attachmentId ?? "";
            if (!validAttachmentId(attachmentId)) {
              return yield* notFound();
            }
            const request = yield* HttpServerRequest.HttpServerRequest;
            const bytes = Buffer.from(yield* request.arrayBuffer);
            if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_UPLOAD_BYTES) {
              return json(413, { error: "attachment size out of range" });
            }
            daemon.writeAttachmentBytes(attachmentId, bytes);
            return json(200, {});
          }),
        ),
      );
    }),
  );
