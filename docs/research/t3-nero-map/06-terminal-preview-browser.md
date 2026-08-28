# T3 terminal, preview, browser, assets, right panel

Primary-source map of T3 Code’s web surfaces for Nero. Implementations must serve Nero’s locked UI, not copy T3’s Electron-only browser. **No Nero / code-broker / grid-01 product code was consulted.**

Nero locked (from the brief, not from Nero source):

- **Terminal** is a tab.
- **In-browser preview** exists (the guest page runs in the browser, not a native Chromium webview).
- **Agent display can be preview** (the same preview surface, driven by the agent).
- **Seat is a separate virtual display** (not this panel).

T3’s closest analog is the **thread-scoped right panel** plus a **bottom terminal drawer**. The important mismatch: T3’s **URL preview is desktop-only**. The **web terminal is real** (WASM Ghostty + server PTY). Do not treat “preview” and “file preview” as the same thing.

---

## 1. What T3 actually ships

T3 clients talk to a Node WebSocket server. PTYs and preview *session metadata* live on the server. Renderers never cross the wire.

| Surface | Web (`npx t3` / app.t3.codes) | Desktop (Electron wrapping the same web bundle) |
| --- | --- | --- |
| Terminal (PTY + Ghostty canvas) | Yes | Yes |
| Right-panel **terminal tab** | Yes, when a project is open | Same |
| Bottom **terminal drawer** (`mod+j`) | Yes | Same |
| In-app **URL browser / preview** | **No.** Empty copy: “Preview is only available in the T3 Code desktop app.” | Yes. Chromium `<webview>` owned by Electron main |
| Agent-driven browser (click/type/snapshot) | Hosts connect; no webview to drive | Same webview, automation via WS + desktop IPC |
| Workspace **file** tree + editor in the right panel | Yes | Yes |
| HTML/PDF **opened in the URL preview** | Blocked (`BrowserPreviewUnavailableError`) | Signed asset URL → `preview.open` |
| Localhost **port discovery** | Stream exists; empty-state cards only useful if preview can open | Same stream, cards open the webview |
| Seat / virtual display | **None** | Picture-in-picture + floating mini-player are window chrome, not a display server |

**Naming trap.** T3’s right-panel kind `"preview"` is the **browser tab**. The file tree / code viewer is kinds `"files"` / `"file"`. `FilePreviewPanel` is the workspace file surface, not the URL guest.

---

## 2. Architecture in one picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ChatView                                                                │
│  ┌──────────────┐   ┌─────────────────────────────────────────────────┐ │
│  │ transcript   │   │ RightPanelTabs  (mod+alt+b)                     │ │
│  │              │   │  surfaces: preview | terminal | files | file    │ │
│  │              │   │            | diff | pull-request | agents       │ │
│  └──────────────┘   └─────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ ThreadTerminalDrawer  (mod+j)  — same PTY sessions, not a tab     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

PTY bytes  ←WS→  terminal.attach / terminal.write / terminal.resize
Session meta ←WS→  subscribeTerminalMetadata, subscribeTerminalEvents
Preview meta ←WS→  preview.* + subscribePreviewEvents
Guest pixels     Electron <webview>  (desktop only; positioned by BrowserSurfaceSlot)
Port list    ←WS→  subscribeDiscoveredLocalServers
Workspace files ←WS→  projects.listEntries / readFile / writeFile
Images/HTML  ←HTTP signed URL→  assets.createUrl
```

Two independent stores:

- `rightPanelStore` — which **tabs** are open, persisted `t3code:right-panel-state:v2`.
- `terminalUiStateStore` — drawer open/height/split groups, persisted `t3code:terminal-state:v1`.

A PTY session is keyed `(threadId, terminalId)` with client-allocated ids (`term-1`, `term-2`, …). Drawer and panel **partition** the same server list: a terminal id in a right-panel surface is filtered out of the drawer so two canvases never attach the same stream.

---

## 3. File inventory (web)

Root of this map: `/tmp/t3code-upstream/apps/web/src`. Contracts and runtime sit beside it.

### 3.1 Terminal renderer — `apps/web/src/terminal/ghostty/`

Official **libghostty-vt** C ABI compiled to WASM. Not xterm.js. React is forbidden on the frame loop.

| File | Role |
| --- | --- |
| `README.md` | Adapter contract. Transport stays in client-runtime. |
| `runtime.ts` | Singleton WASM instance, ABI layouts from `ghostty_type_json`, PTY-write trampoline. |
| `core.ts` | Per-terminal Ghostty handles → render snapshots (cells, cursor, selection, links). |
| `renderer.ts` | Canvas 2D: batched backgrounds + style runs. |
| `surface.ts` | DOM: hidden IME textarea, mouse, clipboard, scroll, OSC-8 links, cursor blink. |
| `keyCodes.ts` | DOM `KeyboardEvent` → Ghostty key enum / consumed mods / unshifted codepoint. |
| `fonts/SymbolsNerdFontMono-Regular.woff2` | Symbols-only Nerd Font, lazy `FontFace`. |
| `vendor/ghostty-vt.wasm` | Terminal state machine. |
| `vendor/ghostty-write-pty.wasm` | 112-byte callback trampoline for terminal-generated PTY replies. |

Pin and license live once at repo-root `native/libghostty-vt/` (`VERSION` = `9f62873bf195e4d8a762d768a1405a5f2f7b1697`, plus `include/ghostty/vt.h` and `LICENSE`). Web does **not** keep a second pin; `apps/web/scripts/build-libghostty-wasm.sh` embeds the revision as semver build metadata and `runtimeAbi.test.ts` compares it to `native/libghostty-vt/VERSION`.

Architecture notes: `docs/architecture/terminal-renderers.md`. Android uses the same ABI as a native `.so`; iOS uses full libghostty (`GhosttyKit`), not vt-only. Renderer choice never crosses the wire.

**Nero:** copy this renderer if you want a real terminal in the browser. Do not reimplement VT in JS.

### 3.2 Terminal chrome and transport glue

| File | Role |
| --- | --- |
| `components/ThreadTerminalDrawer.tsx` | Drawer **and** panel (`mode: "drawer" \| "panel"`). Owns `TerminalViewport`: Ghostty surface ↔ `terminal.attach` buffer, write, resize. Link clicks, selection → composer context. |
| `terminalUiStateStore.ts` | Per-thread drawer geometry, terminal ids, split groups. |
| `state/terminal.ts` | Web wrapper around client-runtime atoms. |
| `state/terminalSessions.ts` | `useAttachedTerminalSession` = attach stream + metadata merge. |
| `terminal-links.ts` | OSC-8 / regex URL and path extraction. |
| `lib/terminalCloseConfirm.ts`, `lib/terminalCloseShortcut.ts`, `lib/terminalFocus.ts`, `lib/terminalContext.ts` | Close confirm, `mod+w`, focus detection, composer chips. |
| `components/settings/SettingsFontPreviews.tsx` | Live Ghostty preview of font settings (imports `GhosttyTerminalSurface`). |

Client-runtime (shared with mobile): `packages/client-runtime/src/state/terminal.ts`, `terminalSession.ts`.

Contracts: `packages/contracts/src/terminal.ts`.

Server PTY: `apps/server/src/terminal/Manager.ts` (registers PIDs with the port scanner).

Web **does not** call `terminal.clear` or `terminal.restart`. Clear is local: Ctrl+L / Cmd+K sends form-feed `\u000c` into the PTY. Mobile **does** call `terminal.clear`. Restart exists on the wire; web UI never issues it.

### 3.3 Right panel shell

| File | Role |
| --- | --- |
| `rightPanelStore.ts` | Ordered surfaces + active id. Kinds: `diff`, `files`, `file`, `preview`, `terminal`, `pull-request`, `agents`. |
| `rightPanelLayout.ts` | Sheet breakpoint `(max-width: 980px)` and sheet class names. |
| `components/RightPanelTabs.tsx` | Tab strip, empty-state launcher cards, mute menu for desktop preview audio. |
| `components/RightPanelSheet.tsx` | Narrow-viewport overlay wrapping the same tabs. |
| `components/preview/PreviewPanelShell.tsx` | Resizable width for **all** right-panel content (name is historical). |
| `components/preview/RightPanelResizeHandle.tsx` | Drag handle. |
| `components/ChatView.tsx` | Mounts drawer, inline panel, sheet, and switches `rightPanelContent` by surface kind. |
| `routes/_chat.pull-requests.tsx` | Reuses `RightPanelTabs` with browser/terminal **disabled**. |

`RightPanelTabs` hard-codes: *“Browser previews are only available in the T3 Code desktop app.”* Terminal: *“only available from a project thread.”*

### 3.4 URL preview / “browser” — `components/preview/` + `browser/`

**WS session layer (all clients):**

| File | Role |
| --- | --- |
| `previewStateStore.ts` | Per-thread session index, server epoch/revision, desktop overlay cache. `isPreviewSupportedInRuntime()` = `Boolean(window.desktopBridge?.preview)`. |
| `state/preview.ts` | Web wrapper around client-runtime preview atoms. |
| `components/preview/usePreviewSession.ts` | `preview.list` + `subscribePreviewEvents` folded into the store. |
| `components/preview/openPreviewSession.ts` | `preview.open` with default viewport. |
| `components/preview/closePreviewSession.ts` | `preview.close`. |
| `components/preview/PreviewPanel.tsx` | Desktop gate; else `PreviewView`. |
| `components/preview/PreviewView.tsx` | Chrome + empty state + `BrowserSurfaceSlot`. Navigation prefers `previewBridge` (IPC) and mirrors to the server. |
| `components/preview/PreviewChromeRow.tsx` | URL bar, back/forward/refresh, device toolbar entry. |
| `components/preview/PreviewEmptyState.tsx` | Discovered localhost cards + recents. |
| `components/preview/PreviewLocalServerCard.tsx`, `PreviewRecentUrlCard.tsx` | Those cards. |
| `components/preview/openDiscoveredPort.ts` | Resolve loopback URL → `preview.open` → `openBrowser`. |
| `components/preview/openTerminalLinkInPreview.ts` | Terminal URL click → preview or external. |
| `components/preview/previewActionBus.ts` | In-process bus for chrome actions (refresh, focus URL). |
| `previewMiniPlayerStore.ts`, `components/preview/ThreadPreviewMiniPlayer.tsx`, `previewMiniPlayerLayout.ts` | Floating player; still a `BrowserSurfaceSlot` (Electron pixels). |
| `browserHistoryStore.ts` | Recent URLs per thread. |
| `browserFaviconStore.ts`, `browserFaviconLogic.ts` | Favicon cache for tabs. |
| `lib/previewFocus.ts`, `lib/previewAnnotation.ts` | Keybinding when-clause; annotation payload. |

**Electron guest (delete for Nero web preview):**

| File | Role |
| --- | --- |
| `components/preview/previewBridge.ts` | `window.desktopBridge?.preview` or `null`. |
| `components/preview/usePreviewBridge.ts` | Registers webview, reports nav via `preview.reportStatus`. |
| `browser/ElectronBrowserHost.tsx` | Mounts one `HostedBrowserWebview` per live session. App-root, not inside the panel. |
| `browser/HostedBrowserWebview.tsx` | `<webview>` element, crash recovery, viewport chrome, zoom. |
| `browser/BrowserSurfaceSlot.tsx` | Empty `div` whose screen rect is leased to the Electron webview (absolute positioning). |
| `browser/browserSurfaceStore.ts` | Rect / visibility / activity leases. |
| `browser/desktopTabLifetime.ts` | Main-process tab create/destroy. |
| `browser/previewRuntimeTabId.ts` | Session tab id × server epoch × thread → unique desktop tab id (session ids are not globally unique). |
| `browser/previewWebviewConfigState.ts` | Partition / preload / webpreferences. |
| `browser/webviewCrashRecovery.ts` | Reload generation. |
| `browser/browserRecording.ts`, `browserRecordingScope.ts` | Agent recording frames via IPC. |
| `browser/browserPointerStore.ts` | Agent cursor events from main. |
| `components/preview/AgentBrowserCursor.tsx` | Overlay cursor when `controller === "agent"`. |
| `browser/BrowserDeviceToolbar.tsx`, `browserDeviceToolbarState.ts`, `browserViewport*.ts`, `useBrowserViewportResize.ts` | Device presets / freeform / fill. |
| `browser/openFileInPreview.ts` | HTML/PDF: `assets.createUrl` then `preview.open`. |
| `browser/browserTargetResolver.ts` | Loopback URL rewrite for remote environments. |
| `browser/browserDefaults.ts` | Settings-backed default viewport/zoom/color scheme. |
| `browser/annotationTheme.ts` | Theme tokens injected into the guest for pick-element. |

Desktop IPC (not WS): `apps/desktop/src/ipc/methods/preview.ts` — createTab, closeTab, registerWebview, navigate, refresh, zoom, mute, PiP, screenshot, recording, automation click/type/press/scroll/evaluate/waitFor. Contracts in `packages/contracts/src/ipc.ts` (`DesktopPreviewTabState`, etc.).

**Agent automation (keep the WS protocol, replace the host):**

| File | Role |
| --- | --- |
| `components/preview/PreviewAutomationHosts.tsx` | App-root. `previewAutomation.connect` stream; executes operations against the desktop webview. |
| `previewAutomationRequestConsumer.ts`, `previewAutomationTarget.ts`, `previewAutomationOpenReadiness.ts`, `previewNavigationReadiness.ts`, `previewViewportReadiness.ts`, `previewViewportRollback.ts` | Targeting, wait-for-ready, rollback. |
| `previewAutomationClientId.ts`, `previewAutomationErrors.ts` | Client identity; typed failures. |

Contracts: `packages/contracts/src/preview.ts`, `previewAutomation.ts`.

Mounted at app root (`AppRoot.tsx`): `PreviewAutomationHosts` always; `ElectronBrowserHost` is a no-op on web (`if (!isElectron) return null`).

### 3.5 Port discovery

| File | Role |
| --- | --- |
| `portDiscoveryState.ts` | Client subscription. Bounds configured URLs (max 32, loopback http(s) only). Filters by thread / terminal. |
| `components/preview/useDiscoveredLocalServers.ts` | Merge scanner hits with project-configured `previewUrl`s. |
| `apps/server/src/preview/PortScanner.ts` | `lsof` (mac/linux) or common-port probe (Windows). HTTP(S) probe must yield HTML or a redirect to HTML. Poll every 3s while retained. Terminal manager registers PIDs so a hit can carry `{ threadId, terminalId }`. |

Wire: `subscribeDiscoveredLocalServers` with optional `{ configuredUrls }`. Payload `DiscoveredLocalServer`: host, port, url, processName, pid, optional terminal pair.

This stream is **environment-wide**, not preview-panel-only. `LegacySidebar` also reads `useThreadDiscoveredPorts`.

### 3.6 Assets (signed URLs, not the URL preview)

| File | Role |
| --- | --- |
| `apps/web/src/assets/assetUrls.ts` | `useAssetUrl` / `useAssetUrls` → `assets.createUrl` then resolve against the environment HTTP origin. |
| `packages/client-runtime/src/state/assets.ts` | Query family, 5 min stale / 30 min refresh / 1 h idle TTL. |
| `packages/contracts/src/assets.ts` | Resources: `workspace-file` (threadId + path), `attachment`, `project-favicon`. |

HTTP GET of the signed `relativeUrl` is how images render in chat markdown and in `FilePreviewPanel`. HTML/PDF workspace files use the same RPC, then feed the URL into **desktop** `preview.open`. Preview type check on the server: “Only browser documents and images can be previewed.”

Do not confuse with brand assets (`scripts/lib/brand-assets.ts`) or `apps/desktop/src/app/DesktopAssets.ts`.

### 3.7 Workspace files (right-panel `"files"` / `"file"`)

| File | Role |
| --- | --- |
| `components/files/FileBrowserPanel.tsx` | Pierre file tree. `projects.listEntries`. |
| `components/files/FilePreviewPanel.tsx` | Tree + editor / markdown / image. `projects.readFile` / `writeFile`; images via `assets.createUrl`; HTML/PDF button calls `openFileInPreview`. |
| `components/files/filePreviewMode.ts` | Markdown vs source toggle. |
| `components/files/projectFilesQueryState.ts` | Query cache for file contents. |

`filesystem.browse` is a **different** RPC: path-picker / “open folder” autocomplete (`packages/client-runtime/src/state/filesystem.ts`), not the project file tree.

### 3.8 Other right-panel kinds (RPC only, not this brief’s UI)

- **diff** — checkpoint / turn diffs (`orchestration.getTurnDiff` / `getFullThreadDiff`, VCS status). `components/DiffPanel.tsx`.
- **pull-request** — `pullRequests.*` family. `components/pullRequest/*`.
- **agents** — derived from orchestration snapshot / subagent runtime. No dedicated preview RPC. `components/AgentsPanel.tsx` is a roster, **not** a display.

---

## 4. RPC each panel requires

Scopes from `apps/server/src/auth/RpcAuthorization.ts`. Terminal family is `terminal:operate`; preview list/events/discovery are `orchestration:read`; preview mutate/automation are `orchestration:operate`; file reads `orchestration:read`; file writes `orchestration:operate`.

### 4.1 Terminal tab **and** terminal drawer

Same RPCs. UI placement is client-only.

| Method | Stream? | Why |
| --- | --- | --- |
| `terminal.open` | no | Create PTY. Client picks `terminalId`. cwd + optional worktreePath, cols, rows, env. |
| `terminal.attach` | **yes** | Snapshot then `output` / `exited` / `closed` / `error` / `cleared` / `restarted` / `activity`. Viewport subscribes here. |
| `terminal.write` | no | Keystrokes / paste. Max 64 KiB per call. |
| `terminal.resize` | no | cols × rows (1–1000 × 1–500). Client-runtime concurrency `latest` per session. |
| `terminal.close` | no | Optional `deleteHistory`. Web close-tab uses this; write `exit\n` is the fallback. |
| `subscribeTerminalMetadata` | **yes** | Environment-wide summaries (label, pid, status) for tab titles and id allocation. |
| `subscribeTerminalEvents` | **yes** | Wired in client-runtime; web viewport uses attach, not this, for bytes. |

Optional / unused by web UI: `terminal.clear`, `terminal.restart`.

Related, not required to *render* a terminal:

- `shell.openInEditor` — path-link click from the canvas (desktop/local API).
- `preview.open` — URL-link click, desktop only.
- `subscribeDiscoveredLocalServers` — badge/empty-state, not the PTY.

### 4.2 URL preview / browser tab

**Collaborative session (server):**

| Method | Stream? | Why |
| --- | --- | --- |
| `preview.open` | no | Create tab; optional url + viewport. |
| `preview.navigate` | no | Set url (desktop host usually navigates via IPC then reports). |
| `preview.resize` | no | fill / freeform / preset viewport. |
| `preview.refresh` | no | Reload. |
| `preview.close` | no | Drop tab; omit `tabId` to close all for the thread. |
| `preview.list` | no | Authoritative sessions + `serverEpoch` + `revision`. |
| `preview.reportStatus` | no | Host → server: navStatus, canGoBack/Forward. Desktop webview reports this. |
| `subscribePreviewEvents` | **yes** | opened / navigated / resized / failed / closed. Fan-out to every client. |
| `subscribeDiscoveredLocalServers` | **yes** | Empty-state localhost cards. |

**Agent display (same tab):**

| Method | Stream? | Why |
| --- | --- | --- |
| `previewAutomation.connect` | **yes** | Host advertises operations; server pushes requests. |
| `previewAutomation.respond` | no | Result / error for a requestId. |
| `previewAutomation.focusHost` | no | Pick which connected host should own the next request. |

Operations in `PREVIEW_AUTOMATION_OPERATIONS`: `status`, `open`, `navigate`, `snapshot`, `click`, `type`, `press`, `scroll`, `evaluate`, `waitFor`, `recordingStart`, `recordingStop`, `resize`, `setColorScheme`.

**Desktop-only IPC (not WS).** Nero in-browser preview must replace these with an iframe/CDP/page-proxy host: createTab, registerWebview, navigate, zoom, mute, screenshot, recording frames, pointer events.

**To actually paint a page on web today: there is no RPC.** The pixels never go over the websocket. Without Electron, `preview.*` only moves metadata.

### 4.3 Workspace file tab

| Method | Why |
| --- | --- |
| `projects.listEntries` | Tree. |
| `projects.readFile` | Buffer for editor / markdown. |
| `projects.writeFile` | Save. |
| `assets.createUrl` | Images (always); HTML/PDF only if a URL preview host exists. |
| `projects.searchEntries` / `projects.searchContents` | Command palette / project search, not the panel itself. |
| `shell.openInEditor` | “Open in …” picker. |

### 4.4 Diff / PR / agents tabs

Out of scope for this note except: they share `RightPanelTabs` and **do not** need terminal or preview RPCs. Diff uses orchestration turn-diff + VCS. PR uses `pullRequests.*`. Agents read the thread snapshot.

### 4.5 Assets used outside the right panel

Chat markdown images, composer attachments, project favicons: `assets.createUrl`. Uploads: `attachments.createUploadUrl` / `attachments.delete`. Not required to mount a terminal tab.

---

## 5. File-level copy / adapt / delete (for Nero)

Legend: **copy** = take the idea and most of the code; **adapt** = keep the shape, change the host or chrome; **delete** = do not bring across.

### Copy

- `native/libghostty-vt/` + `apps/web/src/terminal/ghostty/**` + `apps/web/scripts/build-libghostty-wasm.sh` + `docs/architecture/terminal-renderers.md`. Keep the ABI pin story (one `VERSION`, wasm embeds it, test checks drift).
- `packages/contracts/src/terminal.ts` and the `terminal.*` / `subscribeTerminal*` RPC group. Client-allocated `term-N` ids. Attach-as-stream.
- `packages/client-runtime/src/state/terminal.ts` + `terminalSession.ts`. Serial lifecycle per thread, `latest` resize per session.
- `apps/web/src/components/ThreadTerminalDrawer.tsx` `TerminalViewport` (the attach → Ghostty write loop). Split-group data model in `terminalUiStateStore.ts`.
- `apps/web/src/terminal-links.ts`.
- `packages/contracts/src/preview.ts` session snapshot + events + `DiscoveredLocalServer`. Useful even if the guest is an iframe.
- `packages/contracts/src/previewAutomation.ts` if agents drive the same preview.
- `apps/server/src/preview/PortScanner.ts` + `portDiscoveryState.ts` + `useDiscoveredLocalServers.ts`.
- `packages/contracts/src/assets.ts` + `apps/web/src/assets/assetUrls.ts` for workspace images inside a file tab.
- `rightPanelStore.ts` surface descriptors (`browser:${tabId}`, `terminal:${id}`, `file:${path}`). Tab-not-singleton is the right model for Nero’s “terminal tab + preview tab”.

### Adapt

- `RightPanelTabs.tsx` / `ChatView.tsx` content switch: drop the Electron availability gate; treat preview as a first-class web surface. Keep the empty-state launcher.
- `PreviewView.tsx` + chrome + empty state: keep URL bar, recents, discovered ports. Replace `BrowserSurfaceSlot` with an **in-document** guest (`iframe`, or a proxied guest that you own).
- `previewAutomation*` request consumer: keep the WS protocol; implement operations against the in-browser guest instead of `previewBridge`.
- `browserTargetResolver.ts`: Nero workspaces are remote containers; loopback rewrite / HTTP proxy is mandatory or localhost cards are useless.
- `PreviewPanelShell.tsx` resize behavior: fine as a generic right-column shell (rename if the name confuses).
- `FilePreviewPanel.tsx`: keep as the **file** tab. HTML/PDF “open in preview” should hit Nero’s in-browser preview, not Electron.
- `ThreadTerminalDrawer` **drawer mode**: Nero said terminal is a **tab**. Prefer panel mode only; keep split-inside-tab. Drawer is optional extra, not the product.
- Keybindings in `packages/shared/src/keybindings.ts`: `terminal.toggle` is drawer-shaped (`mod+j`). Nero likely wants “focus terminal tab” / “open terminal tab” instead of a second chrome region.

### Delete (do not copy into Nero)

- `browser/ElectronBrowserHost.tsx`, `HostedBrowserWebview.tsx`, `desktopTabLifetime.ts`, `hostedBrowserWebviewStyle.ts`, `webviewCrashRecovery.ts`, `previewWebviewConfigState.ts`.
- `browser/BrowserSurfaceSlot.tsx` + the absolute-position lease model. That exists because the webview is a native sibling of the DOM, not a child of the panel.
- `components/preview/previewBridge.ts`, `usePreviewBridge.ts`.
- `apps/desktop/src/ipc/methods/preview.ts` and the `DesktopPreview*` IPC schemas **as the guest implementation**. Keep them only as a reference for which host capabilities automation expects (screenshot, click, evaluate).
- `isPreviewSupportedInRuntime()` desktop gate in `PreviewPanel.tsx` / `openFileInPreview.ts` / `_chat.tsx`.
- `ThreadPreviewMiniPlayer.tsx`, desktop PiP, `preview.openPictureInPicture`. **Not Seat.** Seat is a separate virtual display; copying a floating Electron window will train the wrong instinct.
- `browser/browserRecording.ts` IPC frame pump — reimplement against the in-browser guest if agents need recording.
- `AgentBrowserCursor.tsx` as-is if the agent paints into the same iframe (maybe keep as an overlay).
- Any plan to “just iframe localhost” from a hosted origin without a proxy. T3 desktop cheats because Chromium webview is a real browser with its own network on the host machine. Nero’s web client is not on that machine.

---

## 6. Nero mapping

| Nero | T3 today | Take |
| --- | --- | --- |
| Terminal **tab** | Right-panel `kind: "terminal"` **plus** a bottom drawer | Ship the tab. Same PTY RPCs. Ghostty WASM is the renderer. Do not require Electron. |
| In-browser **preview** | Desktop `<webview>` + WS metadata | Keep `preview.*` metadata and port discovery. Replace the guest. Web T3 has **no** in-browser preview to copy. |
| Agent display **can be** preview | `previewAutomation.*` driving the same webview | Copy the operation set. The host is Nero’s preview, not a second surface. |
| Seat (virtual display) | **No analog.** Mini-player / PiP is a second *window* on the same tab | Do not fold Seat into this panel. Do not reuse `BrowserSurfaceSlot`. |

**Agents panel vs agent display.** T3 `AgentsPanel` is a subagent roster (status dots, tokens). It is not a framebuffer. Nero’s “agent display can be preview” maps to **preview automation**, not to `kind: "agents"`.

**Multi-client.** T3 preview sessions are server-authoritative so a second window can list tabs. The **pixels** still live in one Electron process. Nero’s in-browser preview will have to decide: one live guest per workspace (proxy/CDP) vs per-client iframes that only share URL/viewport. T3 chose “metadata shared, pixels local to desktop.” That choice is forced by `<webview>` and is **wrong** to copy if Nero’s guest is already in the browser.

---

## 7. Keybindings (today)

From `packages/shared/src/keybindings.ts`:

| Key | Command | When |
| --- | --- | --- |
| `mod+j` | `terminal.toggle` | drawer |
| `mod+d` / `mod+shift+d` | `terminal.split` / `splitVertical` | `terminalFocus` |
| `mod+n` | `terminal.new` | `terminalFocus` |
| `mod+w` | `terminal.close` | `terminalFocus` |
| `mod+alt+b` | `rightPanel.toggle` | |
| `mod+shift+j` | `preview.toggle` | no-ops on web |
| `mod+r` / `mod+l` / zoom | `preview.refresh` / `focusUrl` / zoom | `previewFocus` |

---

## 8. Server-side companions (not under `apps/web/src`)

Bring these with the RPCs, not with the React:

- `apps/server/src/terminal/Manager.ts` — PTY lifecycle, history, labels, PID registration.
- `apps/server/src/preview/` — session store + `PortScanner.ts`. Desktop manager is in `apps/desktop/src/preview/Manager.ts`.
- `packages/contracts/src/rpc.ts` — method names listed in §4.
- `packages/shared/src/preview.ts`, `previewViewport.ts`, `terminalLabels.ts`.

---

## 9. What not to confuse

1. **`review.getDiffPreview`** — compact/mobile live diff. Not the browser.
2. **`FilePreviewPanel`** — workspace file. Not the URL guest.
3. **`filesystem.browse`** — generic path picker. Not the project tree.
4. **Brand `assets/`** — icons. Not `assets.createUrl`.
5. **Seat** — not the mini-player, not the right panel, not PiP.
6. **Web vs desktop preview.** Contracts comment says “The preview is desktop-only (Chromium `<webview>)`.” That is still true in the web UI. Port discovery and `preview.*` metadata exist on web; the guest does not.

---

## 10. Suggested Nero slice (smallest unsurprising model)

1. **Terminal tab** = Ghostty WASM + `terminal.open/attach/write/resize/close` + metadata subscription. One surface per split group. No drawer required.
2. **Preview tab** = URL chrome + **in-browser guest** + `preview.open/navigate/list/events` + `subscribeDiscoveredLocalServers`. Implement a workspace HTTP proxy so loopback URLs work from the hosted client.
3. **Agent uses (2)** via `previewAutomation.connect/respond`. Same tab id space.
4. **File tab** stays `projects.*` + `assets.createUrl` for images; “open HTML in preview” goes to (2).
5. **Seat** is a later, separate display pipeline. Do not hang it off `BrowserSurfaceSlot`.
