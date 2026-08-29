import { createServer } from "node:http";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";
import { NodeHttpServer } from "@effect/platform-node";
import { WsRpcGroup } from "@t3tools/contracts";

import { Daemon } from "./daemon.ts";
import { httpRoutesLayer } from "./http.ts";
import { makeRpcLayer } from "./rpc.ts";
import type { DaemonOptions } from "./runtime.ts";
import { EnvironmentAuthInvalidError } from "@t3tools/contracts";
import { nextToken } from "./runtime.ts";

const wsUnauthorized = () =>
  HttpServerResponse.schemaJson(EnvironmentAuthInvalidError)(
    new EnvironmentAuthInvalidError({
      code: "auth_invalid",
      reason: "invalid_credential",
      traceId: nextToken("tr"),
    }),
    { status: 401 },
  );

export const daemonLayer = (options: DaemonOptions) => {
  const daemon = new Daemon(options);

  const ProtocolLive = Layer.effect(RpcServer.Protocol)(
    Effect.gen(function* () {
      const { httpEffect, protocol } = yield* RpcServer.makeProtocolWithHttpEffectWebsocket;
      const router = yield* HttpRouter.HttpRouter;
      yield* router.add(
        "GET",
        "/ws",
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const headers = request.headers as Record<string, string | undefined>;
          const cookies = request.cookies as Record<string, string | undefined>;
          if (!daemon.authorizeWebsocket(request.url, headers, cookies)) {
            return yield* wsUnauthorized();
          }
          return yield* httpEffect;
        }),
      );
      return protocol;
    }),
  ).pipe(Layer.provide(RpcSerialization.layerJson));

  const RpcLive = RpcServer.layer(WsRpcGroup, {
    spanPrefix: "nero",
    disableFatalDefects: true,
  }).pipe(Layer.provide(makeRpcLayer(daemon)), Layer.provide(ProtocolLive));

  const App = Layer.mergeAll(httpRoutesLayer(daemon), RpcLive, HttpRouter.cors());

  return {
    daemon,
    layer: HttpRouter.serve(App).pipe(
      Layer.provide(
        NodeHttpServer.layer(createServer, {
          host: options.host,
          port: options.port,
        }),
      ),
    ),
  };
};
