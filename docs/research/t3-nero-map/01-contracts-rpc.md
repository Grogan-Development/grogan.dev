# T3 contracts RPC map for Nero

Source: `/tmp/t3code-upstream` at HEAD `0009aac`.
Primary files: `packages/contracts/src/rpc.ts`, `packages/contracts/src/orchestration.ts`, `packages/contracts/src/server.ts`, `packages/contracts/src/providerInstance.ts`, `packages/contracts/src/auth.ts`, `packages/contracts/src/environment.ts`, `packages/contracts/src/environmentHttp.ts`, `packages/contracts/src/settings.ts`.

Call sites used to name UI features: `packages/client-runtime/src/state/*`, `packages/client-runtime/src/operations/commands.ts`, `packages/client-runtime/src/rpc/session.ts`, `apps/web/src/**`.

## Nero decision rules

Nero copies these contracts and adapts them. There is no T3 server. There is one provider driver slug: `nero`. `ProviderDriverKind` is already an **open** branded slug (`packages/contracts/src/providerInstance.ts`); Nero does not need to reopen it.

- **IMPLEMENT** — adapted web still calls this RPC (or the UI that calls it is kept). Nero must implement the method.
- **ADAPT** — keep the method, change schema, literals, defaults, or T3-specific fields (single `nero` instance, drop T3 URNs, drop CLI-provider blobs).
- **DELETE** — only if Nero deletes the UI that calls it, or no client UI calls it today.

Clerk is **not** in `packages/contracts`. T3 Connect Clerk lives in `infra/relay` and client env (`VITE_CLERK_*`). Contracts only model pairing, session methods, DPoP, and Connect HTTP/RPC.

HTTP auth and Connect endpoints are not `WS_METHODS`. They are inventoried in the auth section because the web pairs and connects before any WS RPC runs.

---

## 1. `WS_METHODS`

Defined in `packages/contracts/src/rpc.ts` (`WS_METHODS`, lines 209–334). Wired into `WsRpcGroup` unless noted.

| Method key | Wire tag | Stream? | In `WsRpcGroup`? | UI feature (call sites) | Nero |
|---|---|---|---|---|---|
| `projectsList` | `projects.list` | no | **no** | Dead name. Project listing is the orchestration shell snapshot, not this RPC. | **DELETE** |
| `projectsAdd` | `projects.add` | no | **no** | Dead name. Add project is `project.create` via `orchestration.dispatchCommand`. | **DELETE** |
| `projectsRemove` | `projects.remove` | no | **no** | Dead name. Remove project is `project.delete` via `orchestration.dispatchCommand`. | **DELETE** |
| `projectsListEntries` | `projects.listEntries` | no | yes | File tree / folder listing in the workspace (`packages/client-runtime/src/state/projectCommands.ts` → `listEntries`). | **IMPLEMENT** |
| `projectsReadFile` | `projects.readFile` | no | yes | In-app file reader (`projectCommands.ts` → `readFile`). | **IMPLEMENT** |
| `projectsSearchContents` | `projects.searchContents` | no | yes | Workspace content search (`apps/web/src/state/projects.ts`). | **IMPLEMENT** |
| `projectsSearchEntries` | `projects.searchEntries` | no | yes | Path/file-name search (`projectCommands.ts` → `searchEntries`; command palette / file picker). | **IMPLEMENT** |
| `projectsWriteFile` | `projects.writeFile` | no | yes | In-app file write (`projectCommands.ts` → `writeFile`). | **IMPLEMENT** |
| `shellOpenInEditor` | `shell.openInEditor` | no | yes | Open path in external editor / reveal in file manager (`packages/client-runtime/src/state/shellCommands.ts`; `apps/web/src/editorPreferences.ts`; `apps/web/src/components/ChatMarkdown.tsx`; `apps/web/src/diffFileActions.ts`). | **IMPLEMENT** |
| `filesystemBrowse` | `filesystem.browse` | no | yes | Directory picker when adding/changing a project workspace (`packages/client-runtime/src/state/filesystem.ts`). | **IMPLEMENT** |
| `assetsCreateUrl` | `assets.createUrl` | no | yes | Signed URL for chat/message assets (`packages/client-runtime/src/state/assets.ts`). | **IMPLEMENT** |
| `attachmentsCreateUploadUrl` | `attachments.createUploadUrl` | no | yes | Composer file/image upload signing (`apps/web/src/state/attachments.ts`). Gated by `ExecutionEnvironmentCapabilities.attachmentUploads` / `fileAttachments`. | **IMPLEMENT** |
| `attachmentsDelete` | `attachments.delete` | no | yes | Delete a pending composer upload (`apps/web/src/state/attachments.ts`). | **IMPLEMENT** |
| `providerUploadFeedback` | `provider.uploadFeedback` | no | yes | Codex-style `/feedback` from chat (`apps/web/src/components/ChatView.tsx` `uploadThreadFeedback` → `threadEnvironment.uploadFeedback`). | **DELETE** (delete Codex feedback UI) or **ADAPT** if Nero has its own feedback sink |
| `vcsPull` | `vcs.pull` | no | yes | Git pull (`packages/client-runtime/src/state/vcs.ts`; `apps/web/src/components/GitActionsControl.tsx`). | **IMPLEMENT** |
| `vcsRefreshStatus` | `vcs.refreshStatus` | no | yes | Manual git status refresh (`vcs.ts`). | **IMPLEMENT** |
| `vcsListRefs` | `vcs.listRefs` | no | yes | Branch/tag picker (`vcs.ts`). | **IMPLEMENT** |
| `vcsCreateWorktree` | `vcs.createWorktree` | no | yes | New-thread worktree mode (`vcs.ts`; thread create bootstrap). | **IMPLEMENT** |
| `vcsRemoveWorktree` | `vcs.removeWorktree` | no | yes | Remove a thread worktree (`vcs.ts`). | **IMPLEMENT** |
| `vcsCreateRef` | `vcs.createRef` | no | yes | Create branch (`vcs.ts`). | **IMPLEMENT** |
| `vcsSwitchRef` | `vcs.switchRef` | no | yes | Checkout / switch branch (`vcs.ts`). | **IMPLEMENT** |
| `vcsInit` | `vcs.init` | no | yes | `git init` for a non-repo workspace (`vcs.ts`). | **IMPLEMENT** |
| `gitRunStackedAction` | `git.runStackedAction` | **yes** | yes | Commit / stacked change-request run (`packages/client-runtime/src/state/vcsAction.ts`; `apps/web/src/state/sourceControlActions.ts` `runStackedAction`). | **IMPLEMENT** |
| `gitResolvePullRequest` | `git.resolvePullRequest` | no | yes | Resolve PR metadata for a local branch (`packages/client-runtime/src/state/git.ts`). | **IMPLEMENT** |
| `gitPreparePullRequestThread` | `git.preparePullRequestThread` | no | yes | “Open a thread for this PR” (`git.ts`; `apps/web/src/components/PullRequestThreadDialog.tsx`). | **IMPLEMENT** |
| `reviewGetDiffPreview` | `review.getDiffPreview` | no | yes | Compact/mobile live diff preview, **not** persisted T3 Review (`packages/client-runtime/src/state/review.ts`; comment in `rpc.ts`). | **IMPLEMENT** |
| `reviewGetDiffFileContents` | `review.getDiffFileContents` | no | yes | File contents behind a review preview (`review.ts`). | **IMPLEMENT** |
| `terminalOpen` | `terminal.open` | no | yes | Open a PTY (`packages/client-runtime/src/state/terminal.ts`). | **IMPLEMENT** |
| `terminalAttach` | `terminal.attach` | **yes** | yes | Stream PTY output (`terminal.ts`). | **IMPLEMENT** |
| `terminalWrite` | `terminal.write` | no | yes | Keystrokes into PTY (`terminal.ts`). | **IMPLEMENT** |
| `terminalResize` | `terminal.resize` | no | yes | PTY size (`terminal.ts`). | **IMPLEMENT** |
| `terminalClear` | `terminal.clear` | no | yes | Clear terminal buffer (`terminal.ts`). | **IMPLEMENT** |
| `terminalRestart` | `terminal.restart` | no | yes | Restart PTY (`terminal.ts`). | **IMPLEMENT** |
| `terminalClose` | `terminal.close` | no | yes | Close PTY (`terminal.ts`). | **IMPLEMENT** |
| `previewOpen` | `preview.open` | no | yes | In-app preview browser tab (`packages/client-runtime/src/state/preview.ts`). | **IMPLEMENT** |
| `previewNavigate` | `preview.navigate` | no | yes | Navigate preview URL (`preview.ts`). | **IMPLEMENT** |
| `previewResize` | `preview.resize` | no | yes | Preview viewport (`preview.ts`). | **IMPLEMENT** |
| `previewRefresh` | `preview.refresh` | no | yes | Reload preview (`preview.ts`). | **IMPLEMENT** |
| `previewClose` | `preview.close` | no | yes | Close preview tab (`preview.ts`). | **IMPLEMENT** |
| `previewList` | `preview.list` | no | yes | List open preview sessions (`preview.ts`). | **IMPLEMENT** |
| `previewReportStatus` | `preview.reportStatus` | no | yes | Client reports preview load/status (`preview.ts`). | **IMPLEMENT** |
| `previewAutomationConnect` | `previewAutomation.connect` | **yes** | yes | Agent-driven browser automation stream (`preview.ts`). | **IMPLEMENT** |
| `previewAutomationRespond` | `previewAutomation.respond` | no | yes | Automation command results (`preview.ts`). | **IMPLEMENT** |
| `previewAutomationFocusHost` | `previewAutomation.focusHost` | no | yes | Focus the automation host window (`preview.ts`). | **IMPLEMENT** |
| `serverProbe` | `server.probe` | no | yes | Cheap liveness after connect (`packages/client-runtime/src/rpc/session.ts`). | **IMPLEMENT** |
| `serverGetConfig` | `server.getConfig` | no | yes | Initial `ServerConfig` (auth, providers, settings, keybindings, capabilities) (`session.ts`). | **IMPLEMENT** (payload **ADAPT**: see §4) |
| `serverRefreshProviders` | `server.refreshProviders` | no | yes | Re-probe provider instances (`packages/client-runtime/src/state/server.ts`; Settings → Providers). | **IMPLEMENT** (one `nero` instance) |
| `serverUpdateProvider` | `server.updateProvider` | no | yes | One-click CLI provider update (`apps/web/src/components/ProviderUpdateEnvironmentRows.tsx`, `ProviderUpdatePrimaryNotification.tsx`). | **DELETE** (delete T3 CLI-update UI) |
| `serverUpdateServer` | `server.updateServer` | no | yes | Self-update the T3 `t3` npm/boot-service binary (`apps/web/src/components/ServerUpdateAction.tsx`). Input is `targetVersion` of the `t3` package (`server.ts`). | **DELETE** (delete T3 self-update UI) |
| `serverUpdateServerWithProgress` | `server.updateServerWithProgress` | **yes** | yes | Same as above with download/install progress (`server.ts` `updateServerWithProgress`). | **DELETE** |
| `serverUpsertKeybinding` | `server.upsertKeybinding` | no | yes | Settings → Keybindings; project script bindings (`apps/web/src/components/settings/KeybindingsSettings.tsx`, `ProjectSettingsPanel.tsx`, `ChatView.tsx`). | **IMPLEMENT** |
| `serverRemoveKeybinding` | `server.removeKeybinding` | no | yes | Remove a keybinding (same panels). | **IMPLEMENT** |
| `serverGetSettings` | `server.getSettings` | no | yes | Server implements it (`apps/server/src/ws.ts`). **No client-runtime/web/mobile caller.** Web uses `server.getConfig` + `subscribeServerConfig`. | **DELETE** |
| `serverUpdateSettings` | `server.updateSettings` | no | yes | Patch `ServerSettings` (`packages/client-runtime/src/state/server.ts`; Settings). | **IMPLEMENT** (`ServerSettings` **ADAPT**: drop `providers.codex|claudeAgent|cursor|grok|opencode`) |
| `serverDiscoverSourceControl` | `server.discoverSourceControl` | no | yes | Detect gh/glab/etc on the host (`packages/client-runtime/src/state/sourceControl.ts`). | **IMPLEMENT** |
| `serverGetTraceDiagnostics` | `server.getTraceDiagnostics` | no | yes | Settings → Diagnostics traces (`apps/web/src/components/settings/DiagnosticsSettings.tsx`). | **IMPLEMENT** if Nero keeps Diagnostics; else **DELETE** that panel |
| `serverGetProcessDiagnostics` | `server.getProcessDiagnostics` | no | yes | Process tree in Diagnostics (`DiagnosticsSettings.tsx`). | **IMPLEMENT** / **DELETE** with Diagnostics panel |
| `serverGetProcessResourceHistory` | `server.getProcessResourceHistory` | no | yes | CPU/RSS history (`DiagnosticsSettings.tsx`). | **IMPLEMENT** / **DELETE** with Diagnostics panel |
| `serverGetResourceTelemetryHistory` | `server.getResourceTelemetryHistory` | no | yes | Resource telemetry history (`apps/web/src/lib/resourceTelemetryState.ts`, `ResourceTelemetryDiagnostics.tsx`). | **IMPLEMENT** / **DELETE** with Diagnostics panel |
| `serverRetryResourceTelemetry` | `server.retryResourceTelemetry` | no | yes | Retry failed telemetry collector (`resourceTelemetryState.ts`). | **IMPLEMENT** / **DELETE** with Diagnostics panel |
| `serverSignalProcess` | `server.signalProcess` | no | yes | SIGINT/SIGKILL a descendant process from Diagnostics (`DiagnosticsSettings.tsx`, `ResourceTelemetryDiagnostics.tsx`). | **IMPLEMENT** / **DELETE** with Diagnostics panel |
| `serverReportClientActivity` | `server.reportClientActivity` | no | yes | Web reports focus/visibility/input so the host can pause background work (`apps/web/src/lib/backgroundActivityReporter.ts`). | **IMPLEMENT** |
| `serverReportHostPowerState` | `server.reportHostPowerState` | no | yes | Host battery/idle/lock. Implemented on T3 server. **No client-runtime or web caller**; desktop host power goes through Electron IPC (`apps/desktop/src/telemetry/DesktopTelemetryPublisher.ts`), not this WS method. | **DELETE** unless Nero ships a desktop host that reports over WS |
| `serverGetBackgroundPolicy` | `server.getBackgroundPolicy` | no | yes | Snapshot of pause/idle policy. Server implements. **No client caller.** | **DELETE** |
| `serverGetUsageSummary` | `server.getUsageSummary` | no | yes | `/usage` page (`apps/web/src/routes/usage.tsx`, `apps/web/src/state/usage.ts`). Contract scans Claude/Codex/Grok CLI transcripts (`packages/contracts/src/usage.ts`; `UsageProviderKind` = `claude` \| `codex` \| `grok`). | **DELETE** (delete `/usage`) or **ADAPT** (`UsageProviderKind` → `nero`) |
| `cloudGetRelayClientStatus` | `cloud.getRelayClientStatus` | no | yes | T3 Connect: is `cloudflared`/relay client installed (`apps/web/src/cloud/linkEnvironment.ts`). | **DELETE** (delete T3 Connect UI) |
| `cloudInstallRelayClient` | `cloud.installRelayClient` | **yes** | yes | T3 Connect: install relay client (`linkEnvironment.ts`). | **DELETE** |
| `pullRequestsList` | `pullRequests.list` | no | yes | PR inbox list (`packages/client-runtime/src/state/pullRequests.ts`; PR workspace UI). | **IMPLEMENT** |
| `pullRequestsListStats` | `pullRequests.listStats` | no | yes | Line-count stats for list rows (comment in `rpc.ts`: split so rows paint first). | **IMPLEMENT** |
| `pullRequestsDetail` | `pullRequests.detail` | no | yes | PR detail panel (`apps/web/src/components/pullRequest/PullRequestDetailPanel.tsx`). | **IMPLEMENT** |
| `pullRequestsActivity` | `pullRequests.activity` | no | yes | PR timeline (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsThreadComments` | `pullRequests.threadComments` | no | yes | Review-thread comments (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsDiffFileContents` | `pullRequests.diffFileContents` | no | yes | PR file blob contents (`pullRequests.ts`). Large diffs also use HTTP `POST /api/pull-requests/diff` (`environmentHttp.ts`). | **IMPLEMENT** |
| `pullRequestsRunAction` | `pullRequests.runAction` | no | yes | Merge / close / reopen / ready (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsUpdate` | `pullRequests.update` | no | yes | Edit title/body (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsComment` | `pullRequests.comment` | no | yes | Issue comment (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsUpdateComment` | `pullRequests.updateComment` | no | yes | Edit comment (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsSubmitReview` | `pullRequests.submitReview` | no | yes | Submit review (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsReplyToThread` | `pullRequests.replyToThread` | no | yes | Reply on a review thread (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsSetThreadResolution` | `pullRequests.setThreadResolution` | no | yes | Resolve/unresolve thread (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsSetReaction` | `pullRequests.setReaction` | no | yes | Emoji reaction (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsInvalidate` | `pullRequests.invalidate` | no | yes | Bust PR cache (`pullRequests.ts`). | **IMPLEMENT** |
| `pullRequestsReviewerCandidates` | `pullRequests.reviewerCandidates` | no | yes | Reviewer picker (`pullRequests.ts`; comment in `rpc.ts`: not bundled into detail). | **IMPLEMENT** |
| `pullRequestsRequestReviewers` | `pullRequests.requestReviewers` | no | yes | Request reviewers (`pullRequests.ts`). | **IMPLEMENT** |
| `sourceControlLookupRepository` | `sourceControl.lookupRepository` | no | yes | Resolve owner/repo from git remote (`sourceControl.ts`). | **IMPLEMENT** |
| `sourceControlCloneRepository` | `sourceControl.cloneRepository` | no | yes | Clone into a new project (`sourceControl.ts`). | **IMPLEMENT** |
| `sourceControlPublishRepository` | `sourceControl.publishRepository` | no | yes | Create remote + push (`sourceControl.ts`; `GitActionsControl.tsx`). | **IMPLEMENT** |
| `subscribeVcsStatus` | `subscribeVcsStatus` | **yes** | yes | Live git status for sidebar/header (`packages/client-runtime/src/state/vcs.ts`). | **IMPLEMENT** |
| `subscribeTerminalEvents` | `subscribeTerminalEvents` | **yes** | yes | Terminal session list events (`terminal.ts`). | **IMPLEMENT** |
| `subscribeTerminalMetadata` | `subscribeTerminalMetadata` | **yes** | yes | Terminal title/cwd metadata (`terminal.ts`). | **IMPLEMENT** |
| `subscribePreviewEvents` | `subscribePreviewEvents` | **yes** | yes | Preview session events (`preview.ts`). | **IMPLEMENT** |
| `subscribeDiscoveredLocalServers` | `subscribeDiscoveredLocalServers` | **yes** | yes | Auto-discover local dev servers for preview (`preview.ts`). | **IMPLEMENT** |
| `subscribeServerConfig` | `subscribeServerConfig` | **yes** | yes | Live `ServerConfig` (providers, settings, keybindings) (`packages/client-runtime/src/state/server.ts`). | **IMPLEMENT** (payload **ADAPT**) |
| `subscribeServerLifecycle` | `subscribeServerLifecycle` | **yes** | yes | Welcome/ready after connect or self-update (`server.ts`). Welcome still useful without T3 self-update. | **IMPLEMENT** (drop `updateOutcome` / **ADAPT** `ServerLifecycleReadyPayload`) |
| `subscribeAuthAccess` | `subscribeAuthAccess` | **yes** | yes | Settings → Connections: pairing links + client sessions (`packages/client-runtime/src/state/auth.ts`). | **IMPLEMENT** if Nero keeps pairing; **DELETE** if Nero is unsafe-no-auth / single-user cookie only |
| `subscribeBackgroundPolicy` | `subscribeBackgroundPolicy` | **yes** | yes | Live background-pause policy. Server implements. **No client caller.** | **DELETE** |
| `subscribeResourceTelemetry` | `subscribeResourceTelemetry` | **yes** | yes | Live resource telemetry (`server.ts`; Diagnostics). | **IMPLEMENT** / **DELETE** with Diagnostics panel |

**Counts:** 97 keys in `WS_METHODS`. 94 of those are in `WsRpcGroup`. 3 names (`projects.list`, `projects.add`, `projects.remove`) are leftovers.

---

## 2. `ORCHESTRATION_WS_METHODS`

Defined in `packages/contracts/src/orchestration.ts` lines 27–36. Each is also an `Rpc.make` in `packages/contracts/src/rpc.ts` and a member of `WsRpcGroup`.

| Method key | Wire tag | Stream? | UI feature (call sites) | Nero |
|---|---|---|---|---|
| `dispatchCommand` | `orchestration.dispatchCommand` | no | Every project/thread mutation. Client wrapper: `packages/client-runtime/src/operations/commands.ts`. Also HTTP `POST /api/orchestration/dispatch`. | **IMPLEMENT** (command union **ADAPT** only if Nero drops a thread feature) |
| `getWorkflowScript` | `orchestration.getWorkflowScript` | no | Agents panel reads a workflow `.js` by path (`apps/web/src/components/AgentsPanel.tsx`; `packages/client-runtime/src/state/orchestration.ts` `workflowScript`). | **IMPLEMENT** |
| `getTurnDiff` | `orchestration.getTurnDiff` | no | Per-turn checkpoint diff in chat/review (`apps/web/src/state/queries.ts` `turnDiff`). | **IMPLEMENT** |
| `getFullThreadDiff` | `orchestration.getFullThreadDiff` | no | Whole-thread checkpoint diff (`queries.ts` `fullThreadDiff`). | **IMPLEMENT** |
| `searchThreads` | `orchestration.searchThreads` | no | Command palette thread content search (`apps/web/src/components/CommandPalette.tsx` `useThreadSearch` → `orchestrationEnvironment.threadSearch`). Sidebar title filter is local and does **not** call this. | **IMPLEMENT** |
| `getArchivedShellSnapshot` | `orchestration.getArchivedShellSnapshot` | no | Settings archived-threads list (`apps/web/src/lib/archivedThreadsState.ts`; `SettingsPanels.tsx`). | **IMPLEMENT** |
| `subscribeShell` | `orchestration.subscribeShell` | **yes** | Project/thread list live sync (`packages/client-runtime/src/state/shell.ts`). Primary read model for sidebar. | **IMPLEMENT** |
| `subscribeThread` | `orchestration.subscribeThread` | **yes** | Open-thread transcript live sync (`packages/client-runtime/src/state/threads.ts`). | **IMPLEMENT** |

**Count:** 8 methods.

HTTP twins (not WS, but adapted web/mobile may still use them): `GET /api/orchestration/snapshot`, `GET /api/orchestration/shell`, `GET /api/orchestration/threads/:threadId`, `POST /api/orchestration/dispatch` in `packages/contracts/src/environmentHttp.ts`.

---

## 3. `ClientOrchestrationCommand` kinds

Union in `packages/contracts/src/orchestration.ts` lines 1009–1033. Dispatchable subset (lines 981–1005) is the same kinds; `thread.turn.start` on the wire from clients allows `UploadChatAttachment` (`ClientThreadTurnStartCommand`, lines 915–932) in addition to persisted `ChatAttachment`.

These are **not** client commands (server-only, later in the same file): `thread.session.set`, `thread.message.assistant.delta`, `thread.message.assistant.complete`, `thread.proposed-plan.upsert`, `thread.turn.diff.complete`, `thread.activity.append`, plus revert/title-complete internals.

Client wrappers: `packages/client-runtime/src/operations/commands.ts` → atoms in `packages/client-runtime/src/state/projectCommands.ts` and `threadCommands.ts`.

| `type` | Schema | UI feature | Nero |
|---|---|---|---|
| `project.create` | `ProjectCreateCommand` | Command palette “Add project”; new workspace (`apps/web/src/components/CommandPalette.tsx` `createProject`). | **IMPLEMENT** |
| `project.meta.update` | `ProjectMetaUpdateCommand` | Rename project, change cwd, default model, default thread env mode, favicon, scripts (`LegacySidebar.tsx`, `ProjectSettingsPanel.tsx`, `ChatView.tsx`). | **IMPLEMENT** (`defaultModelSelection` **ADAPT** to `instanceId: "nero"`) |
| `project.delete` | `ProjectDeleteCommand` | Delete project (`LegacySidebar.tsx`, `ProjectSettingsPanel.tsx`). | **IMPLEMENT** |
| `thread.create` | `ThreadCreateCommand` | New thread for a project (`ChatView.tsx` `createThread`; `LegacySidebar.tsx` `createThreadForProjectMember`). Often replaced by `thread.turn.start` + `bootstrap.createThread`. | **IMPLEMENT** |
| `thread.delete` | `ThreadDeleteCommand` | Delete thread (`useThreadActions.ts`). | **IMPLEMENT** |
| `thread.archive` | `ThreadArchiveCommand` | Archive (`useThreadActions.ts`, `useThreadActionMenu.ts`, sidebar swipe). | **IMPLEMENT** |
| `thread.unarchive` | `ThreadUnarchiveCommand` | Unarchive from Settings archived list (`SettingsPanels.tsx`). | **IMPLEMENT** |
| `thread.settle` | `ThreadSettleCommand` | Settle / “done” (`useThreadActions.ts`, chat header). Gated by `capabilities.threadSettlement`. | **IMPLEMENT** |
| `thread.unsettle` | `ThreadUnsettleCommand` | Un-settle (`reason` is only `"user"`). | **IMPLEMENT** |
| `thread.snooze` | `ThreadSnoozeCommand` | Snooze until timestamp (`useThreadActionMenu.ts`). Gated by `capabilities.threadSnooze`. | **IMPLEMENT** |
| `thread.unsnooze` | `ThreadUnsnoozeCommand` | Wake (`reason` is only `"user"`). | **IMPLEMENT** |
| `thread.pin` | `ThreadPinCommand` | Pin (`useThreadActions.ts`, `Sidebar.tsx`). Gated by `capabilities.threadPinning`. | **IMPLEMENT** |
| `thread.unpin` | `ThreadUnpinCommand` | Unpin. | **IMPLEMENT** |
| `thread.pin.reorder` | `ThreadPinReorderCommand` | Drag pinned threads (`Sidebar.tsx` `reorderPinnedThread`). Gated by `capabilities.threadPinReorder`. | **IMPLEMENT** |
| `thread.meta.update` | `ThreadMetaUpdateCommand` | Rename, regenerate title, change model, branch, worktree, linked PR. Gated pieces: `threadTitleRegeneration`, `threadPullRequestLinking`. | **IMPLEMENT** (`modelSelection` **ADAPT**) |
| `thread.runtime-mode.set` | `ThreadRuntimeModeSetCommand` | Approval / auto-edit / auto / full-access toggle (`ChatView.tsx` `setThreadRuntimeMode`). | **IMPLEMENT** |
| `thread.interaction-mode.set` | `ThreadInteractionModeSetCommand` | Default vs plan (`ChatView.tsx`). Shown when `ServerProvider.showInteractionModeToggle`. | **IMPLEMENT**; Nero snapshot should set `showInteractionModeToggle` if plan mode exists |
| `thread.turn.start` | `ClientThreadTurnStartCommand` / `ThreadTurnStartCommand` | Send a user message. May `bootstrap.createThread`, `bootstrap.prepareWorktree`, `bootstrap.runSetupScript`. Composer (`ChatView.tsx` `startThreadTurn`). | **IMPLEMENT** |
| `thread.turn.interrupt` | `ThreadTurnInterruptCommand` | Stop generation (`ChatView.tsx` `interruptTurn`). | **IMPLEMENT** |
| `thread.approval.respond` | `ThreadApprovalRespondCommand` | Approve/deny tool (`ChatView.tsx` `respondToThreadApproval`). | **IMPLEMENT** |
| `thread.user-input.respond` | `ThreadUserInputRespondCommand` | MCP elicitation / questions (`ChatView.tsx` `respondToThreadUserInput`). | **IMPLEMENT** |
| `thread.checkpoint.revert` | `ThreadCheckpointRevertCommand` | Revert N turns (`ChatView.tsx` `revertThreadCheckpoint`). | **IMPLEMENT** |
| `thread.session.stop` | `ThreadSessionStopCommand` | Kill provider session; also settle-cleanup with `onlyIfSettled` (`useThreadActions.ts` `stopThreadSession`). | **IMPLEMENT** |

**Count:** 23 client command kinds (24 union members if you count the two `thread.turn.start` schemas as one kind).

---

## 4. `ServerConfig.providers`: one Nero instance

`ServerConfig` is `packages/contracts/src/server.ts` lines 420–454. `providers` is `ServerProviders` = `ForwardCompatibleArray(ServerProvider)` (lines 161–205).

Identity rules (`packages/contracts/src/providerInstance.ts`):

- `ProviderDriverKind` — open slug, pattern `^[a-zA-Z][a-zA-Z0-9_-]*$`, max 64. Nero uses `nero`.
- `ProviderInstanceId` — same slug rules, different brand. Routing key. Canonical back-compat id is `defaultInstanceIdForDriver(driver)` which is the driver string itself → instance id `nero`.
- `ServerProvider.instanceId` is the only stable routing key. `driver` is metadata.

`ServerSettings` still has a **closed** legacy map (`packages/contracts/src/settings.ts` lines 689–695):

```ts
providers: { codex, claudeAgent, cursor, grok, opencode }
providerInstances: Record<ProviderInstanceId, ProviderInstanceConfig>
```

Nero **ADAPT**: delete the five CLI blobs; keep `providerInstances` with one envelope, or drop the legacy map and only emit `ServerConfig.providers`.

Default text-generation selection today is `{ instanceId: "codex", model: DEFAULT_TEXT_GENERATION_MODEL }` (`settings.ts` ~662–674). Nero **ADAPT** that default to `{ instanceId: "nero", model: <nero-default> }`.

### Example `ServerConfig.providers` with a single Nero instance

Shape required by `ServerProvider` (`server.ts` 161–197). Fields Nero can omit if unused are marked.

```json
[
  {
    "instanceId": "nero",
    "driver": "nero",
    "displayName": "Nero",
    "enabled": true,
    "installed": true,
    "version": "0.0.0",
    "status": "ready",
    "auth": {
      "status": "authenticated",
      "type": "api-key",
      "label": "Nero"
    },
    "checkedAt": "2026-08-28T00:00:00.000Z",
    "availability": "available",
    "models": [
      {
        "slug": "nero-default",
        "name": "Nero",
        "isCustom": false,
        "isDefault": true,
        "capabilities": null
      }
    ],
    "slashCommands": [],
    "skills": []
  }
]
```

Optional fields Nero may set when the UI needs them:

| Field | Why |
|---|---|
| `accentColor`, `badgeLabel` | Sidebar/model picker chrome |
| `continuation.groupKey` | Resume grouping across threads |
| `showInteractionModeToggle` | Plan-mode toggle in composer |
| `requiresNewThreadForModelChange` | Force new thread on model switch |
| `message` | Warning/error copy when `status` is not `ready` |
| `unavailableReason` | Only if `availability === "unavailable"` |
| `versionAdvisory` | T3 CLI “behind latest” — Nero should **omit** (pairs with deleted `server.updateProvider`) |
| `updateState` | Same |

Matching `ServerSettings.providerInstances` envelope:

```json
{
  "nero": {
    "driver": "nero",
    "displayName": "Nero",
    "enabled": true,
    "config": {}
  }
}
```

`config` is `Schema.Unknown` at the contracts layer; Nero owns the blob in its driver.

`ModelSelection` on threads/settings becomes `{ "instanceId": "nero", "model": "nero-default" }`. The pre-decode transform still accepts legacy `{ provider, model }` and promotes `provider` → `instanceId` (`orchestration.ts` 67–117). Nero can keep that transform.

`ForwardCompatibleArray` means extra unknown provider snapshots would drop on old clients rather than fail decode. With a single instance, Nero still benefits if it later adds fields.

---

## 5. Auth types that assume T3 Connect, Clerk, or local pairing

Clerk does not appear in `packages/contracts`. T3 Connect Clerk is `infra/relay` + `docs/internals/t3-connect.md`. Contracts assume **pairing**, **session cookies/tokens**, **DPoP for managed relay**, and **Connect HTTP**.

### `packages/contracts/src/auth.ts`

| Type / constant | T3 assumption | Nero |
|---|---|---|
| `ServerAuthPolicy` = `desktop-managed-local` \| `loopback-browser` \| `remote-reachable` \| `unsafe-no-auth` | Desktop silent bootstrap vs browser pairing vs remote. Not Clerk. | **ADAPT** (keep the four if Nero has desktop + browser + remote; otherwise shrink) |
| `ServerAuthBootstrapMethod` = `desktop-bootstrap` \| `one-time-token` | Electron handoff (`desktopBootstrap.ts` `desktopBootstrapToken`) and `/pair?token=...` local pairing | **IMPLEMENT** `one-time-token` if Nero keeps pairing; **DELETE** `desktop-bootstrap` if no Electron |
| `ServerAuthSessionMethod` = `browser-session-cookie` \| `bearer-access-token` \| `dpop-access-token` | DPoP is “scoped proof-of-possession token used by **managed relay connections**” (comment on `auth.ts` 70–72) | **DELETE** `dpop-access-token` if Nero has no T3 Connect relay; keep cookie and/or bearer |
| `AuthOrchestrationReadScope` / `Operate`, `AuthTerminalOperateScope`, `AuthReviewWriteScope` | Pairing-token scopes | **IMPLEMENT** if pairing stays |
| `AuthAccessReadScope` / `AuthAccessWriteScope` | Settings → Connections (list/revoke pairing links and sessions) | **IMPLEMENT** / **DELETE** with Connections UI |
| `AuthRelayReadScope` / `AuthRelayWriteScope` | T3 Connect relay link | **DELETE** |
| `AuthStandardClientScopes` | Read/operate/terminal/review/**relay:read** — includes Connect | **ADAPT** (drop `relay:read`) |
| `AuthAdministrativeScopes` | Standard + access:* + **relay:write** | **ADAPT** (drop `relay:write`) |
| `AuthTokenExchangeGrantType` = `urn:ietf:params:oauth:grant-type:token-exchange` | RFC 8693; used after pairing | **IMPLEMENT** if pairing/token clients stay |
| `AuthAccessTokenType` = `urn:ietf:params:oauth:token-type:access_token` | Standard | **IMPLEMENT** |
| `AuthEnvironmentBootstrapTokenType` = `urn:t3:params:oauth:token-type:environment-bootstrap` | **T3 URN** | **ADAPT** rename (`urn:nero:...`) and update `packages/client-runtime/src/authorization/remote.ts` |
| `ServerAuthDescriptor` | Advertised in `ServerConfig.auth` | **IMPLEMENT** |
| `AuthBrowserSessionRequest` / `AuthBrowserSessionResult` | POST `/api/auth/browser-session` with pairing credential | **IMPLEMENT** for web pairing |
| `AuthClientPresentationMetadata.webDeployment` = `hosted` \| `server` | `hosted` = app.t3.codes; `server` = npx t3 local web (`baseSchemas.ts` `ClientWebDeployment`) | **ADAPT** if Nero has no hosted app |
| `AuthTokenExchangeRequest` | Form body for `/oauth/token`; subject is environment-bootstrap token | **ADAPT** token type URN |
| `AuthAccessTokenResult.token_type` = `Bearer` \| `DPoP` | DPoP = Connect | **ADAPT** (Bearer only if no relay) |
| `AuthWebSocketTicketResult` | POST `/api/auth/websocket-ticket` then upgrade | **IMPLEMENT** |
| `AuthPairingCredentialResult` / `AuthPairingLink` | Mint/list pairing tokens | **IMPLEMENT** / **DELETE** with pairing UI |
| `AuthAccessSnapshot` + `AuthAccessStreamEvent` | `subscribeAuthAccess` | same |
| `AuthRevokePairingLinkInput` / `AuthRevokeClientSessionInput` / `AuthCreatePairingCredentialInput` | Connections management | same |
| `AuthSessionState` | GET `/api/auth/session` | **IMPLEMENT** |
| `EnvironmentAuthorizationError.requiredScope` | Almost every WS RPC error union | **IMPLEMENT** |

### `packages/contracts/src/environment.ts`

| Type | T3 assumption | Nero |
|---|---|---|
| `ServerSelfUpdateMethod` / `ServerSelfUpdateCapability` including `desktop-managed` | T3 Code desktop owns the server binary | **DELETE** from Nero capabilities (`serverSelfUpdate`, `serverSelfUpdateProgress`) |
| `ExecutionEnvironmentCapabilities.agentActivityPublishing` | T3 Connect Live Activities / push | **DELETE** or always omit |
| `ExecutionEnvironmentCapabilities.pullRequests` / thread flags | Feature gates, not Connect | **IMPLEMENT** as Nero feature flags |
| `GET /.well-known/t3/environment` (`environmentHttp.ts` `EnvironmentMetadataHttpApi`) | **t3 path** | **ADAPT** path to `/.well-known/nero/environment` (breaking; also change Vite proxy comments in Agents.md) |

### `packages/contracts/src/environmentHttp.ts` (HTTP, not WS)

| Endpoint group | Paths | T3 assumption | Nero |
|---|---|---|---|
| `EnvironmentAuthHttpApi` | `/api/auth/session`, `/api/auth/browser-session`, `/oauth/token`, `/api/auth/websocket-ticket`, `/api/auth/pairing-token`, `/api/auth/pairing-links`, `/api/auth/pairing-links/revoke`, `/api/auth/clients`, `/api/auth/clients/revoke`, `/api/auth/clients/revoke-others` | Local pairing + session. Optional DPoP headers. | **IMPLEMENT** pairing/session; **ADAPT** drop DPoP headers if no relay |
| `EnvironmentConnectHttpApi` | `/api/connect/link-proof`, `/api/connect/relay-config`, `/api/connect/link-state`, `/api/connect/unlink`, `/api/connect/preferences`, `/api/t3-connect/health`, `/api/connect/mint-credential`, `/api/t3-connect/mint-credential` | **T3 Connect / Clerk-backed relay.** `EnvironmentCloudLinkStateResult` (`cloudUserId`, `relayUrl`, `relayIssuer`, `managedTunnelActive`, `publishAgentActivity`). | **DELETE** group and Settings Connect UI (`apps/web/src/cloud/*`) |
| `EnvironmentCloudEndpointUnavailableError` | 503 when Connect endpoint is down | Connect | **DELETE** |
| `OptionalDpopProofHeaders` | `dpop` header | Connect | **DELETE** if no DPoP |

### `packages/contracts/src/desktopBootstrap.ts`

`DesktopBackendBootstrap.mode = "desktop"`, `desktopBootstrapToken`, `t3Home`, Tailscale serve flags. Local Electron pairing, not Clerk.

Nero: **DELETE** if no Electron host; **ADAPT** `t3Home` → Nero home if desktop stays.

### `packages/contracts/src/relay.ts` / `relayClient.ts`

Entire files are T3 Connect (Clerk-verified relay, APNs Live Activities, `cloudflared` install). WS `cloud.*` is the environment-side of that.

Nero: **DELETE** these modules and `cloudGetRelayClientStatus` / `cloudInstallRelayClient`.

### `packages/contracts/src/baseSchemas.ts`

| Type | T3 assumption | Nero |
|---|---|---|
| `ClientConnectionMethod` = `direct` \| `ssh` \| `relay` \| `unknown` | `relay` = T3 Connect tunnel | **ADAPT** drop `relay` if Connect is gone |
| `ClientWebDeployment` = `hosted` \| `server` | Hosted marketing app vs local server | **ADAPT** |
| `DpopFailureReason` | Connect DPoP | **DELETE** if no DPoP |
| `ClientSurface` = `web` \| `desktop` \| `mobile` | T3’s three surfaces | **IMPLEMENT** for whichever Nero ships |

### Local pairing vs Clerk (summary)

| Concern | In contracts? | Nero |
|---|---|---|
| Clerk sign-in | **No** | Delete from adapted web (`VITE_CLERK_*`, Connect onboarding copy in `apps/web/src/routes/_chat.index.tsx`) |
| One-time pairing token | **Yes** (`one-time-token`, pairing HTTP, `subscribeAuthAccess`) | Keep if Nero is remote-ready; that is the non-Clerk path |
| Desktop bootstrap token | **Yes** | Keep only with a desktop shell |
| DPoP / managed tunnel | **Yes** (`dpop-access-token`, Connect HTTP, `cloud.*` RPC) | Delete with T3 Connect |
| `unsafe-no-auth` | **Yes** | Optional escape hatch; do not make it the only mode if Nero is remote-ready |

---

## Schema ADAPT checklist (not RPCs, but the adapted web still decodes them)

| Location | Closed T3-shaped piece | Nero |
|---|---|---|
| `settings.ts` `ServerSettings.providers` | `codex`, `claudeAgent`, `cursor`, `grok`, `opencode` | Replace with `nero` or delete; use `providerInstances` |
| `settings.ts` `textGenerationModelSelection` default | `instanceId: "codex"` | `"nero"` |
| `usage.ts` `UsageProviderKind` | `claude` \| `codex` \| `grok` | Delete usage UI or add `nero` |
| `providerRuntime.ts` `RuntimeEventRawSource` | `codex.*`, `claude.sdk.*`, `opencode.sdk.event`, `acp.*` | Add `nero.*` if Nero reuses this event envelope |
| `auth.ts` `AuthEnvironmentBootstrapTokenType` | `urn:t3:...` | `urn:nero:...` |
| `environmentHttp.ts` well-known | `/.well-known/t3/environment` | `/.well-known/nero/environment` |
| `server.ts` `ServerSelfUpdateInput.targetVersion` | “Exact npm version of the `t3` package” | Gone with self-update RPCs |
| `ServerProviderUpdateInput.provider` | Driver kind of CLI to update | Gone with `server.updateProvider` |

---

## RPC inventory totals

| Bucket | Count |
|---|---|
| `WS_METHODS` keys | 97 |
| of which in `WsRpcGroup` | 94 |
| leftover names not in `WsRpcGroup` | 3 (`projects.list`, `projects.add`, `projects.remove`) |
| `ORCHESTRATION_WS_METHODS` | 8 |
| `ClientOrchestrationCommand` kinds | 23 |
| Default Nero: **DELETE** RPCs (T3 Connect, T3 self-update, CLI provider update, dead names, unused background-policy/getSettings/host-power) | `projectsList`, `projectsAdd`, `projectsRemove`, `serverUpdateProvider`, `serverUpdateServer`, `serverUpdateServerWithProgress`, `serverGetSettings`, `serverReportHostPowerState`, `serverGetBackgroundPolicy`, `cloudGetRelayClientStatus`, `cloudInstallRelayClient`, `subscribeBackgroundPolicy` (12). Plus **DELETE** `providerUploadFeedback` and `serverGetUsageSummary` if those UIs are removed. |
| Diagnostics cluster (keep or drop as a set) | `serverGetTraceDiagnostics`, `serverGetProcessDiagnostics`, `serverGetProcessResourceHistory`, `serverGetResourceTelemetryHistory`, `serverRetryResourceTelemetry`, `serverSignalProcess`, `subscribeResourceTelemetry` |
| Pairing cluster (keep or drop as a set) | `subscribeAuthAccess` + HTTP auth pairing endpoints |

Nero’s first backend slice that unblocks adapted web: `server.probe`, `server.getConfig`, `subscribeServerConfig`, `subscribeServerLifecycle`, `orchestration.subscribeShell`, `orchestration.subscribeThread`, `orchestration.dispatchCommand`, then the filesystem/chat/terminal/git methods the remaining UI still imports.
