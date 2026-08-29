# Nero audit issues tracker

Defects, deviations, and debt found while auditing PLAN.md against the branches.
Re-baselined to **main @ `5afbd24`** after the pass-3 sweep (2026-08-28) — v1 is
implemented and merged; this is now the post-v1 defect list. Fixed items are
checked with the commit that closed them. Roadmap work lives in
`docs/post-plan.md`.

Ground-up re-audit 2026-08-29 (main @ `b9e41da`): §8 added (+46 items: 4 P1,
13 P2, 29 P3), and the first fix wave landed in `4ecfb70` — daemon typecheck
repaired, all 10 red tests fixed, 5 security holes closed (docker argv secret
leak, dev-bypass refusal + guest non-forwarding, heartbeat default, predictable
tokens, host token in agent bash), the never-served /api/assets + /api/attachments
routes implemented, and the dead shared relay/DPoP/Connect stack deleted.
Post-wave: typecheck, `pnpm test` (2623), go build/vet/test -race, lint, and the
web build are all green. §0–7 are down to ~20 open; §8 has 4 P1 + 11 P2 + 27 P3
open.

---

## 0. In-plan remainder

- [x] Caddy `/w/:id/` wiring — `forward_auth /internal/caddy-auth`, per-workspace
      unix sockets `/run/nero/w/{id}.sock`, workspace matcher + `nero-ws` cookie,
      501 removed (c52a2d6). **Live-verified** (auth 401 fail-closed, daemon session
      200 through Caddy).
- [x] Daemon in the guest image — multi-stage Dockerfile builds `@nero/daemon`,
      `nero-daemon.service` enabled (c52a2d6). **Live-verified** (daemon healthy,
      `/healthz` ok in created workspaces).
- [x] Secret injection — docker env + `guest/export-container-env`; routing vars
      (`OPENROUTER_BASE_URL`, `NERO_MODEL`) now injected too (f496a7d).
      **Live-verified** (GLM turns run via Z.ai coding endpoint).
- [x] Keep-awake bridge — job side: `nero-run` heartbeats the host (5afbd24);
      UI side: the skin pins `connected` while a `/w/:id` route is open (neroHost
      heartbeat watcher, 30s interval + sendBeacon unpin). Remaining gap: the daemon
      still does not raise `AgentWorking` itself, but any open workspace route pins,
      which covers interactive use.
- [x] Workspace management UI — host-API picker, create/wake/stop/delete,
      heartbeat watcher; sidebar workspace switcher dialog landed
      (e36f4d8, b9e41da). The old project abstraction still lives underneath
      (§2), but the switcher is the product surface.
- [ ] **v1 acceptance verification pass — partially done live** (2026-08-29,
      Grid-01): TLS + ACME ✓; AuthKit fail-closed 401s ✓; create/wake/stop ✓;
      GLM turn via bash tool ✓ (Z.ai coding endpoint, plan quota); thread
      persistence across daemon reboot ✓; KasmVNC seat `noVNC_connected` through
      Caddy ✓; idle-stop reaped an unpinned workspace live ✓ (works as designed).
      Still unverified: `nero-run` >32 GiB survival, third-wake FIFO queue under
      real pressure, guest image memory.high cgroup writes under load.

## 1. Process / repo hygiene

- [x] Merge to main (c52a2d6 + 5afbd24 integrate all ten PRs' content).
- [x] CHECKLIST.md removed from main — the pass-3 claim was wrong; it was still
      tracked. Actually deleted in 4ecfb70.
- [x] **Stale branches.** All ten `execute-plan/*` branches were fully merged
      into main; deleted in 4ecfb70.

## 2. T3-skin remnant cleanup (PR 5 leftovers)

Law: "After adapt there is no T3 product left." Survivors at main:

- [x] `ThreadWorktreeIndicator` — the null stub, its Sidebar render site, and its
      test deleted (4ecfb70); `LegacySidebar` was already deleted in 9316ab6.
- [ ] `composerDraftStore` persists `worktreePath`/`envMode` (`composerDraftStore.ts:221-223`);
      `BranchToolbar.logic.ts:16` EnvMode helpers.
- [ ] Five driver kinds in contracts (`packages/contracts/src/model.ts:130-131`);
      `codex`/`claudeAgent` branches in ChatView; `ProviderModelPicker`/`TraitsPicker`.
- [ ] Settings remnants — self-update/version-check UI and the `LegacySidebar`
      mount are gone (9316ab6); `planModeEnabled` (`ChatView.tsx:1622,5468`,
      `modelSelection.ts`, `composerProviderState.tsx`) and the worktree settings
      rows (`SettingsPanels.tsx:246-251,278-377`: `defaultThreadEnvMode`,
      `newWorktreesStartFromOrigin`) remain.
- [ ] `server.updateServer`/`updateServerWithProgress`/`updateProvider` typed
      failure stubs (`rpc.ts:72-84`) — no UI callers remain (ChatView hardcodes
      the update env to null); delete the RPCs and their client-runtime bindings.
- [ ] Delete-listed files still imported by the skin: `desktopAuth.ts`
      (`connection/platform.ts:43`, `environments/primary/httpLayer.ts:6`),
      `desktopLocal.ts` (`remoteOpen.ts`, `CommandPalette.tsx:65`),
      `useT3ProjectFileScripts.ts` (`ProjectSettingsPanel.tsx:46`,
      `ChatHeader.tsx:37,145`), `useDesktopLocalBootstraps.ts` +
      `wslPaths.ts` (`CommandPalette.tsx:66,112`). Deleting them requires
      surgical edits in those five UI files — not blind deletes.
      `t3ProjectFileDefaults.ts` (zero importers) deleted (4ecfb70).
- [ ] Electron preview-guest files — `ElectronBrowserHost.tsx` deleted
      (4ecfb70); `usePreviewBridge.ts` is still live via `HostedBrowserWebview`
      (mounted by BrowserSurfaceSlot/PreviewView/ThreadPreviewMiniPlayer). Decide
      whether the hosted-webview feature stays; delete the whole subsystem if not.
- [x] `remoteDpopTokens` fixture (`connection/storage.test.ts:15`) removed and
      the whole dead shared relay/DPoP/Connect module stack deleted
      (`dpop*`, `relayAuth`, `relayTracing`, `relayJwt`, `relaySigning`,
      `relayUrl`, `connectAuth` + tests) (4ecfb70).
- [ ] `@t3tools/*` package names (4 package.json + client-runtime).
- [x] `/.well-known/t3/environment` — contract endpoint renamed to
      `/.well-known/nero/environment` (`contracts/environmentHttp.ts`), the
      daemon's legacy t3 twin route removed, and the four test files pinning the
      t3 path updated (4ecfb70).

## 3. Daemon contract cleanup

- [x] `getTurnDiff`/`getFullThreadDiff` — wired to `checkpoints.rangeDiff`
      (`daemon.ts:1792-1813`).
- [ ] Plan-DELETEd RPC stubs still advertised (`rpc.ts:72-132,167,198,321-341,383`):
      `updateServer`, `updateServerWithProgress`, `updateProvider`, `cloud.*`,
      `getUsageSummary` (UsagePage still calls it), `reportHostPowerState`,
      `getBackgroundPolicy` + `subscribeBackgroundPolicy`, `reportClientActivity`,
      `subscribeDiscoveredLocalServers`, `previewAutomation.connect/respond/focusHost`
      (echo/void stubs the UI actively drives), `shell.openInEditor` (guaranteed
      error toast), `server.signalProcess` (diagnostics Kill buttons silently
      no-op). `getSettings`/`updateSettings` are real now. Typed rejection is not
      deletion — delete each with its client-runtime binding.
- [ ] gh/PR RPCs — `git.ts:485-501` throw; all 20+ `pullRequests.*` handlers are
      stubs (`rpc.ts:133-157`). Meanwhile a routable `/w/:id/pull-requests` page
      with a sidebar link (`SidebarChrome.tsx:176`), `PullRequestThreadDialog`,
      and `sourceControlActions.ts:308-335` can only ever render empty/error —
      unship the surface (route + link + RPCs) or implement gh.
- [x] assets/attachments backing routes — implemented in `apps/daemon/src/http.ts`
      (4ecfb70): `GET /api/assets/workspace` (thread-cwd rooted, traversal-guarded,
      25 MiB cap), `GET /api/assets/favicon` (deterministic SVG monogram,
      workspace-root contained), `GET/POST /api/attachments/:id` (id-pattern
      validated, 10 MiB cap, dataURL + magic-byte sniffing), and
      `attachments.delete` now actually unlinks (was a no-op orphaning files).
- [ ] `getWorkflowScript` always not-found (`rpc.ts:395-401`) — and it HAS a
      caller: AgentsPanel's script viewer queries it, so the "{}" button always
      yields an error. Implement (read the path contained to the workflow dir)
      or delete with the viewer.
- [x] `UsagePage` — resolved as delete (4ecfb70): the page is an intentional
      stub ("Usage is hidden until Nero has a usage contract"), and the orphaned
      test + dead `UsageProviderChart`/`usageProviders` modules were removed. A
      real usage contract remains a post-plan option; the daemon-side
      `getUsageSummary` stub stays until then (§3).

## 4. Security & config hardening

- [x] Daemon trust contract — explicit and fail-closed: host mints
      `X-Nero-Access` after AuthKit check (`apps/host/internal/api/caddy.go`),
      daemon accepts `x-nero-access`/bearer/cookie and strips it before Kasm
      (`daemon.ts:388-410`) (5afbd24).
- [x] `NERO_DEV_BYPASS=1` — `Config.DevBypassRefused` now fails `AuthReady` on
      any non-loopback listener (including ""/all-interfaces and 0.0.0.0), and
      the flag is no longer forwarded into guests (`export-container-env` KEY
      list + `nero-daemon.service` PassEnvironment) where it disabled all daemon
      auth. The daemon-side option remains for explicit local dev (4ecfb70).
- [ ] KasmVNC password hardcoded at build — now `"nero-vm-seat"` (`guest/Dockerfile:123-124`,
      seeded into every fresh home). Mitigations: kasmvnc binds 127.0.0.1 with
      `-DisableBasicAuth` and the only path in is the daemon's authed `/vnc`
      proxy, but anyone holding the image can read it. Mint per-workspace at
      create instead.
- [x] `job-heartbeat` empty/absent body now means `running=false` — only an
      explicit `true` pins (4ecfb70; documented in deploy/README.md).
- [ ] `isHTTPS` — partial: loopback + `X-Forwarded-Proto` branch added
      (`session.go:227`); the `*.grogan.dev` domain heuristic remains (`:224`).
- [x] **docker argv secret leak** — `runCmd` embedded full argv in error strings
      that bubble to HTTP 500 bodies and logs, including `--env
    OPENROUTER_API_KEY=…`/`NERO_ACCESS_TOKEN`/`NERO_HOST_TOKEN` on create
      failure. `argvForErrors` now redacts env values (4ecfb70).
- [x] **Daemon credentials were predictable** — tickets/sessions/pairing creds
      minted from timestamp+counter; now CSPRNG (`nextSecret`,
      `crypto.randomBytes(24)` base64url) (4ecfb70). Remaining (§8): the
      `authorizeHttp` compare is not constant-time and mint endpoints have no
      rate limit.
- [x] **Host token reached agent bash** — `BASH_ENV_DENY` covered only
      `OPENROUTER_API_KEY`/`NERO_ACCESS_TOKEN`; the `NERO_*` pass-through leaked
      `NERO_HOST_TOKEN` (authorizes job-heartbeat for ANY workspace id). Deny
      list now also covers `NERO_HOST_TOKEN`/`NERO_HOST_URL`/`NERO_WORKSPACE_ID`
      (4ecfb70).

## 5. Admission & sticker fidelity

- [ ] **32 GiB sticker warning** — still doc-only (`deploy/README.md:189`); no
      runtime warn when a workspace crosses 32 GiB.
- [ ] Job-start admission — create/wake FIFO exists; whether jobs need separate
      gating is undecided (currently ride the workspace 64G cap).

## 6. Preview / seat

- [ ] Serialization is mutual exclusion, not a queue — exclusive flock +
      `HUMAN_DRIVING_IDLE_MS=20_000` (`apps/daemon/src/seat-lock.ts`); raw human VNC
      input never takes the lock; focused-idle tab blocks the agent 20s.
- [ ] `attachVncProxy` monkey-patches `server.emit` (`vnc-proxy.ts:270-292`).
- [ ] Scaled-view pixel fidelity — `resize=scale` unchanged; `/w/:id` VNC prefix
      wiring landed (5afbd24) but agent-coords end-to-end is unverified.

## 7. Smaller debt

- [ ] Keybindings: `server.upsertKeybinding`/`removeKeybinding` are daemon
      no-ops — user edits reset on daemon restart. Needs a daemon persistence
      decision (rpc.ts:83-86).
- [ ] Source Control "Fetch interval" setting is inert: `subscribeVcsStatus`
      polls at a fixed 2s regardless (rpc.ts:212-219).
- [ ] `enableProviderUpdateChecks` / `enableLegacyTokenStreaming` have no UI
      and no daemon consumer — remove from `ServerSettings` in a contracts pass.
- [x] Workspace datasets delete/destroy — end-to-end since b9e41da:
      `DELETE /api/workspaces/{id}` (authed) → dequeue → stop → `docker rm` →
      proxy socket unlink → `zfs destroy -r pool/nero/{id}` → state drop; UI
      confirm dialog in the switcher. Wart: container is removed before dataset
      destroy, so a failed `zfs destroy` leaves a listed-but-unwakeable
      workspace until delete is retried (retryable, data-safe).

- [ ] Clerk catalog refs (23) in `pnpm-workspace.yaml`.
- [ ] `assets/` web-favicon sources from `00-copy-set.md` never copied (cosmetic).
- [ ] `debian:trixie` base unpinned (deliberate deferral).
- [ ] `nero-run` user-slice placement is by design, but heartbeat → idle-stop →
      wake needs the runtime verification pass to prove.

---

## 8. Fresh full-codebase audit (2026-08-29, main @ `b9e41da`)

Parallel sweep of apps/host (Go), apps/daemon, apps/web Nero surfaces,
packages/\*, and deploy/guest. Every P1 and P2 below was verified against the
surrounding code; P3s are code-quoted and plausible. Excludes everything
already tracked in §0–7. Items fixed by the first wave are checked with
`4ecfb70`; the P1s are re-verified against current code and still open.

### P1

- [ ] **`thread.checkpoint.revert` semantics disagree three ways → durable data
      loss.** Web sends "keep N" — the clicked turn's checkpoint count minus 1
      (`ChatView.tsx:2637-2642`, dialog at `:5204`, send at `:5216-5222`). Daemon
      reads it as "remove N user turns": `keepUsers = userTurns.length -
    command.turnCount` (`daemon.ts:1076-1091`). Client reducer keeps
      checkpoints `<= payload.turnCount` (`threadReducer.ts:524-536`). Reverting
      the last turn of a 4-turn thread permanently deletes turns 2–4 server-side
      while the optimistic UI shows 1–3 until reload. Daemon also never prunes
      `thread.checkpoints` (stale rows). Fix: pick one meaning and align all
      three; prune checkpoint state on revert.
- [ ] **Superseding a turn while a tool approval is pending poisons the shared
      LLM conversation.** `PiHarness.conversations` is one array per thread
      reused across turns (`harness.ts:115-147`); supersede only aborts at the
      next await. A turn parked in `approveTool` resolves "cancel" on abort and
      pushes `{role:"tool"}` for its old call id AFTER the superseding turn's
      user message (`harness.ts:450-479`) — orphaned tool message; OpenAI-strict
      backends 400 every later turn on that thread until daemon restart.
      Composer gates on `isSendBusy` only, so this is a normal flow.
- [ ] **Landing on a stopped workspace is a dead app.** `/` redirect picks last
      workspace without checking `state` (`_chat.index.tsx:30-42`); switcher row
      click likewise (`WorkspaceSwitcher.tsx:120-123`). Stopped workspace has no
      proxy socket → SPA loads from Caddy, all RPC 502s, endless
      "Reconnecting…". Only the overflow-menu Wake recovers. Wake-then-navigate
      (or pick a running workspace) is the fix.
- [ ] **Unbounded `readFileSync` in file tools can OOM-kill the daemon.**
      `files.ts:113-135` (read) and `:323-331` (searchProjectContents, per file
      walked up to 8k entries) read the whole file before the 1 MiB cap /
      binary check; `stat.size` is in hand and unchecked. A multi-GB file in the
      workspace (agent bash can create one) kills the daemon for everyone.

### P2

- [x] **`NERO_HOST_TOKEN` leaked into every agent bash env.** `BASH_ENV_DENY`
      was only `OPENROUTER_API_KEY`/`NERO_ACCESS_TOKEN`; the `NERO_*` pass-through
      admitted the host control-plane token (`tools.ts:34,130`), which authorizes
      job-heartbeat for ANY workspace id — a prompt-injected agent could pin or
      unpin every workspace. Deny list extended to
      `NERO_HOST_TOKEN`/`NERO_HOST_URL`/`NERO_WORKSPACE_ID` (4ecfb70).
- [ ] **Idle-stop TOCTOU.** `ReconcileIdle` snapshots ids then stops without
      re-checking `pinned(ws)`; each `docker stop -t 20` makes later decisions
      20s+ stale, so a freshly re-pinned workspace is stopped under the user
      (`landlord.go:335-353`, `stopOp` at `:455-464` only checks `wasRunning`).
- [x] **Attachment ids used unsanitized in filesystem paths.** Client-supplied
      `id` was joined into `dataDir/attachments` for read and write (`../`
      reads arbitrary files, plants files anywhere the daemon user can write).
      All four surfaces (write/read/delete/HTTP route) now enforce
      `^[A-Za-z0-9]{4,64}$` (4ecfb70).
- [ ] **`restore()` crash-loops the daemon on a poisoned `orchestration.json`.**
      Settings go through unguarded `Schema.decodeUnknownSync`
      (`daemon.ts:145-146`), projects/threads are blind casts (`:296-312`);
      throws in the constructor before `runMain`, and `Restart=on-failure`
      boot-loops until the file is deleted by hand. The encode-side comment
      promises the opposite behavior.
- [ ] **`nero-run` reports `running:false` on INT/TERM without killing the
      job.** The trap posts the heartbeat but never signals the `systemd-run
    --scope` child (`guest/nero-run:86-103`): a harness timeout kills only the
      wrapper → live job unpinned → idle-stop kills it after grace.
- [ ] **Alt-tab never releases the human-driving latch.** `focusout` with
      `relatedTarget === null` (focus left the browser) is treated as "moved
      into the iframe" (`KasmVncFrame.tsx:38-44`); only `visibilitychange`
      resets, so 5s beats hold the seat lock indefinitely while the user works
      in another app; agent input queues behind an absent human.
- [ ] **Two workspace tabs cross-route daemon calls by cookie.** Daemon-bound
      calls use the bare origin (`humanDriving.ts:17-19`; RPC/attachment URLs
      resolve against window origin) while Caddy routes root paths by the
      `nero-ws` cookie (`Caddyfile:80-89`) — tab B's load re-points tab A's
      seat-driving POST, attachment uploads, and RPC reconnects at workspace B.
      The prefixed `/w/:id/api|ws` forms Caddy already supports are used only by
      `seatVnc.ts`.
- [ ] **Token hardening remainder.** Credentials are CSPRNG now (4ecfb70),
      but `authorizeHttp` still compares non-constant-time
      (`daemon.ts:467-477`) and mint endpoints have no rate limit. Caddy
      forward_auth shields it today.
- [ ] **Checkpoint trees keyed by per-thread turn count; revert doesn't prune.**
      Counts restart after revert → next capture overwrites old trees, duplicate
      "Turn N" checkpoints, old `getTurnDiff` resolves to the new turn's diff
      (`checkpoints.ts:190-195`; compounds the P1 revert bug).
- [ ] **Synchronous `spawnSync` git stalls the whole daemon.** Checkpoints run
      add/write-tree/diff per turn (30s timeout each), stacked git actions run
      inline (rpc.ts:227 fakes streaming), `subscribeVcsStatus` spawns ~5 git
      procs per subscriber every 2s — all on the one event loop that serves
      RPC/SSE/terminals/VNC proxy (`checkpoints.ts:92-104`, `git.ts:53,88`,
      `rpc.ts:213-219`).
- [ ] **Terminal respawn broadcasts a stale `exited` to attached clients.** The
      old pty's exit closure fires against the new session (listeners Set is
      reused), so "restart terminal" renders a dead terminal
      (`terminal.ts:293-305,339-409`).
- [ ] **Revert never invalidates harness conversations.** The model keeps
      receiving pre-revert history on every later turn — the user-visible point
      of revert is silently defeated (`harness.ts:137-165`, no eviction path);
      relatedly `deltaAssistant` can resurrect messages deleted mid-stream
      (`daemon.ts:1603-1631`).
- [ ] **Preview keyboard shortcuts are dispatched to nothing and swallow
      browser shortcuts while the seat is focused.** Dispatcher kept,
      PreviewView consumer deleted; mod+r / mod+= / mod+- / mod+0 are
      `preventDefault`ed to no effect during normal seat use
      (`_chat.tsx:204-224`, `ChatView.tsx:3722-3725`,
      `shared/keybindings.ts:31-36`).

### P3

- [x] **`pnpm test` was red on main** — 10 failures across the suite:
      client-runtime tests pinned removed T3 strings/paths and the deleted
      relay surface; daemon typecheck was broken (erasableSyntaxOnly param
      property + DaemonOptions test helpers); stale `remoteDpopTokens` fixture;
      orphaned UsagePage tests. All fixed (4ecfb70); 2623 tests green.
- [ ] `enforceBudget` demotes by lexicographic id, ignoring pinned/in-use state
      (`landlord.go:608-623`) — bites when `syncRuntime` adopts an externally
      started container.
- [ ] `serveUnixProxy` exits permanently on a transient `Accept` error (EMFILE)
      and `hub.bind`'s same-port early-return never rebinds → wedged proxy, no
      self-heal (`proxy.go:66-67,121-129`).
- [ ] `tightenSocket` silently skips the caddy-group chown when group lookup
      fails → all workspace routes 502 silently on non-apt Caddy installs
      (`proxy.go:89-103`).
- [ ] `runCmd` uses `CombinedOutput`, merging stderr into JSON parsed
      downstream (`docker.go:72-75`) — stray docker CLI stderr wedges the
      lifecycle loop.
- [ ] `Create` leaves a registered orphan (dataset + exited container) when
      `tryStart` fails; 500 without an id invites duplicate-create
      (`landlord.go:149-174`).
- [ ] `http.Server` sets only `ReadHeaderTimeout`; no body-size limit in
      `decodeOptional` (`cmd/nero-host/main.go:58-62`).
- [ ] `Restore` stamps `CreatedAt = now` on every adopted workspace → List
      ordering is arbitrary after reboot (`landlord.go:118-127`).
- [ ] Diagnostics "Kill" is a dead flow: `server.signalProcess` stub never
      matches `isStaleProcessSignalMessage`; destructive UI + honest toast
      (`DiagnosticsSettings.tsx:911-977`, `rpc.ts:109-115`).
- [ ] First heartbeat pin fires even when the tab mounts hidden
      (`_chat.tsx:84-90`) → background-tab loads pin the 20-min zombie grace.
- [ ] `KasmVncFrame` recomputes `src` from the live pathname on every render —
      cross-route SPA nav rewrites the iframe src and tears down the seat
      websocket (`KasmVncFrame.tsx:20`).
- [ ] `writeLastWorkspaceId` called in render phase
      (`_chat.w.$workspaceId.index.tsx:21`, draft route `:23`).
- [x] Published `auth.md` still said `/w/*` is 501/not-wired — wired since
      `c52a2d6`; corrected to describe the live proxy + session requirement
      (4ecfb70).
- [ ] `kasmvnc.service` `Type=forking` with no `PIDFile` → Xvnc death
      undetected, no restart, seat black (`guest/systemd/kasmvnc.service`).
- [ ] `export-container-env` writes EnvironmentFile values unquoted — latent
      breakage on future free-text env values (`guest/export-container-env:40-42`).
- [ ] `streamChatCompletion` never destroys the response after settle (trailing
      SSE deltas still append to the completed message); no retry on
      429/5xx; request `timeout` is socket-idle, not total
      (`openrouter.ts:304-365`).
- [ ] `applyToolDelta` merges index-less parallel tool calls into the first
      (`openrouter.ts:168-169`).
- [ ] Concurrent `setDriving(true)` can leave both `hold` children dead →
      driving:false after two explicit drive requests (`seat-lock.ts:57-108`).
- [ ] Interactive terminal PTY inherits the full daemon env including
      `OPENROUTER_API_KEY` (`terminal.ts:92-98`) — human seat only, but visible
      on screen and in model-fed screenshots.
- [ ] `appendActivity` stamps `sequence + 1` without consuming it → duplicate
      sequence across shell/event streams (`daemon.ts:1713`).
- [ ] HTTP dispatch path maps sync throws (bad json, unknown thread/project) to
      bare 500 instead of typed 400/404 (`http.ts:283-291`).
- [ ] `sessions`/`tickets` maps are never pruned; `authorizeHttp` scans all
      sessions per request (`daemon.ts:264-265,461-479`).
- [ ] `subscribeShell`/`subscribeThread` snapshot-vs-subscribe gap drops events
      and `afterSequence` is ignored; advertised `threadSnapshotPagination`/
      resume markers are unimplemented → full-thread resend each reconnect
      (`rpc.ts:407-424`, `daemon.ts:422-424,679-702`).
- [ ] `rewriteShotCommand`'s regex matches across shell operators → injects
      `--out` into an unrelated "shot" token (`tools.ts:96-97,119-122`).
- [ ] `diffTrees` numstat parse garbles rename paths
      (`checkpoints.ts:226-241`).
- [ ] `subscribeAuthAccess` serves a permanently empty snapshot while HTTP
      serves real pairing links; nothing ever emits `authHub`
      (`rpc.ts:371-382`, `daemon.ts:257`).
- [ ] `EnvironmentHttpApi` advertises auth-admin endpoints
      (`revokePairingLink`, `clients`, `revokeClient`, `revokeOtherClients`)
      the daemon never routes → a leaked pairing credential is irrevocable from
      the product (`environmentHttp.ts:463-486`).
- [ ] Terminal re-attach after close without `deleteHistory` returns a dead
      "running" session (`terminal.ts:307-329`) — latent; all current callers
      pass `deleteHistory: true`.
- [ ] `daemon.updateSettings` silently drops `patch.providers`
      (`daemon.ts:428-434`).

Audited-and-clean notes: Caddy cookie handling is correct (non-deferred header
ops apply before reverse_proxy appends upstream headers, so upstream
Set-Cookie survives; `wos-session` regex strip works; `nero-ws` id is
hex-constrained and re-validated); `git.ts` has no command injection; daemon
SSE parsing is sound; neroHost.ts ↔ Go field shapes match end-to-end;
`go test -race` passes; `.env` is untracked and not VITE-exposed.

---

Laws that outlive the plan (do not violate while fixing): T3 copy is copy-and-map,
never rewrite; the OpenRouter-Baseten pin is v1 law only — its retirement is
decided and recorded in `docs/post-plan.md` §1–2 (Nero Router + Z.ai/Baseten);
control plane stays landlord-only (no agent loop in `apps/host`).
