# 05 — Files, diffs, review, git (T3 web → Nero)

Primary source: `/tmp/t3code-upstream/apps/web/src`. No Nero UI was consulted; Nero has no prior T3 chrome here. Decisions are copy / adapt / delete at file granularity.

Locked Nero facts this map serves:

- **File manager, commit diffs, artifacts stay.** Do not drop T3’s explorer, file preview, or git-diff surfaces because Nero already has cousins — copy the T3 UX onto Nero’s cwd, or keep Nero’s and steal only the logic that is better.
- **GitHub PR inbox may stay.** It is a client over typed RPC (`pullRequests.*`). Nero can reimplement that RPC against `gh` in the workspace. Do not delete the inbox because the host is different.
- **Worktrees are a T3 feature.** Nero’s default is a **shared filesystem, cwd-only**. Every thread, file query, git status, and PR checkout sees the same `workspaceRoot`. T3 chrome that says “New worktree / Current checkout / Previous worktree” **lies** if you leave it up. Adapt to cwd-only or delete the chrome.

`cwd` in T3 is already `thread.worktreePath ?? project.workspaceRoot` (`hooks/useActiveProjectTarget.ts`, `DiffPanel.tsx`). Nero’s adapter is: **always `project.workspaceRoot`**, never a per-thread path.

---

## 1. What T3 actually built

Four product surfaces share Pierre (`@pierre/trees`, `@pierre/diffs`) and a cwd:

| Surface | What the user sees | Data |
| --- | --- | --- |
| Files | Right-panel tree + preview/editor | `project.listEntries` / `readFile` / `writeFile` against **cwd** |
| Diff | Right-panel git/turn/unstaged diffs + inline review comments for the **agent** | `review.diffFileContents`, VCS status, thread checkpoints |
| Review (agent) | Line comments on files/diffs → composer `<review_comment>` XML | local, not GitHub |
| Review (host) | GitHub/GitLab/… PR inbox, detail, code tab, submit review | `pullRequests.*` RPC |
| Git | Branch toolbar, commit/push/PR stacked actions, publish repo | `vcs.*` / `git.*` / `sourceControl.*` |

Artifacts: T3 has **no artifacts panel** in this tree. Workspace files, thread-scoped image assets (`state/assets.ts`), and desktop preview recordings are adjacent. Nero’s artifacts stay; do not invent T3 chrome for them.

---

## 2. Worktrees → cwd-only (do this first)

T3 isolation model:

- Draft/thread `envMode`: `"local" | "worktree"` (`BranchToolbar.logic.ts`, `composerDraftStore.ts`).
- `"New worktree"` creates a git worktree; agent cwd becomes `worktreePath`. Temporary branches are `t3code/<8 hex>` (`packages/shared/src/git.ts`).
- `"Previous worktree"` hops to the latest other thread’s path.
- `"Start from origin"` only applies to new worktrees (`lib/chatThreadActions.ts`).
- Thread delete can `vcs.removeWorktree` if no other thread shares the path (`worktreeCleanup.ts`, `hooks/useThreadActions.ts`).
- `git.preparePullRequestThread` can materialize a PR as **local checkout or worktree** (`PullRequestThreadDialog.tsx`, contracts `GitPreparePullRequestThreadResult.worktreePath`).

Nero shared-FS model:

- One disk, one checkout. Branch switch is **global** (every thread sees it).
- File manager / diffs / git status all take that cwd.
- PR checkout is `gh pr checkout` (or equivalent) **in that cwd**, or refuse if dirty — never `git worktree add`.

### Chrome that would lie if copied

Delete or gut these, do not restyle them:

| T3 label | File | Nero |
| --- | --- | --- |
| New worktree / Current checkout / Current worktree / Local checkout | `components/BranchToolbarEnvModeSelector.tsx`, `BranchToolbar.logic.ts` (`EnvMode`, `resolveEnvModeLabel`, `resolvePreviousWorktree*`) | **Delete** selector. Branch picker stays. |
| Previous worktree | same + `BranchToolbar.tsx` mobile run-context | **Delete** |
| Start from origin | `BranchToolbar.tsx` prop, draft store, Settings | **Delete** |
| Default thread env mode “New worktree” | `components/settings/SettingsPanels.tsx` (~2242), `ProjectSettingsPanel.tsx` (~897) | **Delete** rows |
| Worktree glyph / basename in sidebar | `ThreadStatusIndicators.tsx` (`formatWorktreePathForDisplay`) | **Delete** glyph. Keep PR + terminal pills. |
| “Delete the worktree too?” | `hooks/useThreadActions.ts` | **Delete** the confirm + `removeWorktree` call |
| Prepare PR as worktree | `PullRequestThreadDialog.tsx` `preparingMode: "local" \| "worktree"` | **Adapt**: one action, cwd checkout, or open-only |

`cwd` plumbing in files/diffs/git **copy**, then pin cwd to workspace root in one helper (Nero `useActiveProjectTarget`).

If Nero later wants isolation, that is a **new** product (container, branch lock, or explicit worktree) — not leftover T3 labels.

---

## 3. File-level ledger

Legend: **C** copy · **A** adapt (cwd-only / `gh` RPC / drop T3 env) · **D** delete · **K** Nero already owns this; steal logic only if T3 is better.

Tests travel with the module unless noted.

### 3.1 File manager (keep)

T3 already keys the tree on `cwd`. After the worktree cut, this is Nero’s file manager.

| Path | Decision | Notes |
| --- | --- | --- |
| `components/files/FileBrowserPanel.tsx` | **C/A** | Pierre tree, search, refresh, context menu, drag-to-mention. Adapt: `cwd` = workspace root; drop T3 localApi reveal if Nero has its own. |
| `components/files/FilePreviewPanel.tsx` | **C/A** | Editor + markdown/image preview + line reveal + file comments into composer. Adapt: asset URLs / `openFileInPreview` / OpenInPicker to Nero hosts. |
| `components/files/filePath.ts` | **C** | Breadcrumbs. |
| `components/files/filePath.test.ts` | **C** | |
| `components/files/filePreviewMode.ts` | **C** | Markdown checkbox toggle. |
| `components/files/fileContentRevision.ts` | **C** | Cache keys include `cwd` — still correct if cwd is the workspace. |
| `components/files/fileContentRevision.test.ts` | **C** | |
| `components/files/fileSaveCoordinator.ts` | **C** | Debounced write. |
| `components/files/fileSaveCoordinator.test.ts` | **C** | |
| `components/files/fileLineReveal.ts` | **C** | |
| `components/files/fileLineReveal.test.ts` | **C** | |
| `components/files/fileEditorDismissal.ts` | **C** | Pierre shadow-DOM blur. |
| `components/files/fileCommentAnnotations.ts` | **C** | Agent line comments on **files**, not GitHub. Keep if Nero chat can take review chips. |
| `components/files/fileTreeDragMention.ts` | **A** | Keep if Nero composer has `@file` drag. Else **D**. |
| `components/files/fileTreeDragMention.test.ts` | same | |
| `components/files/projectFilesQueryState.ts` | **A** | Wires `projectEnvironment.listEntries/readFile`. Rebind atoms to Nero FS RPC. |
| `components/files/projectFilesQueryState.test.ts` | **A** | |
| `components/files/ProjectFilePicker.tsx` | **C/A** | Command-palette file open. |
| `components/files/ProjectFilePicker.logic.ts` | **C** | Fuzzy highlight. |
| `components/files/ProjectFilePicker.logic.test.ts` | **C** | |
| `components/search/ProjectContentSearchDialog.tsx` | **C/A** | Content search → `openFile(path, line)`. Rebind query. |
| `components/search/HighlightedSearchLine.tsx` | **C** | |
| `workspaceBasenameLookup.ts` | **C** | Bare `` `ChatView.tsx` `` in markdown → unique file. Used by `ChatMarkdown.tsx`. |
| `workspaceBasenameLookup.test.ts` | **C** | |
| `filePathDisplay.ts` | **C** | Strip workspace root for display. |
| `filePathDisplay.test.ts` | **C** | |
| `hooks/useActiveProjectTarget.ts` | **A** | **The cwd adapter.** Change `thread?.worktreePath ?? project?.workspaceRoot` → `project.workspaceRoot` only. |
| `state/filesystem.ts` | **A** | Thin atom factory. Rebind or replace with Nero FS. |
| `state/assets.ts` | **A** | Workspace image preview. Keep if Nero serves workspace bytes. |
| `pierre-icons.ts` (+ test) | **C** | File-type icons. |
| `components/chat/PierreEntryIcon.tsx` | **C** | |
| `components/preview/fileExplorerLabel.ts` | **A** | “Reveal in Finder/Explorer” copy. OS labels are reusable; T3 `FileManagerRevealKind` is host-specific. |
| `browser/openFileInPreview.ts` | **D** unless Nero has in-app browser preview | Out of this map’s keep list. |
| `rightPanelStore.ts` kinds `"files"` / `"file"` | **C/A** | File tabs. Drop T3 `t3code:` persist key; keep the surface model. |
| `components/RightPanelTabs.tsx` files launcher | **A** | Keep Files card. Drop T3-only disabled reasons that mention desktop/worktrees. |

Nero already has a file manager: **K** the panel shell if it is good; still **C** Pierre tree + save/reveal/comment logic if Nero’s is a stub.

### 3.2 Commit / turn diffs (keep)

Diff panel modes (`diffPanelStore.ts`): `branch` (vs base ref), `unstaged`, `turn` (checkpoint). Nero keeps **commit diffs**; turn diffs are T3-orchestration. Keep turn mode only if Nero has per-turn snapshots; otherwise **A** to commit + working tree only.

| Path | Decision | Notes |
| --- | --- | --- |
| `components/DiffPanel.tsx` | **A** | `activeCwd = worktreePath ?? workspaceRoot` → workspace root. `repositoryIdentity.rootPath` still useful if cwd is a subfolder (usually not on Nero). Keep base-ref combobox, split/stack, whitespace, wrap. |
| `components/DiffPanelShell.tsx` | **A** | Drop Electron `drag-region` if Nero is not that shell. |
| `components/DiffWorkerPoolProvider.tsx` | **C** | Pierre worker + theme. |
| `components/diffs/AnnotatableCodeView.tsx` | **C** | Line-range → agent review comments. |
| `components/diffs/AnnotatableCodeView.test.tsx` | **C** | |
| `components/diffs/DiffCommentAnnotation.tsx` | **C** | |
| `components/diffs/DiffCommentAnnotation.test.tsx` | **C** | |
| `components/diffs/StyledDiffCodeView.tsx` | **C** | |
| `components/diffs/StyledDiffCodeView.test.tsx` | **C** | |
| `components/diffs/commentSubmitShortcut.ts` | **C** | |
| `components/diffs/commentSubmitShortcut.test.ts` | **C** | |
| `diffPanelStore.ts` | **A** | Keep selection model. Turn kind optional. |
| `diffPanelStore.test.ts` | **A** | |
| `diffFileActions.ts` | **A** | Open diff path in file tab. Worktree-vs-repo relative path math: keep if Nero ever has cwd ≠ repo root; else simplify. |
| `diffFileActions.test.ts` | **A** | Has an explicit “separate worktree” case — rewrite to cwd-only. |
| `lib/diffRendering.ts` (+ test) | **C** | Theme, patch, stats. |
| `lib/diffCollapse.ts` (+ test) | **C** | |
| `lib/diffFileContents.ts` (+ test) | **A** | Git loader → Nero git RPC. PR loader stays with inbox. |
| `lib/baseRefChoices.ts` (+ test) | **C** | |
| `lib/checkpointDiffState.ts` | **A** or **D** | Turn diffs. **D** if Nero has no checkpoints. |
| `hooks/useTurnDiffSummaries.ts` | **A** or **D** | Reads `thread.checkpoints`. |
| `lib/turnDiffTree.ts` (+ test) | **C** if turn/changed-files stay | Pure path tree. |
| `components/chat/ChangedFilesTree.tsx` (+ test) | **A** | Transcript changed-files. Keep if Nero shows turn files. |
| `components/chat/changedFilesPresentation.ts` (+ test) | same | |
| `components/chat/DiffStatLabel.tsx` | **C** | |
| `state/review.ts` | **A** | `review.diffFileContents` atoms. |
| `rightPanelStore.ts` kind `"diff"` | **C** | Singleton diff tab. |

### 3.3 Agent review comments (keep, not GitHub)

These are **prompt context**, not `gh pr review`.

| Path | Decision | Notes |
| --- | --- | --- |
| `reviewCommentContext.ts` | **C** | Parse/serialize `<review_comment>`. |
| `reviewCommentContext.test.ts` | **C** | Includes path-injection guard. |
| `components/chat/ComposerPendingReviewComments.tsx` (+ test) | **C** | Chips on composer. |

### 3.4 Git UI (keep actions; strip worktree)

| Path | Decision | Notes |
| --- | --- | --- |
| `components/GitActionsControl.tsx` | **A** | Commit / push / create-PR / pull / publish / view-PR. `gitCwd` = workspace root. Quick action that creates a feature branch on default-branch confirm: **keep** (branch, not worktree). Multi-host publish (GitLab/Bitbucket/Azure): **D** those providers if Nero is `gh`-only; keep GitHub publish or replace with `gh repo create`. |
| `components/GitActionsControl.logic.ts` (+ test) | **A** | `isTemporaryWorktreeBranch` (`t3code/…`) — **D** that branch class. Feature-branch confirm copy: keep. Terminology helper: GitHub-only can hardcode “Pull request”. |
| `components/BranchToolbar.tsx` | **A** | Keep branch + (optional) environment. **D** env-mode selector and start-from-origin. Warn in copy that checkout is shared. |
| `components/BranchToolbar.logic.ts` (+ test) | **A** | **D** `EnvMode` and previous-worktree helpers. **C** remote/local branch pairing, PR branch resolution, sanitize ref names. |
| `components/BranchToolbarBranchSelector.tsx` | **A** | Paginated refs, create branch, paste PR ref. Checkout hits **shared** cwd — surface dirty-tree failure honestly. “Checkout PR” should not spawn a worktree. |
| `components/BranchToolbarEnvModeSelector.tsx` | **D** | Entire file is worktree chrome. |
| `components/BranchToolbarEnvironmentSelector.tsx` | **D** unless Nero has multi-machine | T3 environments ≠ Nero workspaces. |
| `sourceControlPresentation.ts` | **A** | If GitHub-only, collapse to GitHub icon + “Pull request”. Else **C**. |
| `lib/sourceControlActions.ts` | **A** | Re-export. |
| `state/sourceControlActions.ts` | **A** | `preparePullRequestThread` mode `"worktree"`: **D**. Keep `runStackedAction`, pull, init, publish if Nero wants in-app git. |
| `state/git.ts` | **A** | Atom factory. |
| `state/vcs.ts` | **A** | Status, refs, pull, removeWorktree — **D** create/remove worktree commands from the client. |
| `state/sourceControl.ts` | **A** | Discovery / publish. |
| `state/paginatedBranches.ts` (+ test) | **C** | |
| `lib/openPullRequestLink.ts` (+ test) | **A** | GitHub URL builder is useful even when API is down. |
| `pullRequestReference.ts` (+ test) | **C** | Parses `#42`, URLs, `gh pr checkout 42`. Perfect for Nero `gh`. |
| `components/PullRequestThreadDialog.tsx` | **A** | One checkout button; no local-vs-worktree. Failure = dirty shared tree. |
| `routes/settings.source-control.tsx` | **A** | |
| `components/settings/SourceControlSettings.tsx` | **A** | Discovery of `gh`/`git`. **D** GitLab/Azure/Bitbucket/jj rows if unused. |
| `components/settings/SourceControlWritingSettings.tsx` | **A** | Commit/PR title LLM style. Keep if Nero auto-writes those; else **D**. |
| `components/ThreadStatusIndicators.tsx` (+ tests) | **A** | Keep PR status. **D** worktree path icon. |
| `hooks/useThreadActionMenu.ts` | **A** | “Copy path” fallback already uses `projectCwd`. **D** copy-worktree-path if present. |
| `hooks/useThreadActions.ts` | **A** | **D** orphaned-worktree confirm/remove. |
| `worktreeCleanup.ts` | **D** | |
| `worktreeCleanup.test.ts` | **D** | |
| `packages/shared/src/git.ts` (imported, not under web/src) | **A** | Keep sanitize/feature-branch. **D** `WORKTREE_BRANCH_PREFIX` / `buildTemporaryWorktreeBranchName` for Nero. |

Do **not** copy T3 “stacked commit+push+PR with generated body” blindly if Nero prefers `git` + `gh` in the terminal. The **status-aware button** (`resolveQuickAction`) is worth stealing even if the runner is `gh`.

### 3.5 GitHub PR inbox (keep unless you reject host review)

This is a large, self-contained app over `packages/contracts/src/rpc.ts` `pullRequests.*`. Nero backend: implement the same shapes with `gh api` / `gh pr` in the workspace. UI can stay.

Route: `routes/_chat.pull-requests.tsx` — list + filters + shared right panel.

| Path | Decision | Notes |
| --- | --- | --- |
| `routes/_chat.pull-requests.tsx` | **A** | Drop multi-**environment** fan-out (T3 machines). Keep involvement/state/host/repo filters. Host filter can be GitHub-only. |
| `state/pullRequests.ts` | **A** | `createMergedEnvironmentQuery` is T3 multi-server. Nero: one workspace, one `gh` auth. Simplify to a single list atom. |
| `components/pullRequest/pullRequestList.logic.ts` (+ test) | **A** | Viewer-keyed grouping (`environmentId + host`) → one viewer. Keep query parse, involvement groups, snapshot. |
| `components/pullRequest/pullRequestProjectAssignment.logic.ts` (+ test) | **D** or **A** | Assigns PRs to T3 projects across environments. Nero: match `owner/repo` to workspace remote. |
| `components/pullRequest/PullRequestRow.tsx` | **C** | |
| `components/pullRequest/PullRequestListFilters.tsx` (+ test) | **A** | |
| `components/pullRequest/PullRequestListEmptyState.tsx` (+ test) | **C** | |
| `components/pullRequest/PullRequestsUnavailableState.tsx` (+ test) | **A** | Copy: `gh` not authenticated, not a GitHub repo — not “environment lacks pullRequests capability”. |
| `components/pullRequest/PullRequestGhosts.tsx` | **C** | Skeletons. |
| `components/pullRequest/PullRequestDetailPanel.tsx` | **A** | “New thread on this PR” currently prepares a worktree/checkout. Nero: switch shared branch or refuse. Keep open-in-browser, merge, close, edit. |
| `components/pullRequest/pullRequestDetail.logic.ts` (+ test) | **C** | |
| `components/pullRequest/PullRequestSummaryTab.tsx` | **C** | |
| `components/pullRequest/pullRequestSummaryScroll.logic.ts` (+ test) | **C** | |
| `components/pullRequest/PullRequestTimelineTab.tsx` | **C** | |
| `components/pullRequest/PullRequestActivityUnavailableState.tsx` | **C** | |
| `components/pullRequest/PullRequestCodeTab.tsx` | **C/A** | Host diff + review threads. Rebind file-content RPC. |
| `components/pullRequest/pullRequestDiff.logic.ts` (+ test) | **C** | Fold/hunk membership. |
| `components/pullRequest/pullRequestFileOrder.logic.ts` (+ test) | **C** | |
| `components/pullRequest/PullRequestReviewAnnotation.tsx` | **C** | |
| `components/pullRequest/PullRequestReviewBar.tsx` | **C** | Comment / approve / request-changes → `pullRequests.submitReview`. |
| `components/pullRequest/pullRequestReviewStore.ts` (+ test) | **C** | In-tab draft; intentionally not persisted. |
| `components/pullRequest/PullRequestReviewerPicker.tsx` | **C** | `reviewerCandidates` / `requestReviewers`. |
| `components/pullRequest/pullRequestEditing.logic.ts` (+ test) | **C** | Who can edit comments. |
| `components/pullRequest/PullRequestMarkdown.tsx` | **C** | |
| `components/pullRequest/PullRequestMarkdownEditor.tsx` | **C** | |
| `components/pullRequest/pullRequestMarkdown.logic.ts` (+ test) | **C** | |
| `components/pullRequest/PullRequestReactions.tsx` | **C** | |
| `components/pullRequest/pullRequestReactions.logic.ts` (+ test) | **C** | |
| `components/pullRequest/pullRequestPresentation.tsx` | **C** | State/check glyphs; keep in sync with thread PR badge. |
| `components/pullRequest/PullRequestChecksPopover.tsx` | **C** | |
| `components/pullRequest/pullRequestChecks.test.tsx` | **C** | |
| `components/pullRequest/pullRequestLinkContextMenu.ts` (+ test) | **A** | |
| `rightPanelStore.ts` kind `"pull-request"` | **C** | Multi-tab PRs. v11 already avoids persisting the inbox panel. |
| `components/RightPanelTabs.tsx` PR launcher | **A** | “No PR on this branch” is still true on shared cwd. |

GitLab/Azure/Bitbucket-only presentation (`getSourceControlPresentationForKind`, Azure/Bitbucket icons in GitActions publish): **D** if Nero is GitHub-only. Do not delete the **inbox**.

### 3.6 Adjacent glue (not a surface, but wired)

| Path | Decision | Notes |
| --- | --- | --- |
| `rightPanelStore.ts` | **A** | Keep files/file/diff/pull-request. Preview/terminal/agents are other maps. |
| `rightPanelLayout.ts` | **A** | |
| `components/RightPanelSheet.tsx` | **A** | Mobile sheet. |
| `composerDraftStore.ts` fields `worktreePath`, `envMode`, `startFromOrigin` | **D** those fields | Rest of the store is chat. |
| `lib/chatThreadActions.ts` | **A** | Stop inheriting worktrees; Nero new-thread does not pick an env mode. |
| `components/chat/workspaceFileDrop.ts` (+ test) | **C/A** | Drop files into composer. |
| `markdown-links.ts` | **A** | Uses `filePathDisplay` + basename lookup. |

---

## 4. RPC Nero must implement (or the UI is dead)

### Files (keep)

From `projectEnvironment` usage in `projectFilesQueryState.ts`:

- list entries for cwd
- path search / content search
- read file
- write file
- (optional) optimistic cache — T3 already does this client-side

### Git / commit diffs (keep)

From `vcsEnvironment` / `reviewEnvironment` / `gitEnvironment`:

- `vcs.status(cwd)` — branch, dirty, ahead/behind, linked PR
- `vcs.listRefs` / paginated branches
- `vcs.pull`
- `vcs.switchRef` — **shared checkout; fail if dirty**
- `review.diffFileContents` — unstaged / branch-vs-base
- stacked `git.runStackedAction` **or** Nero runs `git commit` / `git push` / `gh pr create` and the button is a thin wrapper
- **Do not implement** `vcs.createWorktree` / `removeWorktree` / `git.preparePullRequestThread` worktree mode

### PR inbox (keep if inbox stays)

`packages/contracts/src/rpc.ts`:

`pullRequests.list`, `listStats`, `detail`, `activity`, `threadComments`, `diffFileContents`, `runAction` (merge/close/reopen/…), `update`, `comment`, `updateComment`, `submitReview`, `replyToThread`, `setThreadResolution`, `setReaction`, `invalidate`, `reviewerCandidates`, `requestReviewers`.

Nero implementation target: `gh` in the workspace, one auth, one `owner/repo`. Drop T3’s per-environment merge in `state/pullRequests.ts`.

---

## 5. What not to leave in the UI

If a reviewer can still see any of these after the port, the worktree cut failed:

1. Workspace mode control (New worktree / Current checkout).
2. Previous worktree.
3. Start new worktrees from origin.
4. Default thread env mode in Settings / Project settings.
5. Sidebar worktree folder glyph or `t3code-4e609bb8`-style basename.
6. “Delete the worktree too?”
7. Prepare-PR dialog with Local vs Worktree.
8. Diff/file tree rooted at a path that is not the workspace cwd.
9. Copy that implies this thread has a private checkout.

Replace with one honest line if needed: **this workspace is shared; changing branch changes it for every thread.**

---

## 6. Suggested port order

1. **Cwd helper** — Nero `useActiveProjectTarget` = workspace root only.
2. **Files** — tree, preview, picker, search, basename lookup.
3. **Commit diffs** — DiffPanel branch + unstaged; Pierre worker; drop turn/checkpoint if no Nero analog.
4. **Git actions + branch picker** — no env mode; shared checkout errors.
5. **PR inbox** — keep UI, implement `pullRequests.*` with `gh`; gut multi-environment and worktree checkout.
6. **Delete** worktree modules listed **D**.

Artifacts: leave Nero’s. Do not import T3 preview-recording “artifact” language into this surface.
