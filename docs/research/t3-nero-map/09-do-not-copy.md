# 09 — Do not copy

Fresh map from `/tmp/t3code-upstream` (T3 Code). No previous Nero tree, no prior
Nero map to reconcile.

Nero is taking the **web GUI + client runtime + contracts + shared utils**. It
is **not** taking T3’s execution runtime, other app surfaces, hosted Connect,
provider-protocol SDKs, desktop SSH/Tailscale, packaging, or native
resource telemetry.

Source of truth for workspace roles: `docs/internals/workspace-layout.md`.

---

## Web import check (verified)

`apps/web/package.json` workspace deps are only:

- `@t3tools/client-runtime`
- `@t3tools/contracts`
- `@t3tools/shared`

Grep of `apps/web` for package imports of the skip set:

| Specifier | Result in `apps/web` |
| --- | --- |
| `effect-acp` | **none** |
| `effect-codex-app-server` | **none** |
| `@t3tools/ssh` | **none** |
| `@t3tools/tailscale` | **none** |
| `@t3tools/desktop` | **none** |
| `@t3tools/mobile` | **none** |
| `@t3tools/marketing` | **none** |
| `t3code-relay` | **none** |

Same greps in `packages/client-runtime`, `packages/shared`, and
`packages/contracts`: **no imports** of those packages.

The only `apps/web` hits for skip-tree path strings are:

- fixture file paths in diff/PR tests (`"apps/server/src/…"`)
- a comment in `apps/web/src/components/QuitHoldOverlay.tsx` pointing at
  `apps/desktop/src/window/QuitHold.ts`

`apps/web` does **not** import TypeScript from those trees. It **does** talk to
T3 Connect through `@t3tools/client-runtime/relay`, `@t3tools/contracts/relay`,
and `@t3tools/shared/{connectAuth,dpop,relayAuth,relayUrl,relayTracing}` —
those live in copy-candidate packages and are listed under nested skips.

`effect-acp` decision: **skip**. Used only by `apps/server` ACP adapters
(Cursor, Grok, Cursor mock agent). Web does not import it.

---

## Hard skip roots

Copy **nothing** under these paths. Nested lists are exhaustive first-level
contents of each root.

### 1. `apps/server` — package `t3`

Published CLI + execution runtime. Orchestration, provider drivers,
checkpointing, VCS, terminals, filesystem, auth, HTTP + WebSocket. Serves the
built web app. Nero does not copy a T3 agent host.

Consumers: `apps/desktop` (supervises a local `t3` backend; `main.ts` imports
`../../server/package.json`), `apps/web` only as a served artifact, `scripts/`
dev-runner/release.

| Path | What |
| --- | --- |
| `apps/server/package.json` | bin `t3` → `./dist/bin.mjs` |
| `apps/server/src/bin.ts` | CLI entry; `t3 connect` / pair / serve |
| `apps/server/src/cli/` | `auth`, `config`, `connect`, `pair`, `project`, `server`, `service`, `triage` |
| `apps/server/src/orchestration/` | event-sourced decider, projector, reactors |
| `apps/server/src/provider/` | Codex/Claude/Cursor/Grok/OpenCode adapters; `acp/` |
| `apps/server/src/provider/Layers/` | only consumer of `effect-codex-app-server` and (with `provider/acp/`) `effect-acp` |
| `apps/server/src/cloud/` | T3 Connect CLI OAuth, managed endpoints, relay HTTP |
| `apps/server/src/relay/` | `AgentAwarenessRelay` (mobile push path) |
| `apps/server/src/resourceTelemetry/` | talks to `native/resource-monitor` |
| `apps/server/src/terminal/` | node-pty / bun-pty host (not the web Ghostty wasm) |
| `apps/server/src/checkpointing/` | hidden git refs per turn |
| `apps/server/src/persistence/` | SQLite event store + ~55 migrations |
| `apps/server/src/auth/` | pairing, sessions, DPoP, RPC scopes |
| `apps/server/src/git/`, `vcs/`, `sourceControl/`, `pullRequest/` | host-side git/PR |
| `apps/server/src/preview/`, `mcp/`, `workspace/`, `usage/`, `textGeneration/` | host features |
| `apps/server/src/ws.ts`, `http.ts`, `server.ts` | wire surface |
| `apps/server/scripts/` | `acp-mock-agent.ts`, sqlite migrate, CLI helpers |
| `apps/server/integration/` | integration tests |

Workspace deps used **only here** (among apps): `effect-acp`,
`effect-codex-app-server`, `@t3tools/tailscale`. Also `node-pty`,
`@anthropic-ai/claude-agent-sdk`, `@opencode-ai/sdk`.

### 2. `apps/desktop` — package `@t3tools/desktop`

Electron shell. Supervises a desktop-scoped `t3` backend, loads the web bundle
over `t3code://`, owns SSH-managed remotes and WSL. Not a Nero surface.

| Path | What |
| --- | --- |
| `apps/desktop/src/main.ts` | Electron entry; imports `@t3tools/ssh` + server package.json |
| `apps/desktop/src/app/` | lifecycle, Clerk, identity, assets, shutdown |
| `apps/desktop/src/backend/` | local `t3` pool, Tailscale exposure, network |
| `apps/desktop/src/electron/` | protocol, updater, window, powerMonitor |
| `apps/desktop/src/ipc/` | IPC to the web renderer (SSH, WSL, preview, updates) |
| `apps/desktop/src/ssh/` | desktop SSH environments (`@t3tools/ssh`) |
| `apps/desktop/src/wsl/` | WSL backend |
| `apps/desktop/src/preview/` | Playwright/webview pick + annotation |
| `apps/desktop/src/updates/`, `telemetry/`, `window/`, `settings/` | Electron-only |
| `apps/desktop/scripts/` | electron launcher, preload verify, smoke |
| `apps/desktop/resources/` | DMG artwork |

Workspace deps unique here: `@t3tools/ssh`, `electron`,
`@clerk/electron-passkeys`. Also `@t3tools/tailscale`.

### 3. `apps/mobile` — package `@t3tools/mobile`

Expo / React Native client. Same `client-runtime` composition as web, different
platform layer and UI. App Store / Play. Not Nero.

| Path | What |
| --- | --- |
| `apps/mobile/src/` | RN UI, connection, features, persistence |
| `apps/mobile/src/features/cloud/` | T3 Connect onboarding / DPoP / managed relay |
| `apps/mobile/src/features/agent-awareness/` | APNs / Live Activities |
| `apps/mobile/modules/t3-composer-editor/` | native composer (iOS/Android) |
| `apps/mobile/modules/t3-markdown-text/` | native markdown |
| `apps/mobile/modules/t3-native-controls/` | keyboard commands |
| `apps/mobile/modules/t3-review-diff/` | native review canvas |
| `apps/mobile/modules/t3-terminal/` | Ghostty JNI/xcframework (mobile only) |
| `apps/mobile/plugins/` | Expo config plugins |
| `apps/mobile/assets/` | Android icons, widget mark |
| `apps/mobile/app.config.ts`, `eas.json`, `metro.config.js` | Expo/EAS |

Do not copy RN patches that exist only for this app (see Adjacent).

### 4. `apps/marketing` — package `@t3tools/marketing`

Astro marketing site (`t3.codes`). Legal, download, tweets, schema.

| Path | What |
| --- | --- |
| `apps/marketing/src/pages/` | `index`, `download`, `legal`, policies, `schema/t3.json.ts` |
| `apps/marketing/src/layouts/`, `components/`, `lib/` | site chrome |
| `apps/marketing/public/` | favicons, harness SVGs, screenshots, pfps |
| `apps/marketing/vercel.ts`, `astro.config.mjs` | Vercel deploy |

Depends on `@t3tools/shared` only. Web does not import it.

### 5. `infra/relay` — package `t3code-relay`

Hosted **T3 Connect** control plane. Alchemy + Cloudflare + PlanetScale.
Discovery, cloud records, managed endpoints, APNs / Live Activities. Not on
the post-connect hot path.

| Path | What |
| --- | --- |
| `infra/relay/alchemy.run.ts` | deployed stack |
| `infra/relay/src/worker.ts` | bindings, queues, HTTP |
| `infra/relay/src/http/Api.ts` | Clerk JWT + OAuth bearer |
| `infra/relay/src/environments/` | link, credentials, managed tunnels/DNS |
| `infra/relay/src/agentActivity/` | devices, APNs, Live Activities |
| `infra/relay/src/auth/` | relay tokens, DPoP replay |
| `infra/relay/src/persistence/schema.ts` | Drizzle schema |
| `infra/relay/migrations/postgres/` | 6 SQL migrations |
| `infra/relay/scripts/deploy.ts` | Alchemy deploy wrapper |

Docs: `docs/internals/t3-connect.md`, `docs/operations/relay-observability.md`.

### 6. `packages/effect-codex-app-server` — package `effect-codex-app-server`

Effect client for `codex app-server` JSON-RPC. Generated schema. **Server-only.**

Importers: `apps/server/src/provider/Layers/Codex{Adapter,Provider,SessionRuntime}.ts`
(+ tests). Listed in `apps/server/package.json` and `scripts/release-smoke.ts`.

| Path | What |
| --- | --- |
| `packages/effect-codex-app-server/src/client.ts` | child-process JSON-RPC client |
| `packages/effect-codex-app-server/src/protocol.ts`, `rpc.ts`, `schema.ts`, `errors.ts` | protocol |
| `packages/effect-codex-app-server/src/_generated/` | OpenAPI-generated |
| `packages/effect-codex-app-server/scripts/generate.ts` | generator |
| `packages/effect-codex-app-server/test/examples/` | probe |

### 7. `packages/effect-acp` — package `effect-acp`

Effect client + agent for Agent Client Protocol. **Server-only.** Web does not
import it — skip the whole package.

Importers: `apps/server/src/provider/acp/*`, Cursor/Grok adapters,
`apps/server/scripts/acp-mock-agent.ts`.

| Path | What |
| --- | --- |
| `packages/effect-acp/src/client.ts` | ACP client |
| `packages/effect-acp/src/agent.ts` | ACP agent |
| `packages/effect-acp/src/protocol.ts`, `rpc.ts`, `schema.ts`, `terminal.ts`, `errors.ts` | protocol |
| `packages/effect-acp/src/_generated/` | generated schema |
| `packages/effect-acp/scripts/generate.ts` | generator |
| `packages/effect-acp/test/examples/` | cursor ACP example |

### 8. `packages/ssh` — package `@t3tools/ssh`

SSH config, auth prompts, command execution, tunnel/environment manager for
**desktop-managed SSH environments**.

Importers: **only `apps/desktop`**
(`src/ssh/`, `src/ipc/methods/sshEnvironment.ts`, `src/wsl/`, `src/main.ts`).

| Path | What |
| --- | --- |
| `packages/ssh/src/auth.ts` | password prompt service |
| `packages/ssh/src/command.ts` | spawn `ssh` / remote `t3` package spec |
| `packages/ssh/src/config.ts` | `~/.ssh/config` host discovery |
| `packages/ssh/src/tunnel.ts` | `SshEnvironmentManager` (large) |
| `packages/ssh/src/errors.ts` | `SshHttpBridgeError`, etc. |

Web SSH UI (`apps/web/src/components/desktop/SshPasswordPromptDialog.tsx`)
talks IPC contracts, **not** this package.

### 9. `packages/tailscale` — package `@t3tools/tailscale`

Tailscale CLI wrapper: `ensureTailscaleServe` / `disableTailscaleServe`,
status, MagicDNS.

Importers:

- `apps/server/src/server.ts`, `cli/pair.ts`, `environment/RemoteOpenTargets.ts`
- `apps/desktop/src/backend/{tailscaleEndpointProvider,DesktopServerExposure}.ts`
- `scripts/lib/dev-share.ts` (via `scripts/package.json`)

| Path | What |
| --- | --- |
| `packages/tailscale/src/tailscale.ts` | CLI wrapper |
| `packages/tailscale/src/index.ts` | re-export |

Web does not import it. Pairing over tailnet is a server/desktop concern.

### 10. `packaging/`

AUR republish of official x86_64 AppImages. T3 Code product packaging, not Nero.

| Path | What |
| --- | --- |
| `packaging/aur/t3code-bin/PKGBUILD` | stable |
| `packaging/aur/t3code-nightly-bin/PKGBUILD` | nightly |
| `packaging/aur/scripts/release.sh` | version/checksum/push |
| `packaging/aur/README.md` | documents `.github/workflows/publish-aur.yml` |

### 11. `native/resource-monitor` — crate `t3-resource-monitor`

Rust sidecar (`sysinfo`) for process counters. Supervised by `apps/server`
`resourceTelemetry` and packaged into desktop artifacts. **Not** the Ghostty
headers.

| Path | What |
| --- | --- |
| `native/resource-monitor/Cargo.toml` | crate `t3-resource-monitor` |
| `native/resource-monitor/src/main.rs` | stdin/stdout NDJSON protocol v2 |
| `native/resource-monitor/Cargo.lock` | lockfile |

Consumed by `apps/server/src/resourceTelemetry/`,
`scripts/build-desktop-artifact.ts` (stages
`apps/desktop/prod-resources/resource-monitor`). Web diagnostics UI only
renders RPC categories (`"resource-monitor"` string in
`ResourceTelemetryDiagnostics.tsx`) — it does not build or spawn this binary.

Do **not** confuse with `native/libghostty-vt/` (web terminal wasm vendor;
**copy-candidate**, not in this list).

### 12. `experiments/`

Throwaway prototypes. Not in the shipped build (`workspace-layout.md`).

| Path | What |
| --- | --- |
| `experiments/messages-glass-lab/` | SwiftUI `MessagesGlassLab` Xcode prototype |

---

## T3 Connect (product skip, not a single directory)

Do not copy the **product**: hosted Clerk+relay remote environments, `t3 connect`
CLI OAuth, managed tunnels, mobile APNs.

### Skip-tree half (already above)

- `infra/relay/` (the service)
- `apps/server/src/cli/connect.ts` (+ tests)
- `apps/server/src/cloud/` (CLI OAuth, managed endpoints, boot service)
- `apps/server/src/relay/AgentAwarenessRelay.ts`
- `apps/mobile/src/features/cloud/`
- `apps/mobile/src/features/agent-awareness/`
- `scripts/announce-connect-ga.ts`
- `docs/internals/t3-connect.md`
- `docs/internals/t3-code-connect-auth-flow.html`
- `docs/operations/relay-observability.md`
- `docs/user/remote-access.md` (pairing + Connect + Tailscale + SSH)

### Nested skips inside copy-candidate packages

If Nero copies `apps/web`, `packages/client-runtime`, `packages/shared`,
`packages/contracts`, still **do not copy** these Connect-specific roots:

**Web**

| Path | What |
| --- | --- |
| `apps/web/src/cloud/` | publicConfig, DPoP, linkEnvironment, managed relay, CLI auth |
| `apps/web/src/components/cloud/` | Connect lists, onboarding, CLI auth, relay install dialog |
| `apps/web/src/components/clerk/T3Connect*.tsx` | Connect profile + sidebar sign-in |
| `apps/web/src/components/clerk/MobileClientsUserProfilePage*` | relay device list |
| `apps/web/src/components/clerk/useT3ConnectAuthPrompt.tsx` | Connect auth prompt |
| `apps/web/src/routes/connect.tsx` | `/connect` |
| `apps/web/src/routes/connect_.callback.tsx` | `/connect/callback` |
| `apps/web/src/hostedPairing.ts` | `DEFAULT_HOSTED_APP_URL` = `https://app.t3.codes` |

**Client runtime**

| Path | What |
| --- | --- |
| `packages/client-runtime/src/relay/` | discovery, managedRelay, errors |
| `packages/client-runtime/src/state/relayDiscovery.ts` | `./state/relay` export |

**Contracts**

| Path | What |
| --- | --- |
| `packages/contracts/src/relay.ts` | relay HTTP API schema (iOS APNs, environments) |
| `packages/contracts/src/relayClient.ts` | relay client helpers |
| `packages/contracts` export `./relay` | drop unless Nero builds its own relay |

**Shared**

| Path | What |
| --- | --- |
| `packages/shared/src/connectAuth.ts` | hosted `/connect` fragment protocol, `app.t3.codes` |
| `packages/shared/src/relayAuth.ts` | Clerk JWT template / audience |
| `packages/shared/src/relayClient.ts` | HTTP client |
| `packages/shared/src/relayJwt.ts` | JWT parse |
| `packages/shared/src/relaySigning.ts` | environment publish signatures |
| `packages/shared/src/relayUrl.ts` | `normalizeSecureRelayUrl` |
| `packages/shared/src/relayTracing.ts` | relay traces |
| `packages/shared/src/dpop.ts`, `dpopCommon.ts` | DPoP for relay |

Public env baked into web: `T3CODE_CLERK_*`, `T3CODE_RELAY_URL` /
`VITE_T3CODE_RELAY_URL` (`docs/internals/t3-connect.md`). Do not copy T3’s
Clerk app, JWT template `t3-relay`, audience `t3-code-relay`, or
`relay.t3.codes`.

---

## Adjacent T3-only roots (also do not copy)

Not in the seed list; still T3 product machinery, not Nero GUI.

### `scripts/` (workspace package)

T3 monorepo / release / desktop / mobile. Skip the tree.

| Path | Tied to |
| --- | --- |
| `scripts/dev-runner.ts`, `lib/dev-share.ts` | local T3 + Tailscale share |
| `scripts/build-desktop-artifact.ts` | Electron + resource-monitor |
| `scripts/sign-macos.ts` | desktop signing |
| `scripts/mobile-showcase.ts`, `mobile-native-static-check.ts` | mobile |
| `scripts/announce-connect-ga.ts` | T3 Connect GA |
| `scripts/merge-update-manifests.ts`, `mock-update-server.ts` | desktop/server updates |
| `scripts/notify-discord-release.ts`, `release-smoke.ts` | T3 releases |
| `scripts/export-brand-icons.ts`, `apply-web-brand-assets.ts` | T3 brand channels |

### `oxlint-plugin-t3code/`

Repo lint plugin. Mobile-specific rule
`no-mobile-uniwind-theme-escape-hatches` is useless to Nero. Other rules may
be useful later; do not copy the package as a T3 identity.

### `patches/` that exist only for skip surfaces

Keep only if Nero actually depends on the patched package. Skip at least:

| Patch | Surface |
| --- | --- |
| `patches/@clerk__expo@4.2.0.patch` | mobile |
| `patches/@expo%2Fmetro-config@56.0.14.patch` | mobile |
| `patches/@react-native-menu__menu@2.0.0.patch` | mobile |
| `patches/@react-native__gradle-plugin@0.85.3.patch` | mobile |
| `patches/@react-navigation%2Fnative-stack@7.17.6.patch` | mobile |
| `patches/expo-modules-jsi@56.0.10.patch` | mobile |
| `patches/react-native-*.patch` (gesture, keyboard, nitro, screens) | mobile |
| `patches/@ff-labs__fff-node@0.9.4.patch` | server native |

### Docs that describe skip products

| Path | Product |
| --- | --- |
| `docs/internals/t3-connect.md` | Connect |
| `docs/internals/t3-code-connect-auth-flow.html` | Connect |
| `docs/internals/resource-telemetry.md` | resource-monitor |
| `docs/internals/providers.md` | server adapters |
| `docs/internals/server-updates.md` | `t3` self-update |
| `docs/internals/remote.md` | Tailscale + SSH + Connect |
| `docs/operations/relay-observability.md` | relay |
| `docs/operations/mobile-app-store-screenshots.md` | mobile |
| `docs/operations/release.md` | T3 desktop/CLI/mobile release |
| `docs/user/install.md`, `updating.md`, `mobile-appearance.md` | T3 product |
| `docs/user/remote-access.md` | pairing / Connect / Tailscale / SSH |
| `docs/user/background-service.md` | desktop/CLI service |
| `docs/user/providers-*.md` | T3-hosted provider docs |

### Brand / native assets for skip surfaces

| Path | Surface |
| --- | --- |
| `assets/{dev,nightly,prod}/*-ios-*.png` | mobile |
| `assets/{dev,nightly,prod}/*-macos-*.png` | desktop |
| `assets/{dev,nightly,prod}/*-windows.ico` | desktop |
| `assets/*/app-icon.icon/` | desktop icon composer |
| `apps/desktop/resources/dmg/` | desktop installer |

Web favicon sources under `assets/*/t3-*-web-*` and
`apps/web/public/` are copy-candidate (rebrand later), not skip roots.

### Desktop-only islands inside `apps/web` (do not copy as Nero features)

Web is a copy-candidate **app**, but these directories exist only to drive
Electron. Skip as product features:

| Path | Why |
| --- | --- |
| `apps/web/src/browser/ElectronBrowserHost.tsx` | Electron webview host |
| `apps/web/src/browser/HostedBrowserWebview.tsx` | desktop preview webview |
| `apps/web/src/components/desktop/` | SSH password prompt dialog |
| `apps/web/src/components/desktopUpdate.*` | electron-updater toasts |
| `apps/web/src/components/sidebar/DesktopUpdateStatusIcon.tsx` | same |
| `apps/web/src/components/QuitHoldOverlay.tsx` | matches desktop QuitHold |
| `apps/web/src/connection/desktopLocal.ts` | local Electron backend bootstrap |
| `apps/web/src/connection/useDesktopLocalBootstraps.ts` | same |
| `apps/web/src/wslPaths.ts` | WSL path UI |
| `@clerk/electron` in `apps/web/package.json` + `main.tsx` | Electron Clerk/passkeys |

---

## Copy-candidate roots (explicitly **not** in this skip list)

Do not treat these as do-not-copy. Nested Connect/desktop islands above still
apply.

| Root | Package | Role |
| --- | --- | --- |
| `apps/web` | `@t3tools/web` | React/Vite GUI |
| `packages/client-runtime` | `@t3tools/client-runtime` | connection, RPC, Atom state |
| `packages/contracts` | `@t3tools/contracts` | wire schemas |
| `packages/shared` | `@t3tools/shared` | framework-agnostic helpers |
| `native/libghostty-vt` | (headers + VERSION) | web `scripts/build-libghostty-wasm.sh` vendor |

`apps/server` **devDepends on** `@t3tools/web` to serve the built UI. That
does not make the server a copy target.

---

## Import graph for skip packages

```
effect-acp                    → apps/server only
effect-codex-app-server       → apps/server only
@t3tools/ssh                  → apps/desktop only
@t3tools/tailscale            → apps/server + apps/desktop + scripts/lib/dev-share
t3code-relay                  → infra/relay (self)
@t3tools/desktop              → nothing else imports the package
@t3tools/mobile               → nothing else imports the package
@t3tools/marketing            → nothing else imports the package
native/resource-monitor       → apps/server resourceTelemetry + desktop artifact
```

`apps/web` sits on the other side of the WebSocket contract. It never
`import`s those packages.
