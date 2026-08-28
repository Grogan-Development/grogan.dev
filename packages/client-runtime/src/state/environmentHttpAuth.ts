import * as Effect from "effect/Effect";
import { FetchHttpClient, type HttpMethod } from "effect/unstable/http";

import type { PreparedHttpAuthorization } from "../connection/model.ts";

export interface EnvironmentHttpAuthHeaders {
  readonly authorization?: string;
}

/**
 * Primary/local environments with no bearer credential authenticate the
 * browser via a session cookie. Bearer connections send a static token.
 */
export const withEnvironmentCredentials = <A, E, R>(
  authorization: PreparedHttpAuthorization | null,
  request: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  authorization === null
    ? request.pipe(Effect.provideService(FetchHttpClient.RequestInit, { credentials: "include" }))
    : request;

export const buildEnvironmentAuthHeaders = (
  authorization: PreparedHttpAuthorization | null,
  _method: HttpMethod.HttpMethod,
  _url: string,
): EnvironmentHttpAuthHeaders => {
  if (authorization === null) {
    return {};
  }
  return { authorization: `Bearer ${authorization.token}` };
};
