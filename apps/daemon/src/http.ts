import {
  AuthAccessTokenType,
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
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import type { Daemon } from "./daemon.ts";
import { SESSION_COOKIE, nextToken } from "./runtime.ts";

const json = (status: number, body: unknown) => HttpServerResponse.jsonUnsafe(body, { status });

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
      return yield* Effect.fail(authError("missing_credential"));
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
      yield* router.add("GET", "/.well-known/t3/environment", descriptor);
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
        "/api/auth/browser-session",
        Effect.gen(function* () {
          const issued = daemon.issueSession();
          return HttpServerResponse.setCookieUnsafe(
            json(200, encode(AuthSessionState, daemon.sessionState(true))),
            SESSION_COOKIE,
            issued.token,
            { httpOnly: true, path: "/", sameSite: "lax" },
          );
        }),
      );

      yield* router.add(
        "POST",
        "/oauth/token",
        Effect.gen(function* () {
          const issued = daemon.issueSession();
          return json(200, {
            access_token: issued.token,
            issued_token_type: AuthAccessTokenType,
            token_type: "Bearer",
            expires_in: 86_400,
            scope: "orchestration:read orchestration:operate terminal:operate review:write",
          });
        }),
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
              return yield* Effect.fail(notFound());
            }
            const snapshot = daemon.threadSnapshot(threadId);
            if (snapshot === undefined) {
              return yield* Effect.fail(notFound());
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
    }),
  );
