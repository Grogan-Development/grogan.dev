# 03 — Web shell, auth, environment (T3 → Nero)

Source: `/tmp/t3code-upstream/apps/web/src` as of this map. No Nero product code was consulted.

Nero target (from prior lock + this task): **T3 is a website skin on nero.grogan.dev**. One user. Many Docker workspaces. Many agent threads inside a workspace. Copy, then adapt until no T3 remnants.

Legend:

- **Copy** — keep structure; strip T3 names/strings in a later pass.
- **Adapt** — keep the file, change the model (auth, IDs, routes, connection targets).
- **Delete** — T3-only (Clerk, T3 Connect/relay, pairing-as-product, desktop SSH/WSL, hosted `app.t3.codes` client).

`clerk/` at `apps/web/src/clerk` **does not exist**. Clerk lives in `components/clerk/` plus `main.tsx` (out of the listed dirs, called out under Adjacent).

---

## 1. Environment vs Nero workspace

### 1.1 What T3 calls an environment

An **environment** is one **running T3 server process** the client can talk to over HTTP + WebSocket. It is not a git repo, not a thread, not a Docker workspace.

Identity:

- `EnvironmentId` — branded string (`packages/contracts/src/baseSchemas.ts`).
- `ExecutionEnvironmentDescriptor` — `{ environmentId, label, platform, serverVersion, capabilities }` (`packages/contracts/src/environment.ts`).
- Every project and thread is **scoped**: `{ environmentId, projectId }` / `{ environmentId, threadId }` (`packages/client-runtime/src/environment/scoped.ts`). Keys are `"${environmentId}:${localId}"`.

The client keeps a **connection catalog** of environments (`connection/` + IndexedDB `t3code:connection-runtime`). Target kinds (`packages/client-runtime/src/connection/model.ts`):

| Target | Meaning | Auth |
|---|---|---|
| `PrimaryConnectionTarget` | Same-origin / desktop-primary server (`PRIMARY_LOCAL_ENVIRONMENT_ID = "primary"`) | Cookie (browser same-origin) or desktop bearer |
| `BearerConnectionTarget` | Saved remote **or** desktop-local secondary (WSL id `local:<backendId>`) | Pairing → bearer |
| `RelayConnectionTarget` | T3 Connect discovered remote | Clerk JWT + DPoP to relay |
| `SshConnectionTarget` | Desktop-provisioned SSH remote | Desktop bridge + pairing |

A **project** is a git checkout / cwd **inside** an environment. A **thread** is a conversation **inside** a project, still keyed by `environmentId`. `ThreadEnvMode` `"local" | "worktree"` is git worktree vs project checkout — **not** Nero workspace.

T3 UI also uses the word “workspace” for chrome (`WorkspacePageHeader`, `--workspace-topbar-height`). That is layout, not an environment.

### 1.2 How Nero should map it

Nero lock: **workspace = Docker container + persistent ZFS dataset**. One user, many workspaces, many threads inside a workspace.

| T3 | Nero | Notes |
|---|---|---|
| Environment (server process + connection) | **Workspace** (container + dataset + in-container agent server) | 1:1 for routing and RPC scoping |
| Primary environment | **No special primary.** Control plane is nero.grogan.dev; workspaces are peers | Drop `PRIMARY_LOCAL_ENVIRONMENT_ID` / `PrimaryConnectionTarget` as the product model |
| Extra remotes (WSL, SSH, T3 Connect) | **Delete as products.** Workspaces are Docker on the Nero host | |
| Project (repo/cwd in an environment) | Keep as inner entity **only if** a workspace can hold multiple checkouts; else 1 workspace = 1 cwd | Lifecycle doc does not mention multi-repo workspaces |
| Thread | Thread | Same, scoped by workspaceId |
| Hosted static client (`app.t3.codes`) connecting to user-owned servers | **This site is the product.** No BYOS pairing | |

Do **not** map Nero workspace ↔ T3 project. That would put Docker lifecycle on a git folder and leave `environmentId` as a second axis.

### 1.3 What routing must change for `/w/:workspaceId`

Today the chat URL **is** the environment:

```
/                              → auto-draft on most recent project (any env)
/$environmentId/$threadId      → canonical thread
/draft/$draftId                → local draft (env lives in draft store, not URL)
/pull-requests
/projects/$projectKey          → settings; key is logical/physical, often env-scoped
/settings/*                    → global chrome; data often from primary env
/usage
/pair                          → pairing gate
/connect, /connect/callback    → Clerk CLI OAuth
```

Nero should make the workspace a **path prefix**, not a sibling of thread id:

| T3 | Nero | Why |
|---|---|---|
| `/` | `/` workspace picker **or** redirect to last `/w/:workspaceId` | Many workspaces, none is “primary origin” |
| `/$environmentId/$threadId` | `/w/$workspaceId/$threadId` (or `/w/$workspaceId/t/$threadId` if ids can collide with reserved segments) | `settings`, `usage`, `draft`, `pull-requests` must not parse as thread ids |
| `/draft/$draftId` | `/w/$workspaceId/draft/$draftId` | Drafts are workspace-local |
| `/pull-requests` | `/w/$workspaceId/pull-requests` if PRs are workspace-git; else delete | T3 list is cross-project inside connected envs |
| `/projects/$projectKey` | `/w/$workspaceId/project` or drop if 1 cwd/workspace | |
| `/settings/*`, `/usage` | Keep **unprefixed** (one user, global prefs) unless a setting is workspace-owned | T3 already treats settings as app-global, RPC to primary |
| `/pair`, `/connect*` | **Delete** | |

Concrete file-route rename:

- `routes/_chat.$environmentId.$threadId.tsx` → `routes/_chat.w.$workspaceId.$threadId.tsx` (TanStack: `path: '/w/$workspaceId/$threadId'`).
- `threadRoutes.ts` (`buildThreadRouteParams` / `resolveThreadRouteRef`) must take `workspaceId`.
- Every `navigate({ to: "/$environmentId/$threadId" })` outside this folder must follow: `__root.tsx` EventRouter welcome, `_chat.draft.$draftId.tsx`, `Sidebar.tsx`, `LegacySidebar.tsx`, `ChatView.tsx`, `CommandPalette.tsx`, `hooks/useThreadActions.ts`, `hooks/useHandleNewThread.ts` (`/draft/$draftId`).

Auth gate today: `_chat` / `projects` redirect to `/pair` unless `authenticated` or `hosted-static`. Nero: session is the site (or none, single-user). Workspace routes need **workspace exists + running/waking**, not a pairing token. Cold workspace (`docker stop`) is a first-class route state on `/w/:workspaceId`, not a connection-catalog miss.

`routeTree.gen.ts` is generated. Do not hand-edit; regenerate after file routes change.

Hash history (`main.tsx` + `env.ts` `isElectron`) is Electron-only. Nero website: browser history only.

---

## 2. Auth stack (what T3 actually does)

Three stacked systems:

1. **Environment pairing** — `/api/auth/session`, bootstrap credential, pairing links, client sessions (`environments/primary/auth.ts`). This is how a browser is allowed to talk to **a T3 server**. Desktop injects a bootstrap token; remote uses a pairing URL token (`pairingUrl.ts` re-exports `@t3tools/shared/remote`).
2. **Clerk + T3 Connect** — optional, if `VITE_CLERK_PUBLISHABLE_KEY` + JWT template + relay URL (`cloud/publicConfig.ts`). `main.tsx` wraps Clerk; `ManagedRelayAuthProvider` feeds Clerk tokens into the relay client. This is **account** auth for linking **user-owned machines** through T3’s tunnel.
3. **CLI connect OAuth** — hosted `/connect` for `t3 connect` (`cloud/connectCliAuth.ts`).

Nero needs (1) only in a reduced form: control plane mints a workspace WS/HTTP credential. Delete (2) and (3). Pairing UI (`/pair`) is BYOS; replace with workspace wake/connect.

---

## 3. File inventory and disposition

Every file under the listed trees. Tests travel with the production file unless noted.

### 3.1 Root files (listed)

| File | Disposition | What changes |
|---|---|---|
| `/tmp/t3code-upstream/apps/web/src/AppRoot.tsx` | **Adapt** | Keep atom registry + `RouterProvider`. Drop or gate `ElectronBrowserHost` / `QuitHoldOverlay` if Nero is web-only. Preview hosts stay if in-app preview survives. |
| `/tmp/t3code-upstream/apps/web/src/AppRoot.test.tsx` | **Adapt** | Match remaining children. |
| `/tmp/t3code-upstream/apps/web/src/router.ts` | **Copy** | Tiny factory. No T3 names. |
| `/tmp/t3code-upstream/apps/web/src/routeTree.gen.ts` | **Adapt (regen)** | New `/w/$workspaceId` tree; drop `/pair`, `/connect`. |
| `/tmp/t3code-upstream/apps/web/src/env.ts` | **Adapt or delete** | `isElectron` via `window.desktopBridge`. Delete if Nero has no Electron shell. |
| `/tmp/t3code-upstream/apps/web/src/branding.ts` | **Adapt** | Default `"T3 Code"` → `"Nero"`. Drop desktop branding bridge and hosted nightly/latest channel unless Nero ships channels. |
| `/tmp/t3code-upstream/apps/web/src/branding.logic.ts` | **Copy** | Pure stage-label helpers; rename tests’ T3 strings. |
| `/tmp/t3code-upstream/apps/web/src/branding.test.ts` | **Adapt** | Desktop injection + T3 names. |
| `/tmp/t3code-upstream/apps/web/src/pairingUrl.ts` | **Delete** | Re-export of pairing-token URL helpers. Nero should not put tokens in `#token=`. |
| `/tmp/t3code-upstream/apps/web/src/hostedPairing.ts` | **Delete** | `app.t3.codes` / `VITE_HOSTED_APP_URL`, `/pair?host=`, `/__t3code/channel`. |
| `/tmp/t3code-upstream/apps/web/src/hostedPairing.test.ts` | **Delete** | |
| `/tmp/t3code-upstream/apps/web/src/authBootstrap.test.ts` | **Delete or rewrite** | Tests primary pairing bootstrap. No `authBootstrap.ts`; production is `environments/primary/auth.ts`. |

### 3.2 `routes/` (22 files)

| File | Disposition | What changes |
|---|---|---|
| `routes/__root.tsx` | **Adapt** | Auth gate: drop `hosted-pairing` / `hosted-static` / `resolveInitialServerAuthGateState`. Drop `RelayClientInstallDialog`, `ConnectOnboardingDialog`, `SshPasswordPromptDialog`. `EventRouter` welcome navigate must use `/w/$workspaceId/$threadId`. `HostedStaticEnvironmentBootstrap` (pick first saved env) → last-used workspace. Branding title sync stays. |
| `routes/_chat.tsx` | **Adapt** | `beforeLoad` must not redirect to `/pair`. Shortcuts copy; “Preview is desktop-only” copy if preview exists on web. |
| `routes/_chat.index.tsx` | **Adapt** | Do not auto-draft across all environments. `/` = picker or redirect into `/w/:id`. Delete `HostedStaticOnboardingState` (T3 Connect empty catalog). |
| `routes/-chatIndexTitlebar.test.ts` | **Delete or rewrite** | Asserts hosted-static onboarding header. |
| `routes/_chat.$environmentId.$threadId.tsx` | **Adapt (rename)** | File + `createFileRoute` path → `/w/$workspaceId/$threadId`. Param `environmentId` → `workspaceId` through `threadRoutes` + `ChatView`. |
| `routes/_chat.draft.$draftId.tsx` | **Adapt (rename)** | Nest under `/w/$workspaceId/draft/$draftId`. Promotion navigate uses new thread path. |
| `routes/_chat.pull-requests.tsx` | **Adapt or delete** | If kept, nest under workspace; it currently lists PRs across env-scoped projects. |
| `routes/projects.$projectKey.tsx` | **Adapt or delete** | Auth redirect `/pair` → site auth. Nest under `/w/:workspaceId` if projects remain. |
| `routes/settings.tsx` | **Copy** | Layout + Escape-to-back. Path can stay `/settings`. |
| `routes/settings.general.tsx` | **Copy** | |
| `routes/settings.appearance.tsx` | **Copy** | |
| `routes/settings.archived.tsx` | **Adapt** | Archived threads are env-scoped in data; UI is global. Filter by current workspace or show all. |
| `routes/settings.connections.tsx` | **Delete or rewrite** | Connections = extra T3 servers / T3 Connect. Nero: workspace list lives on `/` or `/w`. |
| `routes/settings.diagnostics.tsx` | **Adapt** | Strip T3 Connect / relay diagnostics if present in the panel. |
| `routes/settings.integrations.tsx` | **Adapt** | Likely GitHub/Clerk-ish; keep only Nero-real integrations. |
| `routes/settings.keybindings.tsx` | **Copy** | |
| `routes/settings.providers.tsx` | **Copy** | Provider adapters still exist as product. |
| `routes/settings.source-control.tsx` | **Copy** | Per-workspace git settings if RPC stays. |
| `routes/usage.tsx` | **Copy** | If usage RPC exists per workspace, add workspace filter later. |
| `routes/pair.tsx` | **Delete** | |
| `routes/connect.tsx` | **Delete** | |
| `routes/connect_.callback.tsx` | **Delete** | |

### 3.3 `environments/` (11 files; only `primary/`)

This folder **is** the same-origin T3 server client. Nero has no “primary local environment” in the browser. Replace with a control-plane client + per-workspace HTTP/WS target.

| File | Disposition | What changes |
|---|---|---|
| `environments/primary/index.ts` | **Adapt (rename dir)** | Barrel. Export workspace HTTP/session, not “primary”. |
| `environments/primary/target.ts` | **Adapt** | Today: desktop bootstrap **or** `VITE_HTTP_URL`/`VITE_WS_URL` **or** `window.location.origin`. Nero: control-plane origin is always the site; workspace agent URLs come from workspace records (not baked `VITE_*`). Keep URL parse/protocol swap helpers. |
| `environments/primary/httpClient.ts` | **Adapt** | `makeEnvironmentHttpApiClient` per workspace base URL, not a singleton primary. |
| `environments/primary/httpLayer.ts` | **Adapt** | Same-origin `credentials: "include"` vs desktop bearer. Nero: site cookie to control plane; workspace agent may be a different origin/port — mint short-lived bearer, do not reuse T3 pairing. |
| `environments/primary/auth.ts` | **Adapt (slash)** | Keep session-shaped HTTP if the in-workspace server still speaks it. Delete pairing-link CRUD, URL token take/strip, desktop bootstrap credential, WSL `reauthenticatePrimaryEnvironment`. Gate becomes “control plane says this user may use this workspace”. |
| `environments/primary/desktopAuth.ts` | **Delete** | `desktopBridge.getLocalEnvironmentBearerToken`. |
| `environments/primary/desktopAuth.test.ts` | **Delete** | |
| `environments/primary/context.ts` | **Adapt** | Descriptor fetch keyed by workspace, not a process-wide singleton. |
| `environments/primary/sessionState.ts` | **Adapt** | Atom family by workspaceId, not one primary session. |
| `environments/primary/bootstrap.test.ts` | **Adapt** | Target resolution tests; drop desktop/WSL cases. |
| `environments/primary/httpLayer.test.ts` | **Adapt** | Cookie vs bearer matrix for Nero origins. |

### 3.4 `connection/` (12 files)

This is the **multi-environment supervisor**: catalog, poll desktop bootstraps, SSH provision, relay wakeups. Nero still needs “open a WS to workspace X and supervise it”. It does not need four target kinds.

| File | Disposition | What changes |
|---|---|---|
| `connection/runtime.ts` | **Copy** | Wires `Connection.layer` + snapshot loaders + platform. Keep; change provided platform. |
| `connection/catalog.ts` | **Copy** | Thin `createEnvironmentCatalogAtoms`. Rename environment → workspace in a later contracts pass. |
| `connection/platform.ts` | **Adapt (heavy)** | Delete: hosted-static empty source, primary+WSL poll, SSH gateway, Clerk `CloudSession` (“Sign in to T3 Connect…”), `RelayDeviceIdentity`. Replace `PlatformConnectionSource` with control-plane workspace list (wake/stop included). Keep connectivity + visibility wakeups. IndexedDB cleanup hook stays. |
| `connection/platform.test.ts` | **Adapt** | |
| `connection/onboarding.ts` | **Delete** | `connectPairing` + `connectSshEnvironment`. |
| `connection/storage.ts` | **Adapt** | Keep shell/thread snapshot IDB. Rename DB `t3code:connection-runtime`. Drop persist of relay/SSH targets. |
| `connection/storage.test.ts` | **Adapt** | |
| `connection/desktopLocal.ts` | **Delete** | `local:` WSL connection ids. |
| `connection/desktopLocal.test.ts` | **Delete** | |
| `connection/useDesktopLocalBootstraps.ts` | **Delete** | |
| `connection/clientMetadata.ts` | **Adapt** | `"T3 Code Desktop"` label → Nero; drop Electron platform branch if no desktop. |
| `connection/clientMetadata.test.ts` | **Adapt** | |

### 3.5 `cloud/` (18 files) — delete as a product

T3 Connect: Clerk JWT, DPoP, relay link, managed tunnel, agent-activity publish, relay client install on the environment host.

| File | Disposition |
|---|---|
| `cloud/publicConfig.ts` | **Delete** |
| `cloud/publicConfig.test.ts` | **Delete** |
| `cloud/managedAuth.tsx` | **Delete** |
| `cloud/managedAuth.test.ts` | **Delete** |
| `cloud/managedRelayLayer.ts` | **Delete** |
| `cloud/managedRelayState.ts` | **Delete** |
| `cloud/dpop.ts` | **Delete** |
| `cloud/dpop.test.ts` | **Delete** |
| `cloud/linkEnvironment.ts` | **Delete** |
| `cloud/linkEnvironment.test.ts` | **Delete** |
| `cloud/linkEnvironmentAtoms.ts` | **Delete** |
| `cloud/primaryCloudLinkState.ts` | **Delete** |
| `cloud/useCloudLinkController.ts` | **Delete** |
| `cloud/connectOnboarding.ts` | **Delete** |
| `cloud/connectCliAuth.ts` | **Delete** |
| `cloud/connectCliAuth.test.ts` | **Delete** |
| `cloud/relayClientInstallDialog.ts` | **Delete** |
| `cloud/relayClientInstallDialog.test.ts` | **Delete** |

If Nero later needs a browser-proof for workspace HTTP, do not reuse `t3code:cloud-auth` DPoP as T3 Connect. That is a different trust boundary.

### 3.6 `components/cloud/` (6 files)

| File | Disposition |
|---|---|
| `components/cloud/CloudEnvironmentConnectList.tsx` | **Delete** (or adapt later as workspace switcher — not worth keeping Clerk/relay types) |
| `components/cloud/cloudEnvironmentConnectionPresentation.ts` | **Delete** |
| `components/cloud/cloudEnvironmentConnectionPresentation.test.ts` | **Delete** |
| `components/cloud/ConnectOnboardingDialog.tsx` | **Delete** |
| `components/cloud/ConnectCliAuthSurface.tsx` | **Delete** |
| `components/cloud/RelayClientInstallDialog.tsx` | **Delete** |

### 3.7 `components/auth/` (2 files)

| File | Disposition | What changes |
|---|---|---|
| `components/auth/AuthSurfaceShell.tsx` | **Copy** | Full-screen card. Swap `APP_DISPLAY_NAME`. Useful for a login or “workspace waking” page. |
| `components/auth/PairingRouteSurface.tsx` | **Delete** | Pairing form, hosted pairing (`connectPairing`), token auto-submit. |

### 3.8 `components/clerk/` (13 files) — delete

| File | Disposition |
|---|---|
| `components/clerk/clerkAppearance.ts` | **Delete** |
| `components/clerk/clerkAppearance.test.ts` | **Delete** |
| `components/clerk/authRedirect.ts` | **Delete** |
| `components/clerk/authRedirect.test.ts` | **Delete** |
| `components/clerk/useT3ConnectAuthPrompt.tsx` | **Delete** |
| `components/clerk/T3ConnectSidebarSignIn.tsx` | **Delete** |
| `components/clerk/T3ConnectUserProfilePage.tsx` | **Delete** |
| `components/clerk/T3ConnectUserProfilePage.test.tsx` | **Delete** |
| `components/clerk/MobileClientsUserProfilePage.tsx` | **Delete** |
| `components/clerk/MobileClientsUserProfilePage.logic.ts` | **Delete** |
| `components/clerk/MobileClientsUserProfilePage.logic.test.ts` | **Delete** |
| `components/clerk/ClerkUserProfilePage.tsx` | **Delete** (layout-only, but only used by Connect profile pages) |
| `components/clerk/electronPasskeys.test.ts` | **Delete** (`clerk.t3.codes`, `t3code:` protocol) |

### 3.9 `components/desktop/` (1 file)

| File | Disposition |
|---|---|
| `components/desktop/SshPasswordPromptDialog.tsx` | **Delete** | Nero workspaces are Docker, not desktop SSH. Mounted from `__root.tsx`. |

### 3.10 Missing / adjacent (not in the listed dirs, must touch for this slice)

| File | Why |
|---|---|
| `apps/web/src/main.tsx` | Clerk + `ManagedRelayAuthProvider` wrap. Adapt: no Clerk. |
| `apps/web/src/threadRoutes.ts` (+ `.test.ts`) | `environmentId` in URL params. |
| `apps/web/src/state/environments.ts` | Presentation list of catalog entries. |
| `apps/web/src/state/primaryEnvironment.ts` | Atom: first `PrimaryConnectionTarget`. **Delete concept.** |
| `apps/web/src/state/relay.ts` | Relay discovery. **Delete.** |
| `apps/web/src/state/auth.ts` | Client-runtime auth atoms. |
| `packages/client-runtime/src/environment/*` | `KnownEnvironment`, scoped refs — rename in contracts pass. |
| `packages/client-runtime/src/connection/model.ts` | Collapse to one workspace target. |
| `packages/contracts/src/environment.ts` | Descriptor + capabilities (keep, rename). |

---

## 4. Recommended copy order

1. **Shell that can boot without Clerk/pair:** `router.ts`, `AppRoot.tsx`, `routes/__root.tsx` (strip dialogs + pairing gate), `routes/_chat.tsx`, settings/usage routes, `branding.*`, `env.ts`.
2. **URL axis:** rename chat file route to `/w/$workspaceId/$threadId`; update `threadRoutes.ts` and the navigate call sites listed in §1.3.
3. **Connection:** gut `connection/platform.ts` to a single workspace target fed by Nero’s workspace list; keep `runtime.ts` / `catalog.ts` / snapshot `storage.ts`.
4. **HTTP:** turn `environments/primary` into per-workspace clients; stop resolving from `window.location` as “the” agent.
5. **Delete** `cloud/`, `components/cloud/`, `components/clerk/`, `pair`/`connect` routes, hosted pairing, SSH dialog, desktop-local WSL.

Do not keep a compatibility alias `/$environmentId/$threadId`. There is no T3 user base on Nero.

---

## 5. Exhaustive path list

97 files under the requested trees (absolute):

```
/tmp/t3code-upstream/apps/web/src/AppRoot.tsx
/tmp/t3code-upstream/apps/web/src/AppRoot.test.tsx
/tmp/t3code-upstream/apps/web/src/router.ts
/tmp/t3code-upstream/apps/web/src/routeTree.gen.ts
/tmp/t3code-upstream/apps/web/src/env.ts
/tmp/t3code-upstream/apps/web/src/branding.ts
/tmp/t3code-upstream/apps/web/src/branding.logic.ts
/tmp/t3code-upstream/apps/web/src/branding.test.ts
/tmp/t3code-upstream/apps/web/src/pairingUrl.ts
/tmp/t3code-upstream/apps/web/src/hostedPairing.ts
/tmp/t3code-upstream/apps/web/src/hostedPairing.test.ts
/tmp/t3code-upstream/apps/web/src/authBootstrap.test.ts

/tmp/t3code-upstream/apps/web/src/routes/__root.tsx
/tmp/t3code-upstream/apps/web/src/routes/_chat.tsx
/tmp/t3code-upstream/apps/web/src/routes/_chat.index.tsx
/tmp/t3code-upstream/apps/web/src/routes/-chatIndexTitlebar.test.ts
/tmp/t3code-upstream/apps/web/src/routes/_chat.$environmentId.$threadId.tsx
/tmp/t3code-upstream/apps/web/src/routes/_chat.draft.$draftId.tsx
/tmp/t3code-upstream/apps/web/src/routes/_chat.pull-requests.tsx
/tmp/t3code-upstream/apps/web/src/routes/projects.$projectKey.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.appearance.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.archived.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.connections.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.diagnostics.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.general.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.integrations.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.keybindings.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.providers.tsx
/tmp/t3code-upstream/apps/web/src/routes/settings.source-control.tsx
/tmp/t3code-upstream/apps/web/src/routes/usage.tsx
/tmp/t3code-upstream/apps/web/src/routes/pair.tsx
/tmp/t3code-upstream/apps/web/src/routes/connect.tsx
/tmp/t3code-upstream/apps/web/src/routes/connect_.callback.tsx

/tmp/t3code-upstream/apps/web/src/environments/primary/index.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/auth.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/bootstrap.test.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/context.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/desktopAuth.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/desktopAuth.test.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/httpClient.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/httpLayer.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/httpLayer.test.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/sessionState.ts
/tmp/t3code-upstream/apps/web/src/environments/primary/target.ts

/tmp/t3code-upstream/apps/web/src/connection/catalog.ts
/tmp/t3code-upstream/apps/web/src/connection/clientMetadata.ts
/tmp/t3code-upstream/apps/web/src/connection/clientMetadata.test.ts
/tmp/t3code-upstream/apps/web/src/connection/desktopLocal.ts
/tmp/t3code-upstream/apps/web/src/connection/desktopLocal.test.ts
/tmp/t3code-upstream/apps/web/src/connection/onboarding.ts
/tmp/t3code-upstream/apps/web/src/connection/platform.ts
/tmp/t3code-upstream/apps/web/src/connection/platform.test.ts
/tmp/t3code-upstream/apps/web/src/connection/runtime.ts
/tmp/t3code-upstream/apps/web/src/connection/storage.ts
/tmp/t3code-upstream/apps/web/src/connection/storage.test.ts
/tmp/t3code-upstream/apps/web/src/connection/useDesktopLocalBootstraps.ts

/tmp/t3code-upstream/apps/web/src/cloud/connectCliAuth.ts
/tmp/t3code-upstream/apps/web/src/cloud/connectCliAuth.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/connectOnboarding.ts
/tmp/t3code-upstream/apps/web/src/cloud/dpop.ts
/tmp/t3code-upstream/apps/web/src/cloud/dpop.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/linkEnvironment.ts
/tmp/t3code-upstream/apps/web/src/cloud/linkEnvironment.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/linkEnvironmentAtoms.ts
/tmp/t3code-upstream/apps/web/src/cloud/managedAuth.tsx
/tmp/t3code-upstream/apps/web/src/cloud/managedAuth.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/managedRelayLayer.ts
/tmp/t3code-upstream/apps/web/src/cloud/managedRelayState.ts
/tmp/t3code-upstream/apps/web/src/cloud/primaryCloudLinkState.ts
/tmp/t3code-upstream/apps/web/src/cloud/publicConfig.ts
/tmp/t3code-upstream/apps/web/src/cloud/publicConfig.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/relayClientInstallDialog.ts
/tmp/t3code-upstream/apps/web/src/cloud/relayClientInstallDialog.test.ts
/tmp/t3code-upstream/apps/web/src/cloud/useCloudLinkController.ts

/tmp/t3code-upstream/apps/web/src/components/cloud/cloudEnvironmentConnectionPresentation.ts
/tmp/t3code-upstream/apps/web/src/components/cloud/cloudEnvironmentConnectionPresentation.test.ts
/tmp/t3code-upstream/apps/web/src/components/cloud/CloudEnvironmentConnectList.tsx
/tmp/t3code-upstream/apps/web/src/components/cloud/ConnectCliAuthSurface.tsx
/tmp/t3code-upstream/apps/web/src/components/cloud/ConnectOnboardingDialog.tsx
/tmp/t3code-upstream/apps/web/src/components/cloud/RelayClientInstallDialog.tsx

/tmp/t3code-upstream/apps/web/src/components/auth/AuthSurfaceShell.tsx
/tmp/t3code-upstream/apps/web/src/components/auth/PairingRouteSurface.tsx

/tmp/t3code-upstream/apps/web/src/components/clerk/authRedirect.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/authRedirect.test.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/clerkAppearance.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/clerkAppearance.test.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/ClerkUserProfilePage.tsx
/tmp/t3code-upstream/apps/web/src/components/clerk/electronPasskeys.test.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/MobileClientsUserProfilePage.logic.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/MobileClientsUserProfilePage.logic.test.ts
/tmp/t3code-upstream/apps/web/src/components/clerk/MobileClientsUserProfilePage.tsx
/tmp/t3code-upstream/apps/web/src/components/clerk/T3ConnectSidebarSignIn.tsx
/tmp/t3code-upstream/apps/web/src/components/clerk/T3ConnectUserProfilePage.test.tsx
/tmp/t3code-upstream/apps/web/src/components/clerk/T3ConnectUserProfilePage.tsx
/tmp/t3code-upstream/apps/web/src/components/clerk/useT3ConnectAuthPrompt.tsx

/tmp/t3code-upstream/apps/web/src/components/desktop/SshPasswordPromptDialog.tsx
```

Not present: `apps/web/src/clerk/`.
