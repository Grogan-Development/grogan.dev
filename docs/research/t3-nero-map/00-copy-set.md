# T3 → Nero web-skin copy-set

Source: `pingdotgg/t3code` HEAD `0009aacdf146e0532327fa3d9d0109d5adca68b9` at `/tmp/t3code-upstream`.

Policy (locked): copy the T3 **frontend** then CHANGE MAP. Do not rewrite the UI. Do not copy T3 server, T3 Connect, or Codex/Claude/Cursor/Grok/OpenCode harnesses. After adapt there must be no T3-the-product remnants.

Columns:

- **copy** — take this path into Nero on the first pass.
- **adapt** — CHANGE MAP after copy (rebrand, single GLM harness, drop Connect/Clerk/self-update/5-provider UI).
- **delete** — do not copy (or drop immediately after copy). Never a Nero package.

---

## Verdict

`apps/web` workspace-depends on **only three** packages:

```json
"@t3tools/client-runtime": "workspace:*",
"@t3tools/contracts": "workspace:*",
"@t3tools/shared": "workspace:*"
```

Cited: [`apps/web/package.json`](file:///tmp/t3code-upstream/apps/web/package.json) lines 29–31.

Those three form a closed graph:

- `client-runtime` → `contracts` + `shared` ([`packages/client-runtime/package.json`](file:///tmp/t3code-upstream/packages/client-runtime/package.json) 163–166)
- `shared` → `contracts` ([`packages/shared/package.json`](file:///tmp/t3code-upstream/packages/shared/package.json) 239–245)
- `contracts` → `effect` only ([`packages/contracts/package.json`](file:///tmp/t3code-upstream/packages/contracts/package.json) 27–29)

Web does **not** import `@t3tools/ssh`, `@t3tools/tailscale`, `effect-acp`, `effect-codex-app-server`, `@t3tools/desktop`, `@t3tools/mobile`, `t3` (server), or `t3code-relay`.

**Ghostty:** yes, copy `native/libghostty-vt`. The web terminal loads committed WASM from `apps/web/src/terminal/ghostty/vendor/`, but rebuilds pin the revision from `native/libghostty-vt/VERSION` ([`apps/web/scripts/build-libghostty-wasm.sh`](file:///tmp/t3code-upstream/apps/web/scripts/build-libghostty-wasm.sh) lines 8–11, 114; [`docs/architecture/terminal-renderers.md`](file:///tmp/t3code-upstream/docs/architecture/terminal-renderers.md)).

---

## Web workspace import graph

### `@t3tools/client-runtime/*` used by `apps/web`

From `apps/web` sources (not a subset — copy the whole package, then strip Connect):

| Subpath | Example cite |
| --- | --- |
| `authorization` | `apps/web/src/connection/platform.ts`, `connection/storage.ts` |
| `connection` | `apps/web/src/connection/runtime.ts`, `state/environments.ts` |
| `environment` | `apps/web/src/threadRoutes.ts`, `routes/__root.tsx` |
| `errors` | `apps/web/src/rpc/transportError.ts`, `hooks/useSettings.ts` |
| `markdown-images` | `apps/web/src/components/ChatMarkdown.tsx` |
| `operations/projects` | `apps/web/src/components/CommandPalette.tsx` |
| `platform` | `apps/web/src/connection/platform.ts`, `connection/storage.ts` |
| `providerSkills` | `apps/web/src/providerSkillSearch.ts` |
| `relay` | `apps/web/src/cloud/*`, `state/environments.ts` — **T3 Connect; delete after copy** |
| `rpc` | `apps/web/src/environments/primary/httpClient.ts`, `lib/runtime.ts` |
| `state/assets` | `apps/web/src/assets/assetUrls.ts` |
| `state/auth` | `apps/web/src/state/auth.ts` |
| `state/connections` | `apps/web/src/connection/catalog.ts` |
| `state/filesystem` | `apps/web/src/state/filesystem.ts`, `CommandPalette.logic.ts` |
| `state/git` | `apps/web/src/state/git.ts` |
| `state/models` | `apps/web/src/components/Sidebar.tsx` |
| `state/orchestration` | `apps/web/src/state/orchestration.ts` |
| `state/presentation` | `apps/web/src/state/presentation.ts` |
| `state/preview` | `apps/web/src/state/preview.ts` |
| `state/projects` | `apps/web/src/state/projects.ts` |
| `state/project-grouping` | `apps/web/src/logicalProject.ts` |
| `state/pull-requests` | `apps/web/src/state/pullRequests.ts` |
| `state/relay` | `apps/web/src/state/relay.ts` — **Connect; delete after copy** |
| `state/review` | `apps/web/src/state/review.ts` |
| `state/runtime` | `apps/web/src/state/use-atom-command.ts` and many |
| `state/server` | `apps/web/src/state/server.ts` |
| `state/session` | `apps/web/src/state/session.ts` |
| `state/shell` | `apps/web/src/state/shell.ts`, `state/entities.ts` |
| `state/source-control` | `apps/web/src/state/sourceControl.ts` |
| `state/subagentRuntime` | `apps/web/src/components/AgentsPanel.tsx` |
| `state/terminal` | `apps/web/src/state/terminal.ts` |
| `state/thread-search` | `apps/web/src/state/queries.ts` |
| `state/thread-settled` | `apps/web/src/hooks/useThreadActions.ts` |
| `state/thread-sort` | `apps/web/src/components/Sidebar.logic.ts` |
| `state/threads` | `apps/web/src/state/threads.ts` |
| `state/vcs` | `apps/web/src/state/vcs.ts` |

Package exports also include `operations` (root) and `state/entities`; web does not import those two subpaths directly. Copy the package anyway — CHANGE MAP at package grain, not cherry-pick files.

`client-runtime` itself only imports `@t3tools/contracts`, `@t3tools/contracts/relay`, and `@t3tools/shared/{advertisedEndpoint,git,httpObservability,oauthScope,path,relayJwt,relayTracing,relayUrl,remote}`. No ssh/tailscale/acp/codex packages.

### `@t3tools/contracts` used by `apps/web`

Root export (`@t3tools/contracts`) plus:

- `@t3tools/contracts/settings` — `composerDraftStore.ts`, `modelSelection.ts`, `appearanceContrast.ts`, `timestampFormat.ts`
- `@t3tools/contracts/relay` — **only** `apps/web/src/cloud/*` and `apps/web/src/components/clerk/*` (T3 Connect). Delete after copy.

Contracts barrel ([`packages/contracts/src/index.ts`](file:///tmp/t3code-upstream/packages/contracts/src/index.ts)) also re-exports desktop IPC, bootstrap, remote access, `t3ProjectFile`, five-provider model defaults ([`packages/contracts/src/model.ts`](file:///tmp/t3code-upstream/packages/contracts/src/model.ts) lines 130–225: `codex`, `claudeAgent`, `cursor`, `grok`, `opencode`). Copy whole package; adapt those modules.

### `@t3tools/shared/*` used by `apps/web`

Direct web imports:

`backgroundActivitySettings`, `chatList`, `claudeCompaction`, `composerInlineTokens`, `composerTrigger`, `connectAuth`, `devProxy`, `dpop`, `filePreview`, `git`, `keybindings`, `model`, `path`, `preview`, `previewViewport`, `projectFavicon`, `projectScripts`, `qrCode`, `relayAuth`, `relayTracing`, `relayUrl`, `remote`, `searchRanking`, `semver`, `serverSettings`, `sourceControl`, `String`, `t3ProjectFile`, `terminalLabels`, `themePalettes`, `themePreview`, `threadEnvMode`, `usageFormat`, `usageMerge`.

Vite also imports `devProxy` ([`apps/web/vite.config.ts`](file:///tmp/t3code-upstream/apps/web/vite.config.ts) line 13).

`claudeCompaction`, `connectAuth`, `dpop`, `relayAuth`, `relayTracing`, `relayUrl`, `t3ProjectFile` are T3-product or Connect-shaped — copy then strip/rename.

Shared modules **not** imported by web (server/desktop/tooling): `cliArgs`, `hostProcess`, `DrainableWorker`, `KeyedCoalescingWorker`, `Net`, `schemaJson`, `schemaYaml`, `observability`, `logging`, `httpReadiness`, `devHome`, `shell`, `orchestrationTiming`, `relaySigning` (transitive via `dpop.ts`), `relayClient`, `toolActivity`, `Struct`, `oauthScope` (used by `client-runtime`, not web). Copy the package; drop unused files in CHANGE MAP, not on first copy.

---

## Packages web needs vs not

| Package | Web graph? | Who actually uses it |
| --- | --- | --- |
| `@t3tools/web` (`apps/web`) | **is** the skin | web + served by `apps/server` (`t3` lists `@t3tools/web` as a **devDependency** in [`apps/server/package.json`](file:///tmp/t3code-upstream/apps/server/package.json) line 43) |
| `@t3tools/client-runtime` | yes | web + mobile + desktop + `infra/relay` |
| `@t3tools/contracts` | yes | everything |
| `@t3tools/shared` | yes | web + server + desktop + relay + scripts |
| `@t3tools/ssh` | **no** | desktop only ([`apps/desktop/package.json`](file:///tmp/t3code-upstream/apps/desktop/package.json) line 21) |
| `@t3tools/tailscale` | **no** | server + desktop + `scripts` |
| `effect-acp` | **no** | server ACP drivers ([`docs/internals/workspace-layout.md`](file:///tmp/t3code-upstream/docs/internals/workspace-layout.md) lines 35–37) |
| `effect-codex-app-server` | **no** | server Codex harness ([same doc](file:///tmp/t3code-upstream/docs/internals/workspace-layout.md) lines 37–38) |
| `t3` (`apps/server`) | **no** | T3 execution runtime; Nero replaces this with a Pi-like harness |
| `@t3tools/desktop` | **no** | Electron shell wrapping the web bundle |
| `@t3tools/mobile` | **no** | RN client; parallel consumer of client-runtime |
| `@t3tools/marketing` | **no** | Astro site |
| `t3code-relay` (`infra/relay`) | **no** | hosted T3 Connect |
| `@t3tools/oxlint-plugin-t3code` | not a runtime dep | root `vite.config.ts` lint plugin |
| `@t3tools/scripts` | not a runtime dep | `apps/web/vite.config.ts` imports `scripts/lib/public-config.ts`; Vercel build runs `scripts/apply-web-brand-assets.ts` |

Workspace members from [`pnpm-workspace.yaml`](file:///tmp/t3code-upstream/pnpm-workspace.yaml): `apps/*`, `infra/*`, `oxlint-plugin-t3code`, `packages/*`, `scripts`.

---

## Table: path | copy | adapt | delete | why

### Apps

| path | copy | adapt | delete | why |
| --- | --- | --- | --- | --- |
| `apps/web` | yes | yes | no | The skin. Copy the whole tree (routes, components, terminal WASM, tests). Then CHANGE MAP: Clerk/Connect, five-provider Settings, T3 branding, desktop-only IPC UI. |
| `apps/web/package.json` | yes | yes | no | Drop `@clerk/electron`, `@clerk/react`; rename `@t3tools/*` → Nero scope; keep Ghostty wasm script. |
| `apps/web/vite.config.ts` | yes | yes | no | Relays Clerk + `VITE_T3CODE_RELAY_URL` + `loadRepoEnv` from `scripts/lib/public-config`. Point at Nero local API; do not bake origins. |
| `apps/web/vercel.ts` | yes | yes | maybe | Hosted `app.t3.codes` pipeline (`apply-web-brand-assets`). Keep only if Nero hosts a web app; otherwise drop. |
| `apps/web/src/cloud/**` | yes | no | **yes after copy** | T3 Connect: pairing, DPoP, managed relay, Clerk session. |
| `apps/web/src/components/clerk/**` | yes | no | **yes after copy** | Clerk-for-T3 / T3 Connect account UI. |
| `apps/web/src/components/cloud/**` | yes | no | **yes after copy** | Connect CLI auth, relay install dialogs. |
| `apps/web/src/routes/connect.tsx`, `connect_.callback.tsx` | yes | no | **yes after copy** | Connect routes. |
| `apps/web/src/routes/pair.tsx` | yes | yes | maybe | Local pairing against T3 `npx t3`. Nero may keep a simpler local-token gate. |
| `apps/web/src/routes/settings.providers.tsx` + `components/settings/Provider*` + `AddProviderInstance*` | yes | yes | partial | Five-provider instance wizard. Collapse to one GLM-5.3-Flash (Baseten) picker. |
| `apps/web/src/routes/settings.connections.tsx` + `ConnectionsSettings*` | yes | yes | partial | Multi-environment / Connect catalog. Nero is one local harness. |
| `apps/web/src/components/desktopUpdate*` , `sidebar/DesktopUpdate*`, `ServerUpdateAction*` | yes | no | **yes after copy** | T3 self-update. Policy forbids remnants. |
| `apps/web/src/components/ProviderUpdate*` | yes | no | **yes after copy** | Provider CLI self-update toasts. |
| `apps/web/src/main.tsx` | yes | yes | no | `ClerkProvider` / `ElectronClerkProvider` ([lines 3–5, 37+](file:///tmp/t3code-upstream/apps/web/src/main.tsx)). Strip. |
| `apps/web/src/branding.ts` | yes | yes | no | Hardcoded `"T3 Code"` ([line 19](file:///tmp/t3code-upstream/apps/web/src/branding.ts)). |
| `apps/web/src/browser/ElectronBrowserHost.tsx` and desktop tab lifetime | yes | yes | maybe | Desktop wrap of web. Nero web-only: keep preview iframe path, drop Electron webview. |
| `apps/web/src/state/desktop{Update,SshHosts,WslState,NetworkAccess}*` + `components/desktop/SshPasswordPromptDialog.tsx` | yes | no | **yes after copy** | Desktop IPC surfaces compiled into the web bundle. |
| `apps/web/src/terminal/ghostty/**` | yes | no | no | Canvas terminal. Keep `vendor/*.wasm`, `core.ts`, `renderer.ts`, fonts. |
| `apps/web/scripts/build-libghostty-wasm.sh` + `ghostty-write-pty.zig` | yes | yes | no | Rebuild path; cache dir is `~/.cache/t3code` — rename. |
| `apps/web/public/**` | yes | yes | no | T3 favicons/manifest; replace with Nero marks. |
| `apps/web/index.html` | yes | yes | no | `t3code:` localStorage keys ([lines 17–20](file:///tmp/t3code-upstream/apps/web/index.html)). |
| `apps/server` | no | no | **yes** | T3 orchestration, provider CLIs, PTY, sqlite. Nero is a different harness. Server **consumes** web; web does not import server. |
| `apps/desktop` | no | no | **yes** | Electron shell, SSH environments, Clerk electron, self-update. |
| `apps/mobile` | no | no | **yes** | RN client. Same runtime as web, different UI. |
| `apps/marketing` | no | no | **yes** | t3.codes marketing. |

### Packages (`packages/*`)

| path | copy | adapt | delete | why |
| --- | --- | --- | --- | --- |
| `packages/client-runtime` | yes | yes | no | Required by web. After copy: delete `src/relay/**`, `state/relayDiscovery.ts`, Connect DPoP token store; retarget `rpc` at Nero WS/HTTP; collapse `providerSkills` to one harness. |
| `packages/contracts` | yes | yes | no | Wire types the UI already speaks. After copy: delete `relay.ts` / `relayClient.ts`; rewrite `model.ts` five-provider defaults; slim `ipc.ts` / `desktopBootstrap.ts` if no Electron; rename `t3ProjectFile.ts`. |
| `packages/shared` | yes | yes | no | Theme, composer, git helpers, preview, usage. After copy: delete `connectAuth`, `relay*`, `dpop*` (if Connect gone), `claudeCompaction` (Claude-only meter). Keep `themePalettes`, `chatList`, `composer*`, `keybindings`, `path`, `preview*`. |
| `packages/ssh` | no | no | **yes** | Desktop SSH environments. Web never imports it. |
| `packages/tailscale` | no | no | **yes** | Server Tailscale serve. Web never imports it. |
| `packages/effect-acp` | no | no | **yes** | Cursor/ACP provider driver. Server-only harness. |
| `packages/effect-codex-app-server` | no | no | **yes** | Codex `app-server` JSON-RPC. Server-only harness. |

### Native

| path | copy | adapt | delete | why |
| --- | --- | --- | --- | --- |
| `native/libghostty-vt` | **yes** | no | no | Pin + C ABI headers + LICENSE. Web WASM build reads `VERSION` (`9f62873bf195e4d8a762d768a1405a5f2f7b1697`). Terminal web UI **does** need this tree even though the committed wasm lives under `apps/web`. |
| `native/libghostty-vt/include/**` | yes | no | no | ABI reference; web runtime calls `ghostty_*` exports by name (`apps/web/src/terminal/ghostty/core.ts`). |
| `native/resource-monitor` | no | no | **yes** | Rust sidecar for server/desktop telemetry. Web only *displays* resource telemetry over RPC. |

### Infra / other workspace members

| path | copy | adapt | delete | why |
| --- | --- | --- | --- | --- |
| `infra/relay` | no | no | **yes** | T3 Connect (`t3code-relay`). Policy: no T3 Connect. |
| `oxlint-plugin-t3code` | optional | yes | default **yes** | T3-named lint plugin; not imported by web runtime. Copy only if Nero keeps the same `vp lint` setup. |
| `scripts` (package) | partial | yes | mostly | Do **not** copy desktop artifact / mobile showcase / Discord / Connect GA scripts. |
| `scripts/lib/public-config.ts` | yes | yes | no | Included by `apps/web/tsconfig.json` and imported from `apps/web/vite.config.ts`. Clerk + relay env bootstrap. |
| `scripts/apply-web-brand-assets.ts` + `scripts/lib/brand-assets.ts` | yes | yes | maybe | Vercel copies T3 channel icons into `apps/web/public`. Replace with Nero assets or drop. |
| `scripts/lib/{icon-export,public-config}.test.ts` | optional | — | optional | Only if those helpers ship. |
| `scripts/package.json` | no | — | **yes** | Pulls `@t3tools/tailscale`, electron-asar, pngjs. Do not take the whole scripts package. |
| `scripts/dev-runner.ts` | no | — | **yes** | Starts T3 server+web with T3 home. Nero runner is different. |

### Root / tooling

| path | copy | adapt | delete | why |
| --- | --- | --- | --- | --- |
| `package.json` (root `@t3tools/monorepo`) | yes | yes | no | Workspace scripts, `msw.workerDirectory: apps/web/public`. Strip desktop/mobile/connect/release scripts. |
| `pnpm-workspace.yaml` | yes | yes | no | Narrow `packages:` to web + client-runtime + contracts + shared. Strip Clerk/Electron/Expo catalog + Claude SDK overrides. |
| `pnpm-lock.yaml` | no | — | **yes** | Regenerated after workspace shrink. |
| `tsconfig.base.json` | yes | no | no | Shared compiler + Effect language-service rules. Web extends it. |
| `vite.config.ts` (root) | yes | yes | no | `~` alias → `apps/web/src`; lint bans `@t3tools/client-runtime` root import. Drop mobile ignore globs. |
| `t3.json` | no | — | **yes** | T3 project file (`t3.codes/schema`). Not Nero. |
| `app.json` | no | — | **yes** | Expo/mobile. |
| `LICENSE` | yes | maybe | no | Legal; keep MIT unless Nero license differs. |
| `AGENTS.md` / `Claude.md` / `CONTRIBUTING.md` / `README.md` | no | — | **yes** | T3 contributor docs. |
| `assets/` | yes | yes | no | Web favicons sourced here (`assets/{dev,nightly,prod}/*web*`). Replace marks; do not ship T3 logos. |
| `patches/@legendapp__list@3.3.5.patch` | yes | no | no | Web dep `@legendapp/list`. |
| `patches/@pierre%2Fdiffs@1.3.0-beta.10.patch` | yes | no | no | Web dep `@pierre/diffs`. |
| `patches/effect@4.0.0-beta.103.patch` | yes | no | no | Catalog `effect` used by web + runtime + contracts. |
| `patches/@effect__vitest@4.0.0-beta.103.patch` | yes | no | no | Web/runtime tests. |
| `patches/@clerk__expo@4.2.0.patch` | no | — | **yes** | Mobile Clerk. |
| `patches/@expo*` / `react-native-*` / `expo-modules-jsi*` / `@react-navigation*` / `@react-native*` / `@ff-labs__fff-node*` | no | — | **yes** | Mobile/server. `fff-node` is a **server** dep. |
| `docs/` | no | — | **yes** | T3 product/ops docs. Optional later: only `docs/architecture/terminal-renderers.md` as Ghostty notes. |
| `experiments/` | no | — | **yes** | Throwaway. |
| `packaging/` | no | — | **yes** | AUR T3 Code packages. |
| `.repos/` | no | — | **yes** | Vendored references; AGENTS.md forbids importing. |
| `oxlint-plugin-t3code` | see above | | | |

---

## First-pass copy list (do this, then CHANGE MAP)

Copy these trees as-is:

1. `apps/web/`
2. `packages/client-runtime/`
3. `packages/contracts/`
4. `packages/shared/`
5. `native/libghostty-vt/`
6. `tsconfig.base.json`
7. Root `package.json` + `pnpm-workspace.yaml` + `vite.config.ts` (then immediately shrink)
8. `scripts/lib/public-config.ts` (and tests if you keep Vite env loading)
9. `patches/{@legendapp__list@3.3.5,@pierre%2Fdiffs@1.3.0-beta.10,effect@4.0.0-beta.103,@effect__vitest@4.0.0-beta.103}.patch`
10. `assets/` (then rebrand)

Do **not** copy:

- `apps/server`, `apps/desktop`, `apps/mobile`, `apps/marketing`
- `infra/relay`
- `packages/ssh`, `packages/tailscale`, `packages/effect-acp`, `packages/effect-codex-app-server`
- `native/resource-monitor`
- T3 Connect, Clerk-for-T3, self-update, five provider CLIs

---

## CHANGE MAP seeds (after copy)

Not a rewrite. Path-level edits inside the copied set:

| After-copy target | Change |
| --- | --- |
| `@t3tools/*` names | Rename to Nero scope everywhere in the four copied packages. |
| `apps/web/src/main.tsx` | Remove Clerk/Electron Clerk. |
| `apps/web/src/cloud/**`, `components/clerk/**`, `components/cloud/**`, `routes/connect*` | Delete. |
| `packages/client-runtime/src/relay/**`, `state/relayDiscovery.ts`, `./relay` export | Delete. |
| `packages/contracts/src/relay.ts`, `relayClient.ts`, `./relay` export | Delete. |
| `packages/shared/src/{connectAuth,relay*,dpop*,claudeCompaction,t3ProjectFile}*` | Delete or rename; `dpop` is only for Connect. |
| `packages/contracts/src/model.ts` | One driver (`glm` / Nero), one default model (GLM-5.3-Flash). |
| `apps/web` provider settings / icons / `ProviderDriverKind` UI | Single harness. |
| Branding, favicons, `t3code:` storage keys, `APP_BASE_NAME` | Nero. |
| Desktop update / SSH / WSL / server-update UI compiled into web | Delete. |
| `apps/web/vite.config.ts` | Proxy `/api` `/ws` to Nero harness; drop relay/Clerk injects. Keep single-origin discipline (`DEV_PROXIED_PATH_PREFIXES` in `packages/shared/src/devProxy.ts`). |

Nero **does not** get a copy of T3’s server. The copied `client-runtime/rpc` + `contracts` RPC group is the interface the new Pi-like harness must satisfy (or the CHANGE MAP must shrink). That contract mapping is a later research note; this file only fixes the **web skin copy-set**.
