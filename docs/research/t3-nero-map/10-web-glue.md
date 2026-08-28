# 10. Remaining T3 web glue → Nero

File-level copy / adapt / delete for leftover `apps/web/src` glue that is not already owned by a feature-folder map (chat, clerk, cloud, desktop, diffs, files, preview, pullRequest, search, settings, sidebar, usage, auth, browser, connection, environments, routes, terminal).

Primary source: `/tmp/t3code-upstream/apps/web/src`. No Nero product code was consulted.

---

## Constraints (locked)

- **Copy + adapt T3 web skin.** Chrome, tokens, dialogs, markdown, themes, keybindings matching, composer/chat layout, sidebar geometry.
- **No T3 remnants.** No `T3 Code` / `T3 Chat` copy, no `t3code:` storage keys, no `t3.json`, no `npx t3`, no `pingdotgg/t3code`, no pairing, no T3 Connect, no Clerk, no `t3-web` OTLP resource.
- **No T3 server.** Do not import `@t3tools/client-runtime` RPC atoms that speak T3’s event-sourced WebSocket (`WS_METHODS.*`, `connectionAtomRuntime`, `PrimaryConnectionTarget`). Nero’s workspace is a Docker container + ZFS dataset. The T3 “environment = one `npx t3` process” model does not exist.

T3 “environment” in this layer is a **connected T3 server**. Nero’s analog is a **workspace**. T3 “primary local environment” (loopback / desktop-hosted / WSL backend) has **no analog** — delete that fork, do not rename it.

Sibling `*.test.ts` / `*.test.tsx` files follow the source file’s verdict.

---

## Verdicts

| Verdict | Meaning |
| --- | --- |
| **COPY** | Keep the file. Rebrand storage keys, CSS var names, and `@t3tools/*` imports. Behavior stays. |
| **ADAPT** | Keep the UX. Rewrite the data/RPC/domain wiring onto Nero APIs and Nero’s workspace model. |
| **DELETE** | T3-only product. No Nero analog, or it only exists to talk to a T3 server / Electron host / WSL / relay. |

Mixed files get one verdict plus a remnant note. Do not copy a file as-is if it still names T3.

---

## Remnants to strip everywhere you COPY or ADAPT

- Storage / events: `t3code:*`, `t3.backgroundActivity.clientId`, `t3code:local_storage_change`
- Brand: `T3 Code`, `T3 Chat`, `t3-chat`, `t3-grove` / `t3-ocean` / `t3-ember` / `t3-iris` aliases, `T3_CHAT_THEME`
- Server: `npx t3@${version}`, `serviceName: "t3-web"`, `/api/observability/v1/traces` on the T3 primary, `WS_METHODS.*`
- Project file: `t3.json`, `T3_PROJECT_FILE_NAME`, `T3ProjectFileScript`, `useT3ProjectFileScripts`
- Desktop host: `window.desktopBridge`, `github.com/pingdotgg/t3code/releases`, Electron quit-hold, WCO/titlebar Electron classes (unless Nero later ships a desktop shell)
- Packages: `@t3tools/contracts`, `@t3tools/client-runtime`, `@t3tools/shared` → Nero packages or inlined copies. Never leave the T3 npm name in the skin.

---

## 1. Named modules (src root)

### 1.1 Appearance, theme, Open VSX

| File | Verdict | Why |
| --- | --- | --- |
| `apps/web/src/appearanceContrast.ts` | **COPY** | Sets `--appearance-contrast-*` CSS vars. Portable. Rebind the settings type off T3 contracts. |
| `apps/web/src/appearanceContrast.test.ts` | **COPY** | Travels with the module. |
| `apps/web/src/appearanceFonts.ts` | **COPY** | Font stacks, clamps, canvas probes, CSS vars. Rename `TYPOGRAPHY_ADVANCED_STORAGE_KEY` (`t3code:typography-advanced`). Font size constants come from T3 contracts — copy the numbers. |
| `apps/web/src/appearanceFonts.test.ts` | **COPY** | |
| `apps/web/src/themePalette.ts` | **ADAPT** | The engine (OKLCH, vivid/managed derivation, custom theme library, halves, preview) is the skin. **Delete** `T3_CHAT_THEME` as a product theme, `T3_CHAT_THEME_LABEL = "T3 Chat"`, `t3-chat` / `t3-chat-dark` / `t3-grove` aliases, and comments that treat T3 Code’s default tokens as the flagship. Seed Nero’s default from the same captured light/dark token tables (`T3_CODE_*_THEME_COLORS`) after renaming. Storage keys `t3code:themes:v1` etc. become Nero keys. Grove / Ocean / Ember / Iris stay (unprefixed). |
| `apps/web/src/themePalette.test.ts` | **ADAPT** | Drop T3 Chat fidelity tests; keep derivation / contrast tests. |
| `apps/web/src/themeBoot.test.ts` | **ADAPT** | Asserts the inline boot script in `apps/web/index.html`. Copy that script with Nero keys and Nero default palette. No `themeBoot.ts` source file exists. |
| `apps/web/src/vscodeThemeImport.ts` | **COPY** | VS Code `*-color-theme.json` → app palette. No T3 server. |
| `apps/web/src/vscodeThemeImport.test.ts` | **COPY** | |
| `apps/web/src/openVsxThemes.ts` | **COPY** | Open VSX search + VSIX unzip + license allowlist. Talks to `https://open-vsx.org`, not T3. |
| `apps/web/src/openVsxThemes.test.ts` | **COPY** | |

### 1.2 Markdown

| File | Verdict | Why |
| --- | --- | --- |
| `apps/web/src/markdown-clipboard.ts` | **COPY** | DOM selection → markdown + sanitized HTML. Skin. |
| `apps/web/src/markdown-clipboard.test.ts` | **COPY** | |
| `apps/web/src/markdown-github-alerts.ts` | **COPY** | GitHub `[!NOTE]` remark plugin. |
| `apps/web/src/markdown-github-alerts.test.tsx` | **COPY** | |
| `apps/web/src/markdown-links.ts` | **COPY** | Path vs URL classification for chat links. Keep `/workspace/` roots (Nero-relevant). Tests mention `t3code` only as fixture paths. |
| `apps/web/src/markdown-links.test.ts` | **COPY** | |
| `apps/web/src/markdown-list-indentation.ts` | **COPY** | Remark list indent fix. Rename internal `t3-markdown-inline-prefix:` sentinel. |
| `apps/web/src/markdown-list-indentation.test.tsx` | **COPY** | |

### 1.3 Keybindings, titlebar, version, local API, paths, dialogs

| File | Verdict | Why |
| --- | --- | --- |
| `apps/web/src/keybindings.ts` | **ADAPT** | Matcher / labeler / jump-hint helpers are portable. Command ids (`sidebar.toggle`, `terminal.close`, thread-jump, model-picker-jump) come from T3 `ResolvedKeybindingsConfig`. Keep the matcher; rebind the command enum to Nero’s keymap. |
| `apps/web/src/keybindings.test.ts` | **ADAPT** | |
| `apps/web/src/workspaceTitlebar.ts` | **COPY** | One CSS class for collapsed-sidebar titlebar inset. Harmless on web. |
| `apps/web/src/versionSkew.ts` | **DELETE** | Entire module is “T3 client vs T3 server semver, update the server.” Hint copy names T3 Code. `manualServerUpdateCommand` is `npx t3@${version}`. Nero has no T3 server and no `npx t3`. If Nero later versions a workspace daemon vs web, write a new module — do not retarget this one. |
| `apps/web/src/versionSkew.test.ts` | **DELETE** | |
| `apps/web/src/localApi.ts` | **ADAPT** | Browser fallbacks for confirm / context menu / settings persistence / `window.open` **are** the web skin. Strip `window.desktopBridge` (T3 Electron host). Nero web should always take the DOM path. |
| `apps/web/src/localApi.test.ts` | **ADAPT** | |
| `apps/web/src/wslPaths.ts` | **DELETE** | Parses `\\wsl.localhost\` / `\\wsl$\` and T3 `wsl:` backends so the **desktop host** can open a WSL folder as a T3 environment. Nero workspaces are Debian Docker on a bare-metal box. No WSL environment catalog. |
| `apps/web/src/wslPaths.test.ts` | **DELETE** | |
| `apps/web/src/remoteOpen.ts` | **ADAPT** | The UX (“this client is not on the workspace machine, so Open must fire `vscode://vscode-remote/ssh-remote+…` instead of exec”) **is** Nero. Rewrite host resolution: drop T3 `ConnectionTarget` / `PrimaryConnectionTarget` / desktop-SSH profile / `remoteOpenTargets` from the T3 server config. Nero should advertise SSH/Gateway hosts from the workspace daemon. Rename `t3code:remote-open-hint-seen`. If Nero does not expose SSH into workspaces, **DELETE**. |
| `apps/web/src/remoteOpen.test.ts` | **ADAPT** | |
| `apps/web/src/confirmDialog.ts` | **COPY** | Imperative confirm queue + host registration. Rebind option types off T3 contracts. |
| `apps/web/src/confirmDialog.test.ts` | **COPY** | |
| `apps/web/src/contextMenuFallback.ts` | **COPY** | DOM context menu for non-Electron. Themed (`dropdown-glass`, contrast tokens). Keep. |

---

## 2. `components/` root (not subdirs)

Subdirs `auth/`, `chat/`, `clerk/`, `cloud/`, `desktop/`, `diffs/`, `files/`, `preview/`, `pullRequest/`, `search/`, `settings/`, `sidebar/`, `usage/` are **out of this map**.

### 2.1 COPY — layout chrome and dumb widgets

| File | Notes |
| --- | --- |
| `components/AnimatedHeight.tsx` | Height clip + CSS transition. No T3. |
| `components/color-selector.tsx` | Token color dots. |
| `components/ConfirmDialogHost.tsx` | Renders `confirmDialog.ts` through `ui/alert-dialog`. |
| `components/ConnectionStatusDot.tsx` | Dot + ping. Rebind `EnvironmentConnectionPhase` to Nero connection phases. |
| `components/Icons.tsx` | GitHub / Git / GitLab / JJ brand SVGs. Keep. |
| `components/JetBrainsIcons.tsx` | JetBrains product SVGs for Open-in-IDE. Keep if Nero offers those editors; otherwise trim unused icons. |
| `components/RenderErrorBoundary.tsx` | Class boundary. |
| `components/RightPanelSheet.tsx` | Sheet wrapper. |
| `components/StartTruncatedPath.tsx` | RTL ellipsis + tooltip. |
| `components/WorkspaceBreadcrumb.tsx` | Nav chrome. Electron drag-region comment is fine to keep or drop. |
| `components/WorkspacePageContainer.tsx` | Max-width page frame. |
| `components/WorkspacePageHeader.tsx` | Top bar geometry + `workspaceTitlebar` inset. `electron` / `wco:` classes: leave as optional props, default off. |
| `components/NoActiveThreadState.tsx` | Empty state. Drop Electron-only header branch or keep gated. |
| `components/composerFooterLayout.ts` | Width breakpoints for compact composer footer. |
| `components/composerInlineChip.ts` | Chip class names + skill SVG. Skin. |
| `components/threadSidebarWidth.ts` | Width math + `chat_thread_sidebar_width` key (rename). |
| `components/CommandPaletteContent.tsx` | Shared palette chrome (input, footer, kbd hints). |
| `components/CommandPaletteResults.tsx` | Highlighted rows + shortcut labels. Rebind keybinding type. |
| `components/DiffPanelShell.tsx` | Panel chrome. Drop Electron drag-region / `wco:` unless Nero desktop exists. |
| `components/DiffWorkerPoolProvider.tsx` | Pierre diffs worker + theme sync. Skin. |
| `components/SidebarStageBackdrop.tsx` | Nightly/dev SVG backdrop. **Rebrand** `APP_STAGE_LABEL` / T3 server stage. Keep the art if Nero has a non-prod stage; otherwise delete the T3 night-sky scene and the file. Default: **ADAPT** (keep mechanism, replace art + labels). |

### 2.2 ADAPT — skin that currently speaks T3 RPC

These files **are** the T3 web skin. Copy the layout, then rewire queries/commands to Nero.

| File | What to keep | What to rewrite / drop |
| --- | --- | --- |
| `components/AppSidebarLayout.tsx` | Sidebar provider, rail, width persistence, mac traffic-light inset, settings vs thread chrome. | `primaryServerKeybindingsAtom`, Electron detection as the default path, T3 environment-identification artwork mode. |
| `components/SplashScreen.tsx` | Centered boot splash. | `/apple-touch-icon.png` + `aria-label="T3 Code splash screen"` / `alt="T3 Code"`. Nero mark. |
| `components/AgentsPanel.tsx` | Fleet rows, fixed-height status, elapsed timers. | `@t3tools/client-runtime/state/subagentRuntime` + `orchestrationEnvironment`. Nero agent roster. |
| `components/ChatView.tsx` | Main workspace: composer, timeline, terminals, preview, diffs, keybindings. | Whole T3 contract surface (providers, orchestration, worktrees, scripts). `LAST_INVOKED_SCRIPT_BY_PROJECT_KEY = "t3code:last-invoked-script-by-project"` in the logic file. |
| `components/ChatView.logic.ts` | Pure layout / draft-hero / reconnect-grace helpers. | Storage key rename; T3 types. |
| `components/ChatMarkdown.tsx` | react-markdown + GFM + alerts + file chips + copy. | Asset/image RPC, “open in preferred editor”, T3 preview history. |
| `components/ComposerPromptEditor.tsx` | Lexical composer, mention chips, paste. | T3 skill type; keep editor. |
| `components/composerInlineTokenPaste.ts` | Paste → mention nodes. | Shared token grammar package rename. |
| `components/CommandPalette.tsx` | ⌘K / ⌘P / ⇧⌘F overlay, add-project, clone, new-thread-in. | Filesystem browse, WSL, `PRIMARY_LOCAL_ENVIRONMENT_ID`, desktop-local bootstraps, T3 project create. Nero: pick a workspace + repo, not a local folder on the user’s laptop. |
| `components/CommandPalette.logic.ts` | Overlay reducer, recents, search ranking. | Keep reducer; rebind thread/project types. |
| `components/Sidebar.tsx` | Thread/project list, pin/snooze/archive, dnd. | T3 shell atoms, settlement, Electron. |
| `components/Sidebar.logic.ts` | Sort, prewarm limit (keep at 3), archive batching, jump hints. | `resolveServerBackedAppStageLabel` branding. |
| `components/Sidebar.snooze.ts` | Snooze preset labels. | Keep UX; rebind shared snooze helper. |
| `components/LegacySidebar.tsx` | Alternate sidebar. | Same as Sidebar; only ship if Nero wants the legacy grouping. Prefer one sidebar. |
| `components/BranchToolbar.tsx` | Branch + workspace + env-mode strip. | T3 `local` vs `worktree` + multi-machine environment picker. Nero: branch + **workspace** identity. Drop “This device”. |
| `components/BranchToolbar.logic.ts` | Label helpers, previous-worktree seed. | `GENERIC_LOCAL_ENVIRONMENT_LABELS`, `isPrimary` → Nero workspace. Worktrees inside a Nero workspace can stay. |
| `components/BranchToolbarBranchSelector.tsx` | Paginated branch menu. | VCS RPC. |
| `components/BranchToolbarEnvironmentSelector.tsx` | Environment `<Select>`. | Rename to workspace selector; drop primary/local icons meaning “this laptop”. |
| `components/BranchToolbarEnvModeSelector.tsx` | local / worktree / previous worktree. | Keep only if Nero has in-workspace worktrees. |
| `components/DiffPanel.tsx` | Checkpoint diff UI. | Checkpoint RPC + T3 thread refs. |
| `components/RightPanelTabs.tsx` | Preview/diff/terminal/agents/PR tab strip. | `desktopBridge` context menu, T3 preview sessions. |
| `components/GitActionsControl.tsx` | Commit / push / PR / publish. | T3 git/source-control RPCs. |
| `components/GitActionsControl.logic.ts` | Menu enablement, default-branch confirm copy. | Keep; terminology helper is generic. |
| `components/ProjectFavicon.tsx` | Folder fallback + asset URL. | Asset fetch via Nero, not T3 environment id. |
| `components/projectScriptEditor.tsx` | Script dialog. | Drop `t3.json` import error copy. |
| `components/ProjectScriptsControl.tsx` | Script split button. | Drop `T3ProjectFileScript` / checked-in `t3.json` import. Keep user-defined scripts if Nero wants them. |
| `components/PullRequestThreadDialog.tsx` | “Start thread from PR” dialog. | VCS resolve RPC. |
| `components/threadActionMenu.logic.ts` | Single menu id list for sidebar + header. | Keep ids; capabilities come from Nero. |
| `components/ThreadCommandSubtitle.tsx` | Palette subtitle (favicon · folder · branch · harness). | Provider/harness icon is T3-provider-shaped; swap for Nero agent label. |
| `components/ThreadStatusIndicators.tsx` | PR / terminal / worktree pills. | Linked PR + VCS status RPC. |
| `components/ThreadTerminalDrawer.tsx` | Ghostty drawer, splits, close confirm. | Terminal attach RPC. Ghostty surface is separate (terminal map). |
| `components/SlowRpcRequestToastCoordinator.tsx` | Slow-request toast UI. | Keep UI; feed from Nero RPC tracker, not T3 `WS_METHODS`. |
| `components/KeybindingsUpdateToast.logic.ts` | Cooldown + invalid-config toast from a config stream. | T3 `ServerConfigStreamEvent` `keybindingsUpdated` is a **server file watch**. Nero web keybindings are client-side — **DELETE** unless Nero also watches a remote keymap file. |

### 2.3 DELETE — T3 product, not skin

| File | Why |
| --- | --- |
| `components/ServerUpdateAction.tsx` | T3 server self-update (`npx t3`, boot-service / respawn / desktop-managed). No T3 server. |
| `components/ServerUpdateAction.test.tsx` | |
| `components/desktopUpdate.logic.ts` | Electron updater + `https://github.com/pingdotgg/t3code/releases/tag`. |
| `components/desktopUpdate.logic.test.ts` | |
| `components/desktopUpdate.toast.tsx` | |
| `components/desktopUpdate.toast.test.tsx` | |
| `components/QuitHoldOverlay.tsx` | Electron `desktopBridge.onQuitShortcut` / “Hold ⌘Q to Quit”. T3 desktop host. |
| `components/ProviderUpdateLaunchNotification.tsx` | Local CLI provider upgrades on the T3 server (and WSL secondary). Nero agents are not `npx`-updated on the user’s laptop. |
| `components/ProviderUpdateLaunchNotification.logic.ts` | |
| `components/ProviderUpdateLaunchNotification.logic.test.ts` | |
| `components/ProviderUpdateLaunchNotification.environments.ts` | Primary + WSL local backends. |
| `components/ProviderUpdateEnvironmentRows.tsx` | |
| `components/ProviderUpdateEnvironmentRows.test.tsx` | |
| `components/ProviderUpdatePrimaryNotification.tsx` | |

`ProjectScriptsControl.test.tsx` follows `ProjectScriptsControl.tsx` (**ADAPT**). Same for other `*.test.*` next to ADAPT sources.

---

## 3. `components/ui/`

Base UI / CVA primitives. This is the skin kit. **COPY** all of it, then rebind types and strip T3 names from comments.

| File | Verdict | Notes |
| --- | --- | --- |
| `alert-dialog.tsx` | **COPY** | |
| `alert.tsx` | **COPY** | |
| `autocomplete.tsx` | **COPY** | |
| `badge.tsx` | **COPY** | |
| `button.tsx` | **COPY** | |
| `button.test.tsx` | **COPY** | |
| `card.tsx` | **COPY** | |
| `checkbox.tsx` | **COPY** | |
| `collapsible.tsx` | **COPY** | |
| `combobox.tsx` | **COPY** | |
| `command.tsx` | **COPY** | Palette primitive. |
| `command.test.tsx` | **COPY** | |
| `dialog.tsx` | **COPY** | |
| `dialog-styles.ts` | **COPY** | `dialog-glass` tokens. |
| `draft-input.tsx` | **COPY** | Commit-on-blur input. |
| `empty.tsx` | **COPY** | |
| `field.tsx` | **COPY** | |
| `fieldset.tsx` | **COPY** | |
| `form.tsx` | **COPY** | |
| `group.tsx` | **COPY** | |
| `input-group.tsx` | **COPY** | |
| `input.tsx` | **COPY** | |
| `kbd.tsx` | **COPY** | |
| `label.tsx` | **COPY** | |
| `menu.tsx` | **COPY** | |
| `menu.test.tsx` | **COPY** | |
| `number-field.tsx` | **COPY** | |
| `panel-tab-close-button.tsx` | **COPY** | |
| `popover.tsx` | **COPY** | |
| `qr-code.tsx` | **COPY** | Primitive. T3 pairing is the current consumer — Nero may still want QR for SSH/device link. If not, unused is fine; do not delete the primitive to “remove pairing.” |
| `qr-code.test.tsx` | **COPY** | |
| `radio-group.tsx` | **COPY** | |
| `scroll-area.tsx` | **COPY** | |
| `select.tsx` | **COPY** | |
| `separator.tsx` | **COPY** | |
| `sheet.tsx` | **COPY** | |
| `sidebar.tsx` | **COPY** | shadcn-style sidebar machine. Cookie `sidebar_state` is generic. |
| `sidebar.test.tsx` | **COPY** | |
| `sidebarState.ts` | **COPY** | `expanded` / `collapsed`. |
| `skeleton.tsx` | **COPY** | |
| `spinner.tsx` | **COPY** | |
| `switch.tsx` | **COPY** | |
| `table.tsx` | **COPY** | |
| `textarea.tsx` | **COPY** | |
| `toast.tsx` | **ADAPT** | Visual kit **COPY**, but it imports T3 thread refs + composer draft store for thread-scoped toasts. Split: keep the primitive, rebind scoping. |
| `toast.logic.ts` | **ADAPT** | Same: layout math COPY, `ScopedThreadRef` ADAPT. |
| `toast.logic.test.ts` | **ADAPT** | |
| `toastHelpers.ts` | **ADAPT** | |
| `toastHelpers.test.ts` | **ADAPT** | |
| `toggle.tsx` | **COPY** | |
| `toggle-group.tsx` | **COPY** | |
| `tooltip.tsx` | **COPY** | |

---

## 4. `hooks/`

| File | Verdict | Why |
| --- | --- | --- |
| `hooks/useCommitOnBlur.ts` | **COPY** | Local draft until blur/Enter. |
| `hooks/useCopyToClipboard.ts` | **COPY** | Clipboard helpers + Effect errors. |
| `hooks/useCopyToClipboard.test.ts` | **COPY** | |
| `hooks/useCustomThemes.ts` | **COPY** | Subscribes to `themePalette` custom list. |
| `hooks/useLocalStorage.ts` | **COPY** | Rename event `t3code:local_storage_change`. |
| `hooks/useLocalStorage.test.ts` | **COPY** | |
| `hooks/useMediaQuery.ts` | **COPY** | Breakpoints + pointer. |
| `hooks/useNowMinute.ts` | **COPY** | Shared minute clock for snooze/settle. |
| `hooks/useResizableWidth.ts` | **COPY** | Pointer resize + localStorage. |
| `hooks/useTerminalFocus.ts` | **COPY** | Focusin/out → `lib/terminalFocus`. |
| `hooks/useTerminalFocus.test.ts` | **COPY** | |
| `hooks/useLiveRefresh.ts` | **COPY** | Visibility + idle + min-interval policy. Generic. Callers decide what to refetch. |
| `hooks/useLiveRefresh.test.ts` | **COPY** | |
| `hooks/useTheme.ts` | **ADAPT** | Persistence + desktop theme sync + chrome theme-color. Rename `t3code:theme`. Drop `DesktopBridge` sync unless Nero desktop exists. Default theme must not be T3 Chat. |
| `hooks/useTheme.test.ts` | **ADAPT** | |
| `hooks/useSettings.ts` | **ADAPT** | Merges **client** localStorage settings with **T3 server** settings (`primaryServerSettingsAtom`). Keep client persistence; replace server half with Nero user/workspace settings. |
| `hooks/useSettings.test.ts` | **ADAPT** | |
| `hooks/useHandleNewThread.ts` | **ADAPT** | Draft create + routing. Drop `readT3ProjectFileDefaultThreadEnvMode`. Map env-mode defaults onto Nero workspace policy. |
| `hooks/useActiveProjectTarget.ts` | **ADAPT** | Active thread → workspace cwd. `environmentId` becomes Nero workspace id. |
| `hooks/useThreadActions.ts` | **ADAPT** | Archive / settle / snooze / pin / delete. T3 capability bits and `threadEnvironment` RPC. |
| `hooks/useThreadActions.test.ts` | **ADAPT** | |
| `hooks/useThreadActionMenu.ts` | **ADAPT** | Wires menu ids to actions + clipboard + toasts. |
| `hooks/useTurnDiffSummaries.ts` | **ADAPT** | Reads T3 thread + `session-logic` checkpoints. |
| `hooks/useT3ProjectFileScripts.ts` | **DELETE** | Decodes checked-in `t3.json`. Nero must not ship a T3 project file. If Nero later wants `nero.json` scripts, write a new hook. |

---

## 5. `lib/`

### 5.1 COPY — pure client utilities

| File | Notes |
| --- | --- |
| `lib/utils.ts` | `cn`, platform, UUID. `newProjectId` / `newThreadId` brands are T3 schema — rebind constructors, keep helpers. |
| `lib/utils.test.ts` | |
| `lib/storage.ts` | Memory + debounced `StateStorage`. |
| `lib/lruCache.ts` | Bounded cache for markdown/highlight. |
| `lib/imageCompression.ts` | Stash + attachment downscale. Provider byte cap becomes Nero’s cap. |
| `lib/imageCompression.test.ts` | |
| `lib/favicon.ts` | Google s2 favicons for preview tabs. |
| `lib/favicon.test.ts` | |
| `lib/diffCollapse.ts` | Collapse-all set math. |
| `lib/diffCollapse.test.ts` | |
| `lib/diffRendering.ts` | Pierre theme names, patch parse, fnv keys. |
| `lib/diffRendering.test.ts` | |
| `lib/syntaxHighlighting.ts` | Shiki-js via Pierre. |
| `lib/syntaxHighlighting.test.ts` | |
| `lib/turnDiffTree.ts` | File tree from turn diffs. |
| `lib/turnDiffTree.test.ts` | |
| `lib/baseRefChoices.ts` | Local/remote ref pairing for PR base picker. |
| `lib/baseRefChoices.test.ts` | |
| `lib/terminalFocus.ts` | `[data-terminal-owner]` focus owner. |
| `lib/terminalFocus.test.ts` | |
| `lib/previewFocus.ts` | `[data-preview-panel-mode]` / `<webview>`. Webview branch is Electron; keep the DOM selector. |
| `lib/terminalCloseShortcut.ts` | Prevent default on close chord while focused. |
| `lib/terminalCloseShortcut.test.ts` | |
| `lib/terminalUiStateCleanup.ts` | Which thread keys keep terminal UI state. |
| `lib/elementContext.ts` | Preview element-pick payload + prompt wrapping. Keep if Nero preview picker exists. |
| `lib/elementContext.test.ts` | |
| `lib/previewAnnotation.ts` | Annotation → prompt + screenshot file. |
| `lib/previewAnnotation.test.ts` | |
| `lib/terminalContext.ts` | Terminal selection → prompt blocks / placeholders. |
| `lib/terminalContext.test.ts` | |
| `lib/contextWindow.ts` | Token-window math + provider display name. |
| `lib/contextWindow.test.ts` | “This agent” fallback is fine. |
| `lib/projectScriptKeybindings.ts` | Decode a keybinding rule string. Keep if scripts stay. |
| `lib/projectScriptKeybindings.test.ts` | |
| `lib/composerDraftUploads.ts` | Release uploads when a draft dies. |
| `lib/attachmentUploadState.ts` | Upload state machine types. |
| `lib/attachmentUploadState.test.ts` | |
| `lib/openPullRequestLink.ts` | Parse GH/GL/Azure/Bitbucket URLs; decide in-app vs external. **COPY** the parser. **ADAPT** `useOpenChangeRequestLink` (T3 project matching + RPC). Tests use `pingdotgg/t3code` as fixtures only. |

### 5.2 ADAPT — utilities glued to T3 RPC / domain

| File | Why |
| --- | --- |
| `lib/archivedThreadsState.ts` | Archived snapshot atom family over `orchestrationEnvironment`. Keep hook shape. |
| `lib/attachmentUploadQueue.ts` | Zustand queue + `attachmentsCreateUploadUrl`. Nero upload API. |
| `lib/attachmentUploadQueue.test.ts` | |
| `lib/checkpointDiffState.ts` | Thin wrapper over `state/queries`. |
| `lib/composerPathSearchState.ts` | Thin wrapper over path search query. |
| `lib/chatThreadActions.ts` | New-thread origin / model override. Worktree “start from origin” is T3 env-mode; map to Nero. |
| `lib/chatThreadActions.test.ts` | |
| `lib/diffFileContents.ts` | Loaders that call T3 git/PR/review RPCs for Pierre. |
| `lib/diffFileContents.test.ts` | |
| `lib/threadSort.ts` | Re-export of `@t3tools/client-runtime/state/thread-sort`. **Copy the implementation** into Nero (or shared), do not depend on T3 client-runtime. |
| `lib/threadSort.test.ts` | |
| `lib/projectPaths.ts` | Re-export of T3 project path helpers. Same: copy or rewrite, no T3 runtime. |
| `lib/projectPaths.test.ts` | |
| `lib/sourceControlActions.ts` | Re-export of `state/sourceControlActions`. |
| `lib/terminalCloseConfirm.ts` | Confirm copy via `localApi.dialogs.confirm`. Keep. |
| `lib/terminalCloseConfirm.test.ts` | |
| `lib/backgroundActivityReporter.ts` | Heartbeat so the T3 server knows a UI is present (`WS_METHODS` client activity, `t3.backgroundActivity.clientId`). **This maps to Nero keep-awake** (human UI connected). Rewrite onto Nero’s session/lease API. Do not speak T3 WS. |
| `lib/backgroundActivityReporter.test.ts` | |
| `lib/resourceTelemetryState.ts` | T3 server CPU/RSS query. Nero wants cgroup/workspace telemetry — new API, same hook shape is fine. |

### 5.3 DELETE

| File | Why |
| --- | --- |
| `lib/runtime.ts` | Effect runtime for T3 remote HTTP + **T3 Connect relay** + DPoP (`serviceName: "t3-web-relay-client"`). This is T3 cloud, not skin. Nero HTTP/WS runtime is new. |
| `lib/t3ProjectFileDefaults.ts` | Reads `t3.json` `defaultThreadEnvMode`. |
| `lib/windowControlsOverlay.ts` | Electron Window Controls Overlay + `electron` / `electron-windows` document classes. T3 desktop host. Nero web does not need it. |

---

## 6. `rpc/`

| File | Verdict | Why |
| --- | --- | --- |
| `rpc/atomRegistry.ts` | **COPY** | Effect Atom registry + React provider. Generic. |
| `rpc/transportError.ts` | **ADAPT** | Re-export of T3 client-runtime error sanitizers. Copy the functions; drop the T3 package. |
| `rpc/requestLatencyState.ts` | **ADAPT** | Slow-RPC toast tracker is good UX. Hard-codes T3 `WS_METHODS` (skip `previewAutomationConnect`; long leash for `serverUpdateProvider` / `serverRefreshProviders` / `serverUpdateServer`). Rebuild the allow/deny lists for Nero methods. **Delete** the T3 server-update long-runners with those methods. |
| `rpc/requestLatencyState.test.ts` | **ADAPT** | |

Do not copy a T3 WebSocket protocol adapter into this folder. That is the T3 server.

---

## 7. `state/`

Almost every file is `createXEnvironmentAtoms(connectionAtomRuntime)` — a thin web binding onto T3 client-runtime talking to a T3 server. **None of these copy as T3 atoms.** Verdicts below mean: keep a Nero atom/hook of the same *job*, or delete the job.

### 7.1 Generic runners — ADAPT (copy the React glue)

| File | Job |
| --- | --- |
| `state/use-atom-command.ts` | Run a mutation against the registry. |
| `state/use-atom-query-runner.ts` | One-shot query. |
| `state/query.ts` | `useEnvironmentQuery` view (`data` / `error` / `isPending` / `refresh`). Rename “environment” → workspace. |
| `state/paginatedBranches.ts` | Infinite-scroll helper for ref lists. Pure. Could be **COPY** of the functions. |

### 7.2 Core workspace read model — ADAPT

Rewrite against Nero. Do not import `connectionAtomRuntime`.

| File | Job in the skin |
| --- | --- |
| `state/entities.ts` | Active workspace, projects, thread shells/details/messages/activities/plans/session. Capability flags (settle/snooze/pin) must come from Nero, not T3 server hello. |
| `state/threads.ts` | Thread list + detail atoms. |
| `state/projects.ts` | Project list + ⇧⌘F content search (`WS_METHODS.projectsSearchContents`). |
| `state/orchestration.ts` | Turns / archive snapshots. |
| `state/session.ts` | Prepared connection + `/api/auth/session`. Nero auth is not T3 pairing session. |
| `state/shell.ts` | Snapshot of projects/threads per connected server. Becomes per-workspace snapshot. |
| `state/queries.ts` | Thread search, path search, content search, checkpoint diffs, paginated branches. |
| `state/filesystem.ts` | Folder browse for add-project. Nero: browse **inside the workspace**, not the user’s laptop. |
| `state/assets.ts` | Binary asset URLs (favicons, images). |
| `state/attachments.ts` | Upload URL + delete commands. |
| `state/git.ts` | Git RPCs. |
| `state/vcs.ts` | VCS status + action manager. |
| `state/sourceControl.ts` | Clone/publish providers. |
| `state/sourceControlActions.ts` | UI hooks: init, pull, stacked git, publish, prepare-PR-thread. |
| `state/pullRequests.ts` | PR list/detail merge across environments. Nero: one workspace, maybe still merge if multiple remotes. |
| `state/review.ts` | Review comments. |
| `state/terminal.ts` | Terminal environment atoms. |
| `state/terminalSessions.ts` | Attach + running-id helpers. |
| `state/preview.ts` | Preview sessions. |
| `state/usage.ts` | Merged usage across T3 environments. Nero: usage per workspace / per user. Drop multi-T3-server merge. |
| `state/server.ts` | T3 `ServerConfig` / providers / keybindings / welcome / observability. **This file is the T3 server hello.** Split what Nero still needs (provider/agent catalog, keymap) into Nero config atoms. Do **not** keep `serverUpdate*`, `serverSelfUpdate`, `primaryServerWelcome`. |
| `state/environments.ts` | Catalog of connected T3 servers + relay-managed flag. Replace with Nero workspace list. `relayManaged` **DELETE**. |
| `state/presentation.ts` | Connection presentation (phase, label, URL). Keep the idea for workspace connection chrome. |
| `state/primaryEnvironment.ts` | **DELETE the concept.** Resolves `PrimaryConnectionTarget` (the local `npx t3`). Nero has no primary laptop server. Any “active workspace” atom lives on `entities` / a workspace store. |

### 7.3 DELETE — T3 host / cloud / desktop

| File | Why |
| --- | --- |
| `state/relay.ts` | T3 Connect relay discovery. |
| `state/auth.ts` | T3 environment auth atoms (pairing / session on the T3 server). Nero auth is a different product. |
| `state/desktopUpdate.ts` | Electron auto-update via `desktopBridge`. |
| `state/desktopUpdate.test.ts` | |
| `state/desktopWslState.ts` | `desktopBridge.getWslState`. |
| `state/desktopWslState.test.ts` | |
| `state/desktopSshHosts.ts` | `desktopBridge.discoverSshHosts` for T3 SSH environments. |
| `state/desktopSshHosts.test.ts` | |
| `state/desktopNetworkAccess.ts` | Advertised LAN/tailnet endpoints of the **T3 desktop-hosted server**. |
| `state/desktopNetworkAccess.test.ts` | |

`state/entities.test.ts` / `queries.test.ts` follow the ADAPT sources.

---

## 8. `observability/`

| File | Verdict | Why |
| --- | --- | --- |
| `observability/clientTracing.ts` | **DELETE** | Builds an OTLP exporter to the **T3 primary** `/api/observability/v1/traces` with `serviceName: "t3-web"` / `service.runtime: "t3-web"`. That sink is the T3 server. Nero tracing, if any, is a new exporter to Nero’s collector with Nero resource attributes. |

---

## 9. Suggested import order for the skin

Bring over in this order so the chrome compiles without the T3 server:

1. **COPY kit:** `components/ui/*` (except toast scoping), `lib/utils`, `lib/storage`, `lib/lruCache`, appearance + markdown + vscode/open-vsx, `confirmDialog` + `contextMenuFallback`, `hooks/useLocalStorage` / `useMediaQuery` / `useCommitOnBlur` / `useCopyToClipboard` / `useNowMinute` / `useResizableWidth` / `useLiveRefresh` / `useTerminalFocus`, `rpc/atomRegistry`, `workspaceTitlebar`.
2. **ADAPT theme:** `themePalette` without T3 Chat, `hooks/useTheme`, index.html boot script, `SplashScreen`.
3. **ADAPT local chrome:** `localApi` (DOM-only), `ConfirmDialogHost`, layout (`WorkspacePage*`, `AppSidebarLayout` shell, `threadSidebarWidth`).
4. **ADAPT Nero API:** new workspace/thread/git/terminal atoms replacing `state/*` ADAPT rows; then ChatView / Sidebar / CommandPalette / DiffPanel / AgentsPanel.
5. **Never import:** DELETE rows (versionSkew, ServerUpdate*, desktopUpdate*, ProviderUpdate*, QuitHold, WSL, relay, T3 tracing, `lib/runtime.ts`, `t3.json` hooks, primary-environment atom).

---

## 10. Out of scope (already mapped elsewhere)

Not listed file-by-file here:

- `components/auth`, `chat`, `clerk`, `cloud`, `desktop`, `diffs`, `files`, `preview`, `pullRequest`, `search`, `settings`, `sidebar`, `usage`
- `src/browser/`, `src/cloud/`, `src/connection/`, `src/environments/`, `src/routes/`, `src/terminal/`
- App root (`AppRoot.tsx`, `main.tsx`, `router.ts`, `branding.ts`) except where this map names remnants those files must stop providing (`APP_VERSION` for versionSkew, `APP_STAGE_LABEL` for the backdrop)

`clerk/` and `cloud/` are T3 Connect / pairing — expect **DELETE** in those maps, which is why `state/relay.ts`, `lib/runtime.ts`, and `observability/clientTracing.ts` die here too.
