# T3 web threads / chat UI → Nero

Primary-source map of T3 Code’s web chat/thread surface (`apps/web/src`). Implementations must serve Nero’s locked product shape, not T3’s. No Nero / code-broker / grid-01 product code was consulted.

T3 source: `/tmp/t3code-upstream/apps/web/src` (and the few `packages/client-runtime` / `packages/contracts` types the UI is typed against).

---

## 1. What Nero locked (this slice)

- **One harness.** Pi-like. Not Codex/Claude/Cursor/Grok/OpenCode adapters. Threads are **user ↔ harness** chats.
- **Shared workspace filesystem.** Many agent threads inside one workspace, all looking at the same cwd/FS. No per-thread git worktree product.
- **Worktree UI may stay only if it binds to cwd.** If a control today means “new git worktree vs current checkout,” Nero may keep a similar chrome only when it means “this workspace’s cwd,” not when it means T3’s `envMode: local | worktree` checkout factory.
- **Surfaces that must survive in some form:** thread list, thread route, composer, message timeline, approval (human-in-the-loop), search/palette for jumping between threads. Multi-provider model picker is not a product requirement.

---

## 2. T3 mental model (what the UI actually is)

T3’s chat UI is **not** “one conversation with one model.” It is:

1. **Environment** (a running T3 server / machine). Lives in the URL: `/$environmentId/$threadId`.
2. **Project** (workspace record rooted at a directory on that environment). Sidebar groups projects; drafts are keyed by *logical* project.
3. **Thread** (durable conversation + work history for a project). Server threads have messages, activities, proposed plans, checkpoints, branch, `worktreePath`, `runtimeMode`, `interactionMode`, `modelSelection`.
4. **Draft thread** (local-only, persisted in `localStorage` via Zustand). Pre-allocated `threadId` + `draftId`. First send promotes it to a server thread and the route replaces `/draft/$draftId` → `/$environmentId/$threadId`.
5. **Turn** (one user→agent cycle). Timeline mixes messages, tool work-log rows, turn-plan chips, and proposed-plan cards. Approvals and user-input questions hang off orchestration *activities*, not messages.

Identity is **scoped**: `ScopedThreadRef = { environmentId, threadId }`. Almost every store key is `environmentId:threadId`, not a bare id. Nero with one workspace can collapse environment, but copying T3 files as-is will keep that scope in routing, drafts, sidebar selection, and RPC.

Default thread modes in `apps/web/src/types.ts`:

- `DEFAULT_RUNTIME_MODE = "full-access"` (approval policy).
- `DEFAULT_INTERACTION_MODE = "default"` (plan vs build).

---

## 3. Route and selection shell

| File | Role |
|---|---|
| `/tmp/t3code-upstream/apps/web/src/router.ts` | TanStack router factory. |
| `/tmp/t3code-upstream/apps/web/src/routes/__root.tsx` | App chrome: sidebar layout, command palette, toasts, **`PlanAgentSelectionHeal`**. |
| `/tmp/t3code-upstream/apps/web/src/routes/_chat.tsx` | Auth gate + global shortcuts (`chat.new`, `chat.newLocal`, preview, Escape clears multi-select). |
| `/tmp/t3code-upstream/apps/web/src/routes/_chat.index.tsx` | `/` auto-starts a **draft** for the most recently used project. Empty = “Add project” hero. |
| `/tmp/t3code-upstream/apps/web/src/routes/_chat.$environmentId.$threadId.tsx` | Canonical thread. Resolves render/sync, mounts `ChatView`. |
| `/tmp/t3code-upstream/apps/web/src/routes/_chat.draft.$draftId.tsx` | Local draft. After promotion, waits for draft-hero transition then `replace` navigates. |
| `/tmp/t3code-upstream/apps/web/src/threadRoutes.ts` | Pure route math: server vs draft target, `loading \| ready \| missing`. |
| `/tmp/t3code-upstream/apps/web/src/threadSelectionStore.ts` | Sidebar multi-select (cmd/ctrl toggle, shift range). Not the “active thread.” |
| `/tmp/t3code-upstream/apps/web/src/threadSync.ts` | Shell vs detail: `loading` / `syncing` pills. |
| `/tmp/t3code-upstream/apps/web/src/hooks/useHandleNewThread.ts` | New-thread factory: reuse empty logical-project draft or mint; carry runtime/interaction/model; **do not** carry branch/worktree unless explicit. |
| `/tmp/t3code-upstream/apps/web/src/lib/chatThreadActions.ts` | “New thread inherits **project only**.” Worktree start-from-origin default. |

**Nero note.** Index-route “always open a draft” is good. Environment in the path is T3 remote-multi-machine. For one workspace, keep a thread id in the URL; drop or freeze `environmentId`. Draft promotion (optimistic composer before the server ack) is worth copying.

---

## 4. The god component: `ChatView`

`/tmp/t3code-upstream/apps/web/src/components/ChatView.tsx` (~7k lines) is the whole chat surface:

- Resolves **server thread vs local draft** (`buildLocalDraftThread` / `buildLoadingThreadFromShell` in `ChatView.logic.ts`).
- Derives session **phase**, timeline, pending approvals, pending user-input, proposed plan, agent panel.
- Owns send / interrupt / approval respond / user-input respond / plan follow-up / implement-in-new-thread.
- First send in `envMode === "worktree"` **creates a git worktree** before `startThreadTurn` (blocked if no base branch).
- Mounts composer, timeline, header, branch toolbar, terminal drawer, right panel (diff / files / preview / PRs / agents).

`ChatView.logic.ts` is the extractable pure layer: draft-hero, send-state, env-mode resolution, **provider lock after first turn**, “this provider requires a new thread to change models.”

**Nero note.** Keep the *shape* (route → view that binds thread + composer + timeline). Split the god file. Delete worktree-create-on-first-send. Bind cwd from the workspace, not from `thread.worktreePath`.

---

## 5. Session / timeline projection (`session-logic.ts`)

`/tmp/t3code-upstream/apps/web/src/session-logic.ts` is the read-model for one thread. No React.

**Provider catalog (T3 product):** `PROVIDER_OPTIONS` lists Codex, Claude, OpenCode, Cursor, Grok. This is the multi-provider picker’s source of truth on the web side.

**Approvals.** `derivePendingApprovals(activities)` folds:

- `approval.requested` → open `PendingApproval` (`requestKind`: `command` | `file-read` | `file-change` | `mcp-elicitation`, plus `detail`, `appName`, `options`)
- `approval.resolved` → close
- stale `provider.approval.respond.failed` → close

**User input (AskUserQuestion-style).** `derivePendingUserInputs` folds `user-input.requested` / `.resolved`. Questions: header, body, options, optional `multiSelect`.

**Plans (two different things):**

1. **Turn plan / todos** — `turn.plan.updated` activities → `ActivePlanState` / `TurnPlanEntry` (inline chip + working-row label).
2. **Proposed plan markdown** — `thread.proposedPlans[]` → `LatestProposedPlanState`. Actionable iff `implementedAt === null`. Shown only after the latest turn has settled.

**Work log.** Collapses tool/task/subagent noise so the parent timeline stays “quiet”: one spawn CTA per agent batch; agent-internal rows go to the Agents panel.

**Phase.** `derivePhase(session)` → `disconnected | connecting | ready | running`.

**Nero note.** Copy the *projector* idea (activities → pending HITL + timeline rows). Delete `PROVIDER_OPTIONS`. Keep approval + user-input folds if the harness emits equivalent events. Keep turn-plan chips if Nero has todos. Proposed-plan markdown is T3 plan-mode product; only keep if Nero has an explicit plan artifact.

Timeline render: `components/chat/MessagesTimeline.tsx` + `MessagesTimeline.logic.ts` (LegendList virtualizer, tool-group collapse, proposed-plan cards, changed-files). Markdown: `ChatMarkdown.tsx`.

---

## 6. Composer

Center of gravity: `components/chat/ChatComposer.tsx` (large), fed by:

| File | Role |
|---|---|
| `composer-logic.ts` | Enter intent, cursor vs mention/skill chips, `/plan` `/default` `/model` triggers. |
| `composerDraftStore.ts` | Persisted drafts: prompt, images, model-by-provider, runtime/interaction, **branch / worktreePath / envMode / startFromOrigin**, logical-project draft map. Storage key `t3code:composer-drafts:v1`. |
| `composerSubmission.ts` | Max input chars; send vs pending-user-input target. |
| `composerPlaceholder.ts` | Disconnected placeholder copy. |
| `ComposerPromptEditor.tsx` | Lexical editor (mentions, skills, terminal-context tokens). |
| `composerProviderState.tsx` | Provider traits / effort / ultrathink chrome; **gated on `planModeEnabled`**. |
| `ComposerPrimaryActions.tsx` | Send, stop, Next/Submit (user-input), **Implement / Refine** (plan follow-up). |
| `ComposerPendingApprovalPanel.tsx` + `ComposerPendingApprovalActions.tsx` | Approval drawer. |
| `ComposerPendingUserInputPanel.tsx` + `pendingUserInput.ts` | Multi-question wizard. |
| `ComposerPlanFollowUpBanner.tsx` + `proposedPlan.ts` | “Plan ready”; implement prompt; export filename. |
| `ProviderModelPicker.tsx` + `ModelPickerContent.tsx` + `ModelPickerSidebar.tsx` + `modelPicker*.ts` | Multi-instance model combobox. |
| `TraitsPicker.tsx` | Per-model options (effort, OpenCode **agent** including `plan`). |
| `ContextWindowMeter.tsx` | Token ring; Claude compact. |

**Runtime mode (approval policy), composer footer.** Not plan mode. Four values:

| `RuntimeMode` | UI label | Meaning |
|---|---|---|
| `approval-required` | Supervised | Ask before commands and file changes |
| `auto-accept-edits` | Auto-accept edits | Auto-approve edits, ask before other actions |
| `auto` | Auto | Some providers auto-approve routine actions |
| `full-access` | Full access | No prompts |

This is the closest T3 analogue to a **harness permission level**. It is orthogonal to which model is selected. Persist per thread; send on every turn (`ChatView` `persistThreadSettingsForNextTurn`).

**Send path coupling.** `ChatView` `onSend`:

1. If pending user-input: composer text becomes the custom answer / submit.
2. If `showPlanFollowUpPrompt` and a proposed plan exists: empty send = `PLEASE IMPLEMENT THIS PLAN:`; typed send = refine with `interactionMode: "plan"`.
3. If beta plan mode on and the prompt is exactly `/plan` or `/default`: toggle interaction mode, do not send.
4. Else first message in worktree mode may create a worktree, then `startThreadTurn`.

---

## 7. Three couplings Nero must decide

### 7.1 Approval UI

**Where it lives:** composer top drawer, not a modal. First pending approval only (`pendingApprovals[0]`). Panel shows `detail` (command / patch / path / MCP app). Actions come from the provider (`ProviderApprovalOption[]`) or defaults:

`cancel` / `decline` / `acceptForSession` (“Always allow this session”) / `accept` (“Approve”).

RPC: `respondToThreadApproval({ threadId, requestId, decision })`.

Related but distinct: **pending user input** (structured questions). Same composer drawer, different panel. Primary action becomes Next/Submit. `pendingUserInput.ts` is pure and reusable.

Settle/snooze in the sidebar is **blocked** while approvals or user-input are open (`useThreadActions`: “never hide live work”).

**Nero.** Copy panel + actions + “pending blocks settle.” Bind to the single harness permission protocol. Drop MCP-elicitation until Nero has MCP. `runtimeMode` dropdown can remain as a workspace/thread policy if the harness honors it; otherwise collapse to one policy.

### 7.2 Plan mode (legacy, beta)

Flag: `settings.planModeEnabled` (contracts default **false**). Comments in `ChatView` / `ChatComposer` / `planAgentSelectionHeal.tsx` call it **legacy**.

When **off**:

- Effective `interactionMode` is forced to `"default"` even if the thread stored `"plan"`.
- Plan/Build toggle hidden.
- `/plan` `/default` send as plain text.
- OpenCode **agent=plan** is stripped from traits (`providerModels.withoutPlanAgentOption`).
- `PlanAgentSelectionHeal` patches persisted text-generation / source-control writer selections that still say `agent: plan`.

When **on**:

- Per-thread `interactionMode: "default" | "plan"`.
- Toggle in composer footer (and slash commands).
- After a settled turn with an unimplemented `proposedPlan`: composer shows “Plan ready”, send becomes Implement / Refine, overflow “Implement in a new thread” (`onImplementPlanInNewThread` creates a **second thread** with `interactionMode: "default"`, same branch/**worktreePath**, `sourceProposedPlan` pointer).
- `ProposedPlanCard` in the timeline: collapse, copy, download, **save into workspace**.

This is **not** the same as turn-plan/todo chips (`turn.plan.updated`), which render even when plan mode is off.

**Nero.** Do not copy beta plan mode, OpenCode agent heal, implement-in-new-thread, or `/plan` slash unless Nero’s harness has a first-class plan artifact. If Nero wants “plan then implement,” do it as harness interaction state on **the same thread** (shared FS — no second worktree). Keep todo chips if the harness streams a plan/todo list.

### 7.3 Multi-provider model picker

Deeply coupled. Do not treat as a themeable dropdown.

Stack:

- Wire: `ServerProvider[]` **per configured instance** (`codex`, `codex_personal`, …), not per driver. Documented in `providerInstances.ts`.
- Catalog: `session-logic.PROVIDER_OPTIONS` + `providerModels.ts` + `modelSelection.ts` + `modelOrdering.ts`.
- Picker UI: `ProviderModelPicker` → sidebar of instances + virtualized model list, search, jump keys (`modelPicker.jump.1`…), locked-provider header.
- Lock: after the first turn, `deriveLockedProvider` freezes **driver kind**. Continuation `groupKey` can further lock. Some providers set `requiresNewThreadForModelChange`.
- Sticky model: composer draft `modelSelectionByProvider` + sticky instance; new threads prefer **project default**, else carried selection.
- Traits: effort / thinking / OpenCode agent; `planModeEnabled` filters the agent list.
- Same picker is reused in **Settings → project default model** (`ProjectSettingsPanel.tsx`).
- `modelPickerVisibility.ts` is DOM-query based (`[data-model-picker-content]`) so keybindings know the popover is open — no extra store.

**Nero.** Replace with a **single-harness model list** (or hide if Pi has one model). Delete instance sidebar, driver lock, continuation groups, `PROVIDER_OPTIONS`, `NO_PROVIDER_MODEL_SELECTION` hack, per-provider sticky maps. Keep: disabled-reason toast, optional “new thread to change model” if the harness session is sticky, settings default model.

---

## 8. Sidebar, command palette, search

**Sidebar** (`components/Sidebar.tsx`, `LegacySidebar.tsx`, `Sidebar.logic.ts`, `Sidebar.snooze.ts`, `components/sidebar/*`):

- Projects grouped by `logicalProject.ts` (re-exports `client-runtime` project-grouping). One logical project can span local + remote + WSL members.
- Threads: pin, settle, snooze, archive, delete, unread, rename, regenerate title, jump keys, prewarm 3 visible thread details (`SIDEBAR_THREAD_PREWARM_LIMIT`).
- Rows show **worktree indicator** (`ThreadStatusIndicators` / `formatWorktreePathForDisplay`).
- Delete may **remove an orphaned git worktree** (`worktreeCleanup.ts` + `useThreadActions`).
- `threadActionMenu.logic.ts` is shared by sidebar context menu and chat header.

**Command palette** (`CommandPalette.tsx` + `.logic.ts` + `Content` + `Results` + `commandPaletteBus.ts`):

- One overlay, three modes: command (⌘K), files (⌘P), content (⇧⌘F).
- Intents: `add-project`, `new-thread-in` (used when >1 project group).
- Thread search, recent threads, theme, settings, clone/add project.

**Project content search:** `components/search/ProjectContentSearchDialog.tsx`, `HighlightedSearchLine.tsx`.

**Nero.** Copy thread list + multi-select + palette jump. Delete environment/cloud chrome, worktree row glyphs (or retarget to cwd basename), add-project/clone if Nero workspaces are created elsewhere. Logical-project grouping is T3-multi-env; one workspace ≈ one project.

---

## 9. Worktree vs cwd (the product cut)

T3 threads carry `branch`, `worktreePath`, `envMode: "local" | "worktree"`, `startFromOrigin`.

UI that **is** the worktree product:

- `BranchToolbar.tsx` + `BranchToolbar*.tsx` + `BranchToolbar.logic.ts` — Current checkout vs New worktree vs Previous worktree; environment picker; origin toggle.
- `ChatView` first-send worktree create; `resolveSendEnvMode` falls back to `local` if not a git repo.
- `worktreeCleanup.ts` — orphan path on delete.
- `ChatView.logic.resolveThreadMetadataUpdateForNextTurn` — changing branch **clears `worktreePath`**.
- Sidebar `ThreadWorktreeIndicator`.

UI that can stay if it **binds to cwd**:

- Header breadcrumb / project title / favicon (`ChatHeader.tsx`, `WorkspaceBreadcrumb.tsx`, `ProjectFavicon.tsx`).
- `@` path search (`composerPathSearchState.ts`) — already cwd-relative (`gitCwd`).
- “Open in editor” (`OpenInPicker.tsx`, `remoteOpen.ts`).
- Proposed-plan “save to workspace” (`ProposedPlanCard` `writeFile` at `workspaceRoot`).
- Diff / files right panel — if they read the shared tree, not a thread worktree.

**Nero default:** every thread’s workspace root = workspace cwd. Drop `envMode`, `startFromOrigin`, `worktreePath`, previous-worktree, delete-worktree. Branch toolbar can shrink to “git branch of this workspace” (shared), not per-thread checkout.

---

## 10. Orphan modules (named in the brief, unused in web)

These files exist under `apps/web/src` and **nothing else imports them** (no tests either):

| File | What it is | Nero |
|---|---|---|
| `orchestrationEventEffects.ts` | Fold orchestration events → promote drafts, clear deleted, drop terminal UI, invalidate providers | Logic belongs next to the WS subscriber (likely `client-runtime` / server). Do not copy into UI. |
| `orchestrationRecovery.ts` | Sequence-gap snapshot/replay coordinator | Same — transport recovery, not chat UI. |
| `historyBootstrap.ts` | Pack prior messages + latest prompt into a char-budgeted transcript for a *new* provider session | Useful if Nero restarts a harness with a transcript prefix. Keep as a lib, not a React module. |

`logicalProject.ts` is a one-line re-export of client-runtime grouping. Keep the import path if grouping stays; otherwise delete the barrel.

---

## 11. File-level copy / adapt / delete

Legend: **C** copy with light rename, **A** adapt (keep structure, rebind), **D** delete or do not take, **S** settings/entry-point only.

### Routing and identity

| Path | Verdict | Why |
|---|---|---|
| `threadRoutes.ts` (+ test) | **A** | Keep draft vs server vs missing. Drop `environmentId` if Nero is single-workspace. |
| `threadSelectionStore.ts` | **C** | Multi-select is generic. |
| `threadSync.ts` | **A** | Keep if thread detail streams in two phases. |
| `routes/_chat*.tsx` | **A** | Keep layout + draft + thread. Collapse env param; drop hosted-static onboarding. |
| `routes/__root.tsx` | **A** | Keep palette/sidebar hosts. **D** `PlanAgentSelectionHeal`. |
| `router.ts` | **C** | |
| `hooks/useHandleNewThread.ts` | **A** | Reuse-empty-draft is good. Strip worktree options and logical-project remap if one project. |
| `lib/chatThreadActions.ts` | **A** | Keep “inherit project only.” Delete worktree `startFromOrigin`. |

### Session / send / HITL

| Path | Verdict | Why |
|---|---|---|
| `session-logic.ts` (+ tests) | **A** | Keep timeline/approval/user-input/phase. **D** `PROVIDER_OPTIONS`. Trim subagent fold if Nero has no subagents. |
| `pendingUserInput.ts` | **C** | Pure; harness-agnostic if questions match. |
| `proposedPlan.ts` (+ test) | **D** unless Nero has plan artifacts | Implement-prompt + export helpers are plan-mode product. |
| `planAgentSelectionHeal.tsx` | **D** | OpenCode `agent=plan` heal. |
| `components/chat/ComposerPendingApproval*.tsx` | **A** | Bind to Nero permission RPC. Drop MCP labels if unused. |
| `components/chat/ComposerPendingUserInputPanel.tsx` | **A** | |
| `components/chat/ComposerPlanFollowUpBanner.tsx` | **D** | Plan-mode chrome. |
| `components/chat/ProposedPlanCard.tsx` | **D** / **A** | Only if Nero stores markdown plans. Save-to-cwd is fine. |
| `components/chat/ComposerPrimaryActions.tsx` | **A** | Keep send/stop/HITL. **D** Implement/Refine split. |
| `worktreeCleanup.ts` | **D** | |

### Composer core

| Path | Verdict | Why |
|---|---|---|
| `components/chat/ChatComposer.tsx` | **A** | Extract; strip provider instance maps, plan toggle, worktree-adjacent disable reasons. |
| `composer-logic.ts` | **A** | Keep chips/enter. `/plan` `/default` only if plan mode exists. `/model` can open a simple list. |
| `composerDraftStore.ts` | **A** | Keep prompt persistence. **D** `envMode` / `worktreePath` / `startFromOrigin` / per-provider sticky. One model field. |
| `composerSubmission.ts` | **C** | |
| `composerPlaceholder.ts` | **C** | |
| `ComposerPromptEditor.tsx` + `composer-editor-mentions.ts` | **A** | Mentions `@file` stay (shared FS). Skills/slash if harness has them. |
| `components/chat/composerSubmission.ts` | **C** | |
| `composerFooterLayout.ts` | **C** | Compact footer math. |
| `components/chat/ComposerControl.tsx` | **C** | Shared button chrome. |
| `components/chat/ComposerBannerStack.tsx` | **C** | |
| `components/chat/ComposerCommandMenu.tsx` | **A** | Path/slash menus. |
| `components/chat/composerSlashCommandSearch.ts` | **A** | |
| `components/chat/workspaceFileDrop.ts` | **C** | |
| `components/chat/composerMentionDrag.ts` | **C** | |
| `promptStashStore.ts` + `ComposerStash*` | **C** optional | Nice-to-have, not coupled. |
| `lib/terminalContext.ts` + pending terminal chips | **A** | Keep if Nero terminals exist. |
| `lib/elementContext.ts` + preview annotation cards | **D** unless Nero has in-app preview. |
| `reviewCommentContext.ts` + pending review comments | **D** unless Nero has PR review. |
| `lib/attachmentUpload*` + image compression | **A** | If harness accepts images. |
| `components/chat/ContextWindowMeter*` | **A** optional | If harness reports context. Compact is Claude-specific — **D** or rebind. |
| `components/chat/ComposerTasksBadge.tsx` | **A** | Bind to turn-plan steps if kept. |

### Model picker / providers

| Path | Verdict | Why |
|---|---|---|
| `components/chat/ProviderModelPicker.tsx` | **D** / replace | Too instance-shaped. |
| `components/chat/ModelPickerContent.tsx` | **D** / replace | |
| `components/chat/ModelPickerSidebar.tsx` | **D** | Multi-instance. |
| `components/chat/ModelListRow.tsx` | **A** | Reuse row chrome in a simple list. |
| `components/chat/modelPickerKeys.ts` | **D** | |
| `components/chat/modelPickerSearch.ts` | **A** | Search scoring is generic. |
| `components/chat/modelPickerModelHighlights.ts` | **D** | “New” badges per T3 provider launch. |
| `modelPickerVisibility.ts` | **A** | DOM-open trick is fine for any popover. |
| `modelSelection.ts` | **D** / rewrite | Instance + custom-model + plan-agent heal. |
| `modelOrdering.ts` | **A** | If Nero has a user order. |
| `providerModels.ts` | **D** | Driver snapshots + plan-agent filter. |
| `providerInstances.ts` | **D** | Multi-instance core. |
| `components/chat/composerProviderState.tsx` | **D** / rewrite | Traits + ultrathink + planMode. |
| `components/chat/TraitsPicker.tsx` | **A** | Keep if harness has effort/thinking; strip `plan` agent. |
| `components/chat/providerIconUtils.ts` + `ProviderInstanceIcon.tsx` + `PierreEntryIcon.tsx` | **A** / **D** | Icons only. |
| `providerSkillSearch.ts` | **A** | If slash skills exist. |
| `session-logic.ts` `PROVIDER_OPTIONS` | **D** | |

### Chat view / timeline / chrome

| Path | Verdict | Why |
|---|---|---|
| `components/ChatView.tsx` | **A** | Must be split. Remove worktree-create, plan follow-up, provider lock, PR/preview/agents unless Nero has them. |
| `components/ChatView.logic.ts` | **A** | Keep send-state, draft-hero, threadHasStarted. **D** locked-provider / requiresNewThread unless harness needs it. |
| `components/chat/MessagesTimeline.tsx` + `.logic.ts` | **A** | Keep virtualizer + tool groups. **D** proposed-plan rows if unused. |
| `components/chat/timelineScrollAnchoring.ts` | **C** | |
| `components/chat/changedFilesPresentation.ts` + `ChangedFilesTree.tsx` | **A** | Shared FS diffs. |
| `components/chat/ChatHeader.tsx` | **A** | Title, scripts, open-in. |
| `components/chat/ThreadErrorBanner.tsx` + `ProviderStatusBanner.tsx` + `ThreadSyncStatusPill.tsx` | **C** | |
| `components/chat/DraftHeroHeadline.tsx` + `draftHeroTransition.ts` | **C** | Empty-draft landing. |
| `components/NoActiveThreadState.tsx` | **C** | Rare if index always drafts. |
| `components/ChatMarkdown.tsx` | **C** | |
| `components/BranchToolbar*` | **D** / **A** | Only if it becomes “cwd + shared branch.” |
| `components/ThreadTerminalDrawer.tsx` | **A** | If Nero has per-thread terminals on shared FS. |
| `components/RightPanelTabs.tsx` + `rightPanelStore.ts` | **A** | Keep files/diff; **D** PR/preview unless needed. |
| `components/AgentsPanel.tsx` | **D** unless Nero has subagents. |
| `components/DiffPanel*.tsx` `components/diffs/` | **A** | |
| `historyBootstrap.ts` | **A** as a lib | Unused today; transcript packing is harness-useful. |
| `orchestrationEventEffects.ts` | **D** from UI | Move next to event bus. |
| `orchestrationRecovery.ts` | **D** from UI | Transport. |

### Sidebar / palette / search

| Path | Verdict | Why |
|---|---|---|
| `components/Sidebar.tsx` + `Sidebar.logic.ts` + `Sidebar.snooze.ts` | **A** | Drop env grouping, worktree glyphs, cloud/WSL icons. |
| `components/LegacySidebar.tsx` | **D** | Dual sidebar is T3 migration. |
| `components/sidebar/*` | **A** / **D** | Chrome yes; provider-update pills no. |
| `components/threadActionMenu.logic.ts` | **A** | Drop new-thread-on-branch if no per-thread branch. |
| `components/ThreadStatusIndicators.tsx` | **A** | Keep running/unread; **D** PR + worktree. |
| `hooks/useThreadActions.ts` | **A** | Delete-worktree path **D**. |
| `threadSidebarWidth.ts` | **C** | |
| `logicalProject.ts` + `sidebarProjectGrouping.ts` + `environmentGrouping.ts` | **D** if one project | |
| `lib/threadSort.ts` | **C** | |
| `commandPaletteBus.ts` | **C** | |
| `components/CommandPalette*.tsx` + `.logic.ts` | **A** | Drop add-project/clone/environment if out of scope. Keep thread search. |
| `components/search/*` | **A** | Content search against shared cwd. |
| `keybindings.ts` `modelPicker.*` / `thread.jump.*` / `chat.new` | **A** | Keep jumps/new; rebind model picker. |

### Stores the chat surface depends on (not all chat-specific)

Keep as dependencies, don’t treat as “chat product”: `uiStateStore.ts`, `diffPanelStore.ts`, `rightPanelStore.ts`, `previewStateStore.ts`, `terminalUiStateStore.ts`, `composerDraftStore.ts`, `state/entities.ts` (thread shells/details).

---

## 12. Suggested Nero binding (smallest unsurprising model)

- **URL:** `/` opens or reuses the empty draft; `/t/:threadId` is a harness chat. No environment segment.
- **Thread record:** id, title, messages, activities, `permissionMode` (map from T3 `runtimeMode` if the harness has one), optional model id. **No** `worktreePath`, **no** `interactionMode`.
- **Cwd:** workspace root for every thread. Path mentions, diffs, save-plan, terminals all use it.
- **Composer:** Lexical (or simpler) + send/stop + approval drawer + optional user-input wizard + `@` files.
- **Model:** one list or none. No instance sidebar. No driver lock unless the harness session is actually sticky.
- **Plan:** omit T3 beta plan mode. If the harness can enter a plan/ask loop, that’s permission/interaction on the **same** thread, same FS.
- **Worktree chrome:** omit. If a “workspace” switcher is needed later, it switches Nero workspaces, not git worktrees.

---

## 13. Entry points T3 already has (don’t only fix ChatView)

Same behavior is reachable from:

- Chat composer (model, runtime, plan, send, approvals)
- Sidebar (new thread, jump, settle, delete, worktree indicator)
- Command palette (`new-thread-in`, thread search, add project)
- Keybindings (`chat.new`, `modelPicker.toggle`, thread jumps)
- Settings (project default model + traits; Beta `planModeEnabled`)
- Header thread action menu (same as sidebar)

A Nero port that only restyles `ChatComposer` will miss new-thread, draft reuse, and HITL blocking settle.
