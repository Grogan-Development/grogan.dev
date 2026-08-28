# 02 — `@t3tools/client-runtime` for Nero

Standalone map of T3 Code’s shared client runtime. Nero copies and adapts this package; there is no T3 server and no T3 Connect. This document is not a Nero codebase dump.

Source: `/tmp/t3code-upstream/packages/client-runtime`. Public API is subpath-only (no root export). Apps (web, mobile, desktop) provide platform services; this package owns connection supervision, RPC, and Atom constructors.

**Nero rule of thumb:** keep the *shape* (registry → supervisor → prepared connection → `/ws` session → Atom families + HTTP snapshot loaders). Delete cloud/relay/T3 Connect. Retarget contracts (`WsRpcGroup`, `EnvironmentHttpApi`, `ORCHESTRATION_WS_METHODS`) at Nero’s own server.

```
platform services (persistence, capabilities, fetch, WebSocket)
        │
        ▼
 Connection.layer
   resolver → driver → RpcSessionFactory → EnvironmentSupervisor
   EnvironmentRegistry (one supervisor per environment)
        │
        ├── EnvironmentRpc.request / subscribe / runStream  (Effect RPC over /ws)
        ├── HTTP snapshots  (/api/orchestration/shell, /threads/:id, /api/auth/session)
        └── Atom.runtime families  (shell, threads, server, vcs, …)
```

---

## 1. Connection

Files: `packages/client-runtime/src/connection/`.

### Targets (`model.ts`)

| Tag | How Nero should treat it |
| --- | --- |
| `PrimaryConnectionTarget` | **Keep.** Same-origin / local host. `httpBaseUrl` + `wsBaseUrl`. Cookie auth when no bearer. |
| `BearerConnectionTarget` | **Keep.** Pairing / remote LAN. Profile stores URLs; credential store holds access token. |
| `SshConnectionTarget` | **Keep if Nero has desktop SSH remotes; else delete.** Needs `SshEnvironmentGateway` from the desktop shell. |
| `RelayConnectionTarget` | **Delete.** T3 Connect managed tunnel. No profile; identity is `environmentId` only. |

`PersistedConnectionTarget` is bearer | relay | ssh (primary is platform-managed, not user-persisted). Drop `RelayConnectionTarget` from that union.

Transient reasons include `"relay-unavailable"` — delete with relay. Keep `"network" | "timeout" | "transport" | "endpoint-unavailable" | "remote-unavailable"`.

`PreparedConnection` is the lease the rest of the stack uses:

- `httpBaseUrl`, `socketUrl` (already includes `/ws` + `wsTicket` + client params)
- `httpAuthorization`: `null` (cookie), `{ _tag: "Bearer", token }`, or `{ _tag: "Dpop", accessToken }`
- DPoP variant is **relay-only → delete** unless Nero independently wants DPoP

### Catalog (`catalog.ts`)

Keep: `BearerConnectionProfile`, `SshConnectionProfile`, `BearerConnectionCredential`, `PrimaryConnectionRegistration`, `BearerConnectionRegistration`, `SshConnectionRegistration`, `PlatformConnectionRegistration`.

Delete: `RelayConnectionRegistration`. `connectionRegistrationCatalogEntry` currently treats relay like primary (no profile). After delete, that branch goes away.

`PlatformConnectionRegistration` = primary + extra loopback backends (desktop WSL-style). Nero can keep that for “local + extra local servers.”

### Resolver (`resolver.ts`)

`ConnectionResolver.prepare(entry) → PreparedConnection`. Four brokers:

1. **Primary** (`makePrimaryBroker`): if `PrimaryEnvironmentAuth.bearerToken` is none, build `socketUrl` from `wsBaseUrl` (pathname `/ws` if empty) via `appendClientConnectionParams(..., "direct")`, `httpAuthorization: null`. If a bearer exists, `authorizeBearer`.
2. **Bearer**: load profile + credential, `authorizeBearer` with `connectionMethod: "direct"`.
3. **Relay** (`makeRelayBroker`): **delete.** `CloudSession.clerkToken` + `RelayDeviceIdentity.deviceId` + `ManagedRelayClient.connectEnvironment` + `authorizeDpop`.
4. **SSH**: `SshEnvironmentGateway.prepare` then `authorizeBearer` with `connectionMethod: "ssh"`.

### Driver (`driver.ts`)

Thin: `reportProgress({ stage: "preparing" })` → `resolver.prepare` → `"opening"` → `RpcSessionFactory.connect(prepared)` → `"synchronizing"` → `session.ready` → `{ prepared, session }`.

Keep as-is. Progress stages feed supervisor UI.

### Supervisor (`supervisor.ts`) — retry owner

One `EnvironmentSupervisor` per catalog entry. Public:

- `target`, `state`, `session`, `prepared` (`SubscriptionRef`s)
- `connect` / `disconnect` / `retryNow`

Phases: `available` → `connecting` (`preparing|opening|synchronizing`) → `connected` | `backoff` | `offline` | `blocked`.

**Retry (Nero must copy this, not Effect RPC retry):**

- Socket protocol retry is **disabled** in `rpc/session.ts` (`retryTransientErrors: false`, `retryPolicy: Schedule.recurs(0)`).
- Supervisor ladder: `RETRY_DELAYS_MS = [3000, 4000, 8000, 16000]`.
- Establishment timeout: 15s. Probe timeout: 15s (3s on mobile `application-active-probe`).
- Stable connection ≥ 30s (`BACKOFF_RESET_AFTER_MS`) resets the ladder.
- `ConnectionBlockedError` → `blocked` (no auto retry except app-foreground wakeup).
- Transient failure → `backoff` with `retryAt`.
- Failed wake probe skips first backoff rung.
- `application-active-reconnect` replaces a live lease immediately (mobile OS can freeze sockets without a close).
- Relay-only: `credentials-changed` wakeup restarts the lease. **Delete that branch.**

`connectionProjectionPhase` maps supervisor phases to shell/thread UI: connecting → `synchronizing`, connected → `ready`, else `disconnected`.

### Registry (`registry.ts`)

`EnvironmentRegistry` loads persisted targets, starts a supervisor per entry, reconciles `PlatformConnectionSource` emissions, exposes `run` / `runStream` / `followStream` (inject `EnvironmentSupervisor` into an effect).

Delete: `removeRelayEnvironments`. Keep `retryNow`, `register`, `remove`, `reconcilePlatform`.

### Layer (`layer.ts`)

```
RemoteEnvironmentAuthorization
  → ConnectionResolver
  → ConnectionDriver (+ RpcSession.layer)
  → EnvironmentRegistry
  → ConnectionOnboarding
merge + RelayEnvironmentDiscovery.layer   // DELETE this merge
startup: registry.start + platformSource.registrations → reconcilePlatform
```

Nero layer = same minus `RelayEnvironmentDiscovery`.

### Onboarding (`onboarding.ts`)

**Keep pairing.** `registerPairing`: parse pairing URL (`@t3tools/shared/remote` `resolveRemotePairingTarget`) → `GET /.well-known/t3/environment` → `POST /oauth/token` (`bootstrapRemoteBearerSession`) → persist `BearerConnectionRegistration`.

SSH register / bearer label-url update: keep if those connection kinds survive.

### Supporting files

| File | Nero |
| --- | --- |
| `connectivity.ts` | Keep. Platform supplies online/offline. |
| `wakeups.ts` | Keep. Drop `"credentials-changed"` if no cloud account. |
| `credentialStore.ts` / `profileStore.ts` | Keep. Platform-backed KV. |
| `presentation.ts` | Keep. Maps supervisor state → UI phase/text. |
| `errors.ts` | Keep profile/credential/mismatch. **Delete** `mapManagedRelayError`, `relayProtectedError`, DPoP mapping (imports `@t3tools/contracts/relay`). |
| `index.ts` | Re-export remaining. |

App wiring (do not copy blindly, but this is the consumer shape): `apps/web/src/connection/runtime.ts` merges `Connection.layer` with snapshot loader layers and `Atom.runtime`.

---

## 2. Auth bootstrap (HTTP, then `/ws`)

Files: `packages/client-runtime/src/authorization/`, `environment/descriptor.ts`, `state/environmentHttpAuth.ts`, `state/session.ts`.

### Environment identity

`fetchRemoteEnvironmentDescriptor` (`environment/descriptor.ts`) → `GET /.well-known/t3/environment`. **Adapt path/branding** (`t3` in the well-known URL). Nero still needs a descriptor with `environmentId` + `label` so the catalog can refuse a mismatched host.

### Bearer / cookie (keep)

`authorization/remote.ts`:

| Call | Endpoint | Role |
| --- | --- | --- |
| `bootstrapRemoteBearerSession` | `POST /oauth/token` | Pairing bootstrap credential → access token (`grant_type` token-exchange, `subject_token_type` environment bootstrap). |
| `fetchRemoteSessionState` | `GET /api/auth/session` | Granted scopes. |
| `issueRemoteWebSocketTicket` | `POST /api/auth/websocket-ticket` | Short-lived ticket for the upgrade. |
| `resolveRemoteWebSocketConnectionUrl` | — | `wsBaseUrl` + pathname `/ws` + `wsTicket` + client metadata query params. |

`appendClientConnectionParams` puts `clientSurface`, `clientAppVersion`, `clientDeviceType`, `clientOs`, optional web/mobile extras, `connectionMethod` on the **upgrade URL**. Server reads them next to `wsTicket`. Keep if Nero’s `/ws` handshake wants client telemetry; otherwise strip.

Primary with no token skips the ticket: `resolver.primarySocketUrl` still forces `/ws`. Same-origin cookie is sent by the browser WebSocket. HTTP snapshot fetches use `withEnvironmentCredentials` → `fetch` `credentials: "include"` when `httpAuthorization === null`.

### DPoP / relay (delete)

`exchangeRemoteDpopAccessToken`, `issueRemoteDpopWebSocketTicket`, `resolveRemoteDpopWebSocketConnectionUrl`, `fetchRemoteDpopSessionState`.

`authorization/service.ts` `RemoteEnvironmentAuthorization`:

- `authorizeBearer` — **keep.** Cache descriptor 10s. Issue ticket, return `PreparedConnection` with Bearer header.
- `authorizeDpop` — **delete.** Cache `RemoteDpopAccessTokenStore`, DPoP proof on `/oauth/token` and `/api/auth/websocket-ticket`, `connectionMethod: "relay"`.

`authorization/tokenStore.ts` is entirely DPoP/relay (`RelayManagedEndpoint`). **Delete.** `platform/storageDocument.ts` `ConnectionCatalogDocument.remoteDpopTokens` goes with it.

`platform/capabilities.ts`: **delete** `CloudSession` (Clerk) and `RelayDeviceIdentity`. **Keep** `ClientPresentation`, `PrimaryEnvironmentAuth`, `SshEnvironmentGateway` (if SSH stays).

### Session scopes atom (`state/session.ts`)

After a prepared connection exists, `fetchEnvironmentSessionState` → `GET /api/auth/session` with the same cookie/bearer/DPoP as the socket. Timeout 6s. Atom is keyed on prepared identity so re-pair refreshes scopes.

Nero: keep cookie + bearer branches; drop `ManagedRelayDpopSigner`.

---

## 3. How it talks to `/ws`

Files: `packages/client-runtime/src/rpc/`.

### URL

Final URL is `PreparedConnection.socketUrl`, never built at session time. Construction always:

1. Take `wsBaseUrl`.
2. If pathname is `""` or `"/"`, set `pathname = "/ws"`.
3. Optionally `wsTicket=<ticket>`.
4. Optionally client + `connectionMethod` query params.

### Session (`session.ts`)

`RpcSessionFactory.connect(prepared)`:

- `Socket.layerWebSocket(connection.socketUrl, { openTimeout: "15 seconds" })` using `Socket.WebSocketConstructor` from the platform.
- Effect RPC protocol over that socket, **JSON** serialization, **no transient retry**.
- `ConnectionHooks`: `onConnect` completes `ready`; `onDisconnect` fails `closed` as `ConnectionTransientError` (`transport`).
- Protocol client: `makeWsRpcProtocolClient = RpcClient.make(WsRpcGroup)` (`protocol.ts`).
- `initialConfig` = cached `serverGetConfig`.
- `ready` = socket connected **and** initial config fetched.
- `probe` = `serverProbe` if `config.environment.capabilities.connectionProbe`, else another `serverGetConfig`.

`EnvironmentAuthorizationError` on config/probe → `ConnectionBlockedError` (`permission`). RPC/transport → transient.

**Nero:** same session object. Swap `WsRpcGroup` for Nero’s RPC group. Keep “no protocol retry; supervisor reconnects.”

### Client (`client.ts`)

All app RPC goes through `EnvironmentSupervisor.session`:

- `request(tag, input)` — unary. Fails `EnvironmentRpcUnavailableError` if no session.
- `subscribe` / `subscribeDynamic` — switchMap on session changes. Transport `RpcClientError` → log and wait for next session (does **not** call `retryNow`). Expected Fail + `retryExpectedFailureAfter` re-subscribes on the **same** session (shell/thread use `"250 millis"`). `resubscribe` stream (app foreground) forces a new subscribe.
- `runStream` — one-shot streams (`gitRunStackedAction`, `serverUpdateServerWithProgress`, and **`cloudInstallRelayClient`**).

**Delete** `WS_METHODS.cloudInstallRelayClient` from `EnvironmentStreamCommandRpcTag`. That is T3 Connect “install relay client on this environment.”

### HTTP (`http.ts`)

`EnvironmentHttpApi` client, base URL = origin of `httpBaseUrl`. Shared by auth, snapshots, PR diffs. Timeouts + mapped errors. Keep; retarget the HTTP API schema.

---

## 4. Atom state

File: `packages/client-runtime/src/state/runtime.ts`. This is the **keep-forever** kernel.

- `Atom.AtomRuntime` is provided by the app (`Atom.runtime(connectionLayer)`).
- `createEnvironmentQueryAtomFamily` / `createEnvironmentSubscriptionAtomFamily` / `createEnvironmentCommand` wrap `runInEnvironment` / `followStreamInEnvironment` (registry looks up supervisor).
- `createEnvironmentRpcQueryAtomFamily` / `createEnvironmentRpcSubscriptionAtomFamily` / `createEnvironmentRpcCommand` / `createEnvironmentRpcStreamCommand` bind a `WS_METHODS` / `ORCHESTRATION_WS_METHODS` tag.
- Command scheduler: `parallel | serial | singleFlight | latest` keyed per environment+input.

Domain modules are thin: they call those helpers with a method tag and SWR/idle TTL. Nero keeps the helpers; drops or retags methods that do not exist on Nero’s server.

`state/session.ts` also exposes `initialConfigAtom` / `preparedConnectionAtom` from supervisor refs (not RPC).

---

## 5. Shell and thread snapshot loaders

Design: **HTTP snapshot first, WebSocket delta after**, so the large gzippable payload stays off the socket. If HTTP fails, subscribe without `afterSequence` and the server embeds a snapshot in the first WS frames.

### Shell

| Piece | Path |
| --- | --- |
| HTTP | `state/shellSnapshotHttp.ts` → `GET /api/orchestration/shell` (6s timeout) |
| Loader service | `ShellSnapshotLoader` (optional DPoP signer) |
| State machine | `state/shell.ts` `makeEnvironmentShellState` |
| Reducer | `state/shellReducer.ts` |
| Cache | `EnvironmentCacheStore.loadShell/saveShell` (debounced 500ms) |
| WS | `ORCHESTRATION_WS_METHODS.subscribeShell` |

Subscribe input:

- New session: wait for `supervisor.prepared`, `snapshotLoader.load`, apply as `kind: "snapshot"`.
- If HTTP ok, resume with `afterSequence: snapshot.snapshotSequence`.
- If HTTP fail, omit cursor → full WS snapshot.
- If server advertises `shellResumeCompletionMarker`, wait for `kind: "synchronized"` before `status: "live"`.
- Foreground wakeup (`application-active` / `application-active-probe`) resubscribes.

Statuses: `empty | cached | synchronizing | live`. Disconnected drops to cached/empty, never clears the snapshot.

### Thread

| Piece | Path |
| --- | --- |
| HTTP | `state/threadSnapshotHttp.ts` → `GET /api/orchestration/threads/:threadId` |
| Window | `turnLimit` / `beforeCursor` only if `threadSnapshotPagination` |
| Loader | `ThreadSnapshotLoader` |
| State machine | `state/threads.ts` `makeEnvironmentThreadState` |
| Reducer | `state/threadReducer.ts` |
| Cache | load/save/remove thread; skip persist while `session.status` is `starting|running` |
| WS | `ORCHESTRATION_WS_METHODS.subscribeThread` |

Initial window: `INITIAL_THREAD_USER_TURN_LIMIT = 10`. Older pages: `OLDER_THREAD_PAGE_USER_TURN_LIMIT = 20` via `requestOlderThreadTurns` → `ThreadOlderTurnRequests`.

Nero: keep the HTTP-then-WS split even if endpoints are renamed. Drop `ManagedRelayDpopSigner` from both loaders (`serviceOption` already makes signer optional).

Same HTTP+auth pattern: `state/pullRequestDiffHttp.ts`, `state/session.ts`.

---

## 6. Retry (all layers)

| Layer | Behavior | Nero |
| --- | --- | --- |
| Effect RPC socket | No retry | Keep |
| Supervisor | Backoff 3/4/8/16s, 15s setup timeout, 30s stability reset, wake probe | Keep |
| Durable subscriptions | Wait for next session on transport error; 250ms same-session retry on expected Fail | Keep |
| Server self-update | `nudgeReconnectDuringUpdateRestart` in `state/server.ts` pokes `retryNow` every ~1s during known restart | Keep if Nero has in-place server update |
| VCS refs | `Schedule.exponential("1 second")` capped 30s (`state/vcs.ts`) | Keep if VCS RPC stays |
| Auth ticket on cached DPoP | 3s timeout then invalidate cache | Delete with DPoP |

---

## 7. Every exported module — keep vs delete

From `packages/client-runtime/package.json` `exports`. Implementation-only files are listed under the subpath they serve.

### `./connection` — **keep core, delete relay kinds**

| File | Action |
| --- | --- |
| `index.ts` | Keep; drop relay-only re-exports if any surface after surgery |
| `model.ts` | Delete `RelayConnectionTarget`; drop `relay-unavailable`; drop DPoP from `PreparedHttpAuthorization` |
| `catalog.ts` | Delete `RelayConnectionRegistration` |
| `resolver.ts` | Delete `makeRelayBroker` + `RelayConnectionTarget` case; drop `ManagedRelay` / `CloudSession` / `RelayDeviceIdentity` |
| `driver.ts` | Keep |
| `supervisor.ts` | Keep; delete relay tracing (`withRelayClientTracing`) and `credentials-changed` restart |
| `registry.ts` | Delete `removeRelayEnvironments` |
| `layer.ts` | Delete `RelayEnvironmentDiscovery.layer` |
| `onboarding.ts` | Keep pairing + optional SSH |
| `presentation.ts` | Keep |
| `connectivity.ts` | Keep |
| `wakeups.ts` | Keep; optional drop `credentials-changed` |
| `credentialStore.ts` | Keep |
| `profileStore.ts` | Keep |
| `errors.ts` | Delete relay/DPoP mappers |
| `*.test.ts` | Keep tests that match remaining kinds |

### `./authorization` — **keep bearer, delete DPoP/relay**

| File | Action |
| --- | --- |
| `index.ts` | Stop exporting DPoP types |
| `remote.ts` | Keep bearer + ticket + `appendClientConnectionParams`; delete `*Dpop*` |
| `service.ts` | Keep `authorizeBearer`; delete `authorizeDpop`, `RelayEnvironmentAuthorization` |
| `tokenStore.ts` | **Delete** |
| tests | Keep bearer cases |

### `./environment` — **keep, rebrand well-known**

| File | Action |
| --- | --- |
| `index.ts`, `endpoint.ts`, `scoped.ts`, `knownEnvironment.ts` | Keep (`endpoint.ts` re-exports `@t3tools/shared/advertisedEndpoint`) |
| `descriptor.ts` | Keep call; change `/.well-known/t3/environment` |

### `./errors` — **keep, de-brand**

| File | Action |
| --- | --- |
| `errorTrace.ts`, `orchestration.ts`, `safeLog.ts` | Keep |
| `transport.ts` | Keep logic; rewrite pattern `Unable to connect to the T3 server WebSocket.` |

### `./rpc` — **keep, drop cloud stream tag**

| File | Action |
| --- | --- |
| `protocol.ts` | Keep; bind Nero `WsRpcGroup` |
| `session.ts` | Keep |
| `client.ts` | Delete `cloudInstallRelayClient` from stream tags |
| `http.ts` | Keep; bind Nero HTTP API |

### `./operations` and `./operations/projects` — **keep**

Command constructors dispatch `ORCHESTRATION_WS_METHODS.dispatchCommand`. Project-add URL/path helpers are UI logic. Retarget command types to Nero contracts.

### `./platform` — **keep contracts, delete cloud caps**

| File | Action |
| --- | --- |
| `capabilities.ts` | Delete `CloudSession`, `RelayDeviceIdentity` |
| `persistence.ts` | Keep stores (targets, registrations, shell/thread/config/vcs cache) |
| `source.ts` | Keep `PlatformConnectionSource` |
| `storageDocument.ts` | Delete `remoteDpopTokens` from `ConnectionCatalogDocument` |

### `./markdown-images` — **keep**

Pure URL classification. No T3 server.

### `./providerSkills` — **keep**

Slash-menu skill/command filtering. Depends on contract types, not Connect.

### `./relay` — **delete entire subpath**

| File | Why |
| --- | --- |
| `managedRelay.ts` | T3 Connect Relay HTTP API, DPoP signer, Clerk JWT, device register, environment link/connect |
| `managedRelayState.ts` | Clerk session atom, “Sign in to T3 Connect…” copy, environment/device queries |
| `discovery.ts` | Poll relay-managed environment availability |
| `errorPresentation.ts` | Relay/DPoP user strings |
| tests | All relay |

### State subpaths

| Export | Files (public + impl) | Nero |
| --- | --- | --- |
| `./state/runtime` | `runtime.ts` | **Keep.** Atom/RPC helpers. |
| `./state/session` | `session.ts`, uses `environmentHttpAuth.ts` | **Keep** cookie/bearer; drop DPoP signer. |
| `./state/auth` | `auth.ts` | **Keep** if Nero has pairing-link / client-session admin (`subscribeAuthAccess`). Else delete. |
| `./state/connections` | `connections.ts` | **Keep**; delete `removeRelayEnvironments` command. |
| `./state/shell` | `shell.ts`, `shellReducer.ts`, `shellSnapshotHttp.ts`, `shellCommands.ts`, `models.ts`, `snapshots.ts` | **Keep**; drop DPoP from snapshot HTTP. `shellOpenInEditor` is a WS command — keep if Nero has it. |
| `./state/threads` | `threads.ts`, `threadSnapshotHttp.ts`, `threadReducer.ts`, `threadState.ts`, `threadCommands.ts`, `threadDetail.ts`, `threadShell.ts`, `threadRetention.ts`, plus re-exports below | **Keep.** |
| (via threads) | `archivedThreads.ts`, `checkpointDiff.ts`, `composerPathSearch.ts`, `threadFeedback.ts` | Keep if those RPCs exist. `threadFeedback.ts` is Codex-specific — **adapt or delete**. |
| `./state/thread-sort` | `threadSort.ts` | **Keep** (pure). |
| `./state/thread-settled` | `threadSettled.ts` | **Keep** (pure settle/snooze policy). |
| `./state/thread-search` | `threadSearch.ts` | **Keep** if search RPC exists. |
| `./state/entities` | `entities.ts` | **Keep** scoped keys. |
| `./state/projects` | `projects.ts`, `projectCommands.ts`, `projectEntities.ts` | **Keep.** |
| `./state/project-grouping` | `projectGrouping.ts` | **Keep** (pure grouping). |
| `./state/orchestration` | `orchestration.ts` | **Keep** methods Nero implements (`getTurnDiff`, `getWorkflowScript`, `getFullThreadDiff`, `searchThreads`, `getArchivedShellSnapshot`); drop the rest. |
| `./state/server` | `server.ts` | **Keep** config stream, settings, providers, lifecycle, diagnostics. Self-update + `nudgeReconnectDuringUpdateRestart` only if Nero ships that. |
| `./state/presentation` | `presentation.ts` | **Keep.** |
| `./state/models` | (also re-exported from shell) | **Keep** scoped project/thread view models. |
| `./state/assets` | `assets.ts` | **Keep** if asset URL RPC exists. |
| `./state/filesystem` | `filesystem.ts` | **Keep** browse RPC + path helpers. |
| `./state/git` | `git.ts` | **Keep** if git PR RPCs exist. |
| `./state/source-control` | `sourceControl.ts` | **Keep** clone/publish/discovery if Nero has them. |
| `./state/vcs` | `vcs.ts`, `vcsAction.ts`, `vcsStatus.ts`, `vcsRef.ts`, `vcsRefInvalidation.ts`, `vcsCommandScheduler.ts`, `gitActions.ts` | **Keep** if git UI exists. |
| `./state/preview` | `preview.ts` | **Keep** if preview/automation WS methods exist. |
| `./state/pull-requests` | `pullRequests.ts`, `pullRequestDiffHttp.ts` | **Keep** if PR HTTP/RPC exists; drop DPoP from HTTP. |
| `./state/review` | `review.ts` | **Keep** if review RPCs exist. |
| `./state/terminal` | `terminal.ts`, `terminalSession.ts` | **Keep** if terminal RPCs exist. |
| `./state/subagentRuntime` | `subagentRuntime.ts` | **Keep** as a *fold over thread activities* (no network). Comment says it is a v1 bridge to delete when v2 projection is universal — Nero can copy or skip. |
| `./state/relay` | `relayDiscovery.ts` | **Delete.** |

Internal-only (not a package export, but pulled in): `environmentHttpAuth.ts` — **keep** cookie/bearer; **delete** DPoP proof branch.

---

## 8. File-level change map (copy order)

Copy the package, then apply this. Paths are under `packages/client-runtime/src/` unless noted.

### Delete now (T3 Connect / cloud / relay)

- `relay/` entire directory
- `state/relayDiscovery.ts`
- `authorization/tokenStore.ts`
- Relay types and brokers: slices of `connection/model.ts`, `catalog.ts`, `resolver.ts`, `registry.ts`, `layer.ts`, `errors.ts`, `supervisor.ts` (relay spans + credentials-changed)
- Platform: `CloudSession`, `RelayDeviceIdentity` in `platform/capabilities.ts`
- Catalog persistence: `remoteDpopTokens` in `platform/storageDocument.ts`
- RPC: `cloudInstallRelayClient` in `rpc/client.ts`
- Catalog atoms: `removeRelayEnvironments` in `state/connections.ts`
- Package export `./relay` and `./state/relay` in `package.json`

### Keep as architecture (retarget contracts)

- `rpc/session.ts`, `rpc/protocol.ts`, `rpc/http.ts`
- `connection/driver.ts`, `supervisor.ts` (minus relay), `registry.ts` (minus relay remove), `onboarding.ts` pairing
- `state/runtime.ts`
- `state/shell.ts` + `shellSnapshotHttp.ts` + `shellReducer.ts`
- `state/threads.ts` + `threadSnapshotHttp.ts` + `threadReducer.ts` + `threadState.ts`
- `authorization/remote.ts` bearer + websocket ticket
- `authorization/service.ts` `authorizeBearer`
- `environment/endpoint.ts`, `scoped.ts`

### Adapt (T3-branded or dual-mode)

| File | Change |
| --- | --- |
| `environment/descriptor.ts` | Rename `/.well-known/t3/environment` |
| `errors/transport.ts` | Remove “T3 server WebSocket” string |
| `state/environmentHttpAuth.ts` | Cookie + Bearer only |
| `state/shellSnapshotHttp.ts` | No `ManagedRelayDpopSigner` |
| `state/threadSnapshotHttp.ts` | Same |
| `state/pullRequestDiffHttp.ts` | Same |
| `state/session.ts` | Same |
| `connection/onboarding.ts` | Pairing URL parser may move off `@t3tools/shared/remote` |
| `rpc/protocol.ts` / `http.ts` | Point at Nero schemas, not `@t3tools/contracts` |
| Domain `create*EnvironmentAtoms` | One decision per WS method: keep, stub, or delete |
| `state/threadFeedback.ts` | Codex-only — likely delete |
| `state/subagentRuntime.ts` | Copy only if Nero renders native-provider subagents |
| `operations/projects.ts` | GitHub/GitLab clone UX — keep if Nero has add-project |

### Platform implementations Nero must still write (not in this package)

These are *interfaces* here; web/desktop/mobile implement them:

- `Connectivity`, `ConnectionWakeups`, `WebSocketConstructor`, `HttpClient`
- `ConnectionTargetStore`, `ConnectionRegistrationStore`, `EnvironmentCacheStore`, profile/credential stores
- `PlatformConnectionSource` (desktop local env list)
- `ClientPresentation` (surface/version/scopes)
- `PrimaryEnvironmentAuth` (optional local bearer)
- `SshEnvironmentGateway` if SSH stays
- Atom runtime layer merge (see `apps/web/src/connection/runtime.ts`)

Do **not** implement: Clerk token, relay DPoP keystore, T3 Connect device id.

---

## 9. Sequence (Nero-relevant path)

Pairing or local primary, no Connect:

1. App provides platform layer + `Connection.layer` + snapshot loaders → `Atom.runtime`.
2. Registry `start`: load persisted bearer/ssh targets; `reconcilePlatform` adds primary.
3. UI `connect` → supervisor `desired: true`.
4. Driver `prepare`:
   - Primary cookie: `socketUrl = wsBaseUrl/ws?client…`
   - Bearer: `GET` descriptor → `POST /api/auth/websocket-ticket` → `socketUrl = …/ws?wsTicket=…`
5. `RpcSessionFactory` opens WebSocket, waits for connect, `serverGetConfig`.
6. Supervisor publishes `session` + `prepared`, phase `connected`.
7. Shell atom: cache paint → HTTP `/api/orchestration/shell` → `subscribeShell` with `afterSequence`.
8. Thread atom (on open): cache → HTTP `/api/orchestration/threads/:id` → `subscribeThread`.
9. Commands: `operations/commands.ts` → `request(dispatchCommand, …)`.
10. Drop: `closed` or probe fail → clear session → backoff → prepare again (new ticket; tickets are not reused across reconnects).

Relay path (do not copy): Clerk → Relay `connectEnvironment` → DPoP `/oauth/token` → DPoP websocket ticket → `/ws?wsTicket&connectionMethod=relay`.

---

## 10. What this package is not

- Not the server (`apps/server`).
- Not UI. Web/mobile own Atom composition and React/RN bindings.
- Not T3 Connect (`infra/relay`, Clerk). Client-runtime only *calls* it via `./relay`.
- Contracts live in `packages/contracts`; Nero will replace `WsRpcGroup` / `EnvironmentHttpApi` / orchestration command types and then this package follows.

Copy this package first, delete `./relay` + relay connection kinds, then retarget HTTP/WS schemas. Do not keep a stub T3 Connect client “for later.”
