# 08 — `packages/shared`

Primary-source map of `@t3tools/shared` for Nero. Scope is **what `apps/web` and `packages/client-runtime` import**. Server-only modules are not taken. No previous Nero tree was consulted.

Package: `/tmp/t3code-upstream/packages/shared`. Subpath exports only (no barrel). Tests live next to sources (`*.test.ts`) and are not listed as separate modules.

## Rule

- **copy** — `apps/web` or `packages/client-runtime` import the subpath, **or** a copied module imports it relatively (must travel with the copy-set).
- **delete** — not imported by web/runtime and not a relative dep of a copied module. Includes server/desktop/scripts Node helpers and mobile-only modules.

## Counts

| Bucket | Modules |
| --- | ---: |
| Direct copy (web and/or runtime) | 38 |
| Transitive copy (relative dep of copy-set) | 4 |
| Delete (do not take) | 15 |
| Exported subpaths | 57 |

## Internal edges that force transitive copies

| Copied module | Relative imports that must come along |
| --- | --- |
| `dpop` | `dpopCommon`, `relaySigning` |
| `t3ProjectFile` | `schemaJson` |
| `serverSettings` | `Struct`, `schemaJson`, `model`, `backgroundActivitySettings` |
| `git` | `sourceControl` (already a direct web import) |
| `connectAuth` | `remote` (already a direct web/runtime import) |
| `themePreview` | `themePalettes` (already a direct web import) |

## Table

| module | imported by web/runtime? | copy/delete |
| --- | --- | --- |
| `advertisedEndpoint` | runtime (`environment/endpoint.ts` re-exports) | **copy** |
| `agentAwareness` | no (server `AgentAwarenessRelay` only) | **delete** |
| `backgroundActivitySettings` | web (settings panels) | **copy** |
| `chatList` | web (`ChatView`, `MessagesTimeline`) | **copy** |
| `claudeCompaction` | web (`ContextWindowMeter.logic`) | **copy** |
| `cliArgs` | no (server Claude/Codex adapters) | **delete** |
| `composerInlineTokens` | web (composer editor / paste) | **copy** |
| `composerTrigger` | web (composer file links) | **copy** |
| `connectAuth` | web (hosted pairing, connect CLI) | **copy** |
| `devHome` | no (scripts / server migrate) | **delete** |
| `devProxy` | web (`vite.config.ts`; shared prefix list) | **copy** |
| `dpop` | web (`cloud/dpop`) | **copy** |
| `dpopCommon` | no (relative from `dpop`; mobile imports it) | **copy** (transitive) |
| `DrainableWorker` | no (server orchestration reactors) | **delete** |
| `filePreview` | web (`FilePreviewPanel`) | **copy** |
| `git` | web + runtime (branch UI, VCS state) | **copy** |
| `hostProcess` | no (`node:os`; server/desktop/scripts) | **delete** |
| `httpObservability` | runtime (`rpc/http.ts` redaction layer) | **copy** |
| `httpReadiness` | no (desktop backend / ssh) | **delete** |
| `keybindings` | web (settings + `state/server`) | **copy** |
| `KeyedCoalescingWorker` | no (server terminal manager) | **delete** |
| `logging` | no (`node:fs` rotating sink) | **delete** |
| `model` | web (picker, drafts, settings) | **copy** |
| `Net` | no (`node:net`; server/desktop) | **delete** |
| `oauthScope` | runtime (remote auth + managed relay) | **copy** |
| `observability` | no (pulls `logging`; server/desktop OTLP) | **delete** |
| `orchestrationTiming` | no (mobile thread activity only) | **delete** |
| `path` | web + runtime (project path normalize) | **copy** |
| `preview` | web (browser/preview hosts) | **copy** |
| `previewViewport` | web (device toolbar, integrations) | **copy** |
| `projectFavicon` | web (`ProjectFavicon`) | **copy** |
| `projectScripts` | web (`ChatView`, hooks, tests) | **copy** |
| `qrCode` | web (`components/ui/qr-code.tsx`) | **copy** |
| `relayAuth` | web (Clerk hostname / token options) | **copy** |
| `relayClient` | no (cloudflared install/spawn; server) | **delete** |
| `relayJwt` | runtime (managed relay + discovery) | **copy** |
| `relaySigning` | no (relative from `dpop`; also relay infra) | **copy** (transitive) |
| `relayTracing` | web + runtime (client tracer layer) | **copy** |
| `relayUrl` | web + runtime (secure relay URL) | **copy** |
| `remote` | web + runtime (pairing / onboarding) | **copy** |
| `schemaJson` | no (relative from `t3ProjectFile` + `serverSettings`) | **copy** (transitive) |
| `schemaYaml` | no (server CLI / build scripts) | **delete** |
| `searchRanking` | web (model/skill/file search) | **copy** |
| `semver` | web (`versionSkew`) | **copy** |
| `serverSettings` | web (source-control writer model) | **copy** |
| `shell` | no (`node:child_process`; server/scripts) | **delete** |
| `sourceControl` | web (PR presentation) | **copy** |
| `String` | web (`ChatView` truncate) | **copy** |
| `Struct` | no (relative from `serverSettings`) | **copy** (transitive) |
| `t3ProjectFile` | web (parse `t3.json` defaults) | **copy** |
| `terminalLabels` | web (chat + right panel) | **copy** |
| `themePalettes` | web (`themePalette.ts`) | **copy** |
| `themePreview` | web (`ThemePreviewCircles`) | **copy** |
| `threadEnvMode` | web (`useHandleNewThread`) | **copy** |
| `toolActivity` | no (server ACP runtime only) | **delete** |
| `usageFormat` | web (usage page/charts) | **copy** |
| `usageMerge` | web (usage state + charts) | **copy** |

## Delete list (do not take)

Node / host process: `hostProcess`, `logging`, `observability`, `shell`, `Net`, `devHome`, `httpReadiness`, `relayClient`.

Server orchestration / adapters: `agentAwareness`, `DrainableWorker`, `KeyedCoalescingWorker`, `cliArgs`, `toolActivity`.

Other non-web/runtime: `schemaYaml` (YAML CLI), `orchestrationTiming` (mobile-only; browser-safe but unused by web/runtime).

## Copy-set notes

- Browser-safe. The 42 copy modules do not import `node:*`. The Node-bound files are all in the delete list.
- `dpop` needs `@noble/curves` + `@noble/hashes`. `relayJwt` needs `jose`. `yaml` is only for `schemaYaml` — drop it if that export is not copied.
- `serverSettings` is a fat module (full server settings patch/normalize). Web only calls `resolveSourceControlWriterModelSelection`. Copy the module as-is; do not split unless Nero later trims settings.
- `devProxy` is a four-prefix constant used by Vite and the server catch-all. Copy it with web; it is not Node-specific.
- `qrCode` is a vendored Nayuki generator; web wraps it. Copy the file, keep the license header.
- Tests for copied modules can come along. Tests for deleted modules (`Net.test.ts`, `shell.test.ts`, `logging.test.ts`, …) stay behind.

## Direct importers (web)

| module | representative importers |
| --- | --- |
| `backgroundActivitySettings` | `components/settings/SettingsPanels*.ts(x)`, Provider/SourceControl settings |
| `chatList` | `components/ChatView.tsx`, `components/chat/MessagesTimeline.tsx` |
| `claudeCompaction` | `components/chat/ContextWindowMeter.logic.ts` |
| `composerInlineTokens` | `composer-editor-mentions.ts`, `composerInlineTokenPaste.ts` |
| `composerTrigger` | `ComposerPromptEditor.tsx`, `ChatComposer.tsx`, file browser / mention drag |
| `connectAuth` | `hostedPairing.ts`, `cloud/connectCliAuth.ts`, `ConnectCliAuthSurface.tsx` |
| `devProxy` | `vite.config.ts` |
| `dpop` | `cloud/dpop.ts` (+ test) |
| `filePreview` | `components/files/FilePreviewPanel.tsx` |
| `git` | `ChatView.tsx`, `BranchToolbar.logic.ts`, `GitActionsControl.logic.ts` |
| `keybindings` | `state/server.ts`, Keybindings + Project settings |
| `model` | `modelSelection.ts`, composer/picker/settings/drafts |
| `path` | `diffFileActions.ts`, `ProjectFaviconPickerDialog.tsx` |
| `preview` | preview + browser host modules |
| `previewViewport` | `BrowserDeviceToolbar.tsx`, Integrations settings, Preview automation |
| `projectFavicon` | `components/ProjectFavicon.tsx` |
| `projectScripts` | `ChatView.tsx`, `useT3ProjectFileScripts.ts` |
| `qrCode` | `components/ui/qr-code.tsx` |
| `relayAuth` | `cloud/publicConfig.ts`, `cloud/connectCliAuth.ts` |
| `relayTracing` | `lib/runtime.ts` |
| `relayUrl` | `cloud/publicConfig.ts` |
| `remote` | `pairingUrl.ts` |
| `searchRanking` | skill/model/slash/file pickers |
| `semver` | `versionSkew.ts` |
| `serverSettings` | `SourceControlWritingSettings.tsx` |
| `sourceControl` | `sourceControlPresentation.ts` |
| `String` | `ChatView.tsx` |
| `t3ProjectFile` | `useT3ProjectFileScripts.ts`, `lib/t3ProjectFileDefaults.ts` |
| `terminalLabels` | `ChatView.tsx`, `ThreadTerminalDrawer.tsx`, `RightPanelTabs.tsx` |
| `themePalettes` | `themePalette.ts` |
| `themePreview` | `ThemePreviewCircles.tsx` |
| `threadEnvMode` | `hooks/useHandleNewThread.ts` |
| `usageFormat` / `usageMerge` | `state/usage.ts`, `components/usage/*` |

## Direct importers (client-runtime)

| module | importers |
| --- | --- |
| `advertisedEndpoint` | `src/environment/endpoint.ts` |
| `git` | `src/state/gitActions.ts`, `src/state/vcs.ts` |
| `httpObservability` | `src/rpc/http.ts` |
| `oauthScope` | `src/authorization/remote.ts`, `src/relay/managedRelay.ts` |
| `path` | `src/state/projects.ts` |
| `relayJwt` | `src/relay/{discovery,managedRelay,managedRelayState}.ts` |
| `relayTracing` | `src/connection/{supervisor,resolver}.ts`, `src/relay/managedRelay.ts` |
| `relayUrl` | `src/relay/managedRelay.ts` |
| `remote` | `src/connection/onboarding.ts` |
