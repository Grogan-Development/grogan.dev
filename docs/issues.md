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
web build are all green.

Second full-tree pass the same day (main @ `29d96a2`, after `4ecfb70` + the
stopped-workspace wake-before-navigate in `29d96a2`): §9 added. Independently
re-verified §8 against current source; the stopped-workspace P1 is closed;
two §8 items were false positives; several “fixed” claims were incomplete
(attachment RPC, `BASH_ENV_DENY`, git argv). §0–7 ~20 open; §8 has 3 P1 +
10 P2 + 26 P3 open; §9 has 4 P1 + 14 P2 + 6 P3 open.

Readiness wave the same day (main @ `67d4311`+): every P1 from §8/§9 is now
closed — daemon OOM reads (`df3a45d`), revert data loss + harness poison
(`67d4311`), host-secret exposure / heartbeat split / cgroup placement /
reboot socket perms (`538f575`), plus the P2/P3 backlog listed per item
below and the Loom guest wiring + stale docker-flags test (`90e85da`).
Remaining open items are P2/P3 leftovers (pairing-password reuse, git argv
injection, privileged-guest threat model, seat-latch polish).

Review-agent wave the same day (4 parallel reviews of daemon / host /
guest+deploy / web+contracts) confirmed the wave fixes and caught two
regressions the wave itself introduced, both fixed in the same commit:
the harness stored the pre-sanitized conversation array, stranding every
turn after the first (model memory loss — P1), and the web corrective
unpin was gated on the disposed flag, suppressing it exactly on SPA
unmount. Also fixed from that sweep: the `restore()` crash-loop (§8 P2,
now quarantines a poisoned orchestration.json instead of boot-looping),
aborted-turn settlement racing a revert (evicted turns settle quietly),
revert truncation is index-based (clock-skew immune) and prunes
activities/proposedPlans of dropped turns, the minted attachment id now
passes the id guard, daemon token compares are constant-time,
`streamResponses` honors timeout/idle budgets (a stalled Codex stream
can no longer hang a turn and its keep-awake pulse), socket-dir group
ownership is self-healed alongside the mode, a missing caddy group is
skipped while chown failures stay fatal, and the queued-create poll bails
when admission gives up instead of spinning its full budget.

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
      (`ZAI_BASE_URL`, `NERO_MODEL`) now injected too (f496a7d).
      **Live-verified** (GLM turns run via Z.ai coding endpoint).
- [x] Keep-awake bridge — job side: `nero-run` heartbeats the host (5afbd24);
      UI side: the skin pins `connected` while a `/w/:id` route is open (neroHost
      heartbeat watcher, 30s interval + sendBeacon unpin). The daemon _does_ pin
      live turns, but through **JobRunning** (`HostTurnPulse` → job-heartbeat),
      which collides with `nero-run` (§9 P1). `agentWorking` is still never set.
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
      real pressure, guest image memory.high cgroup writes under load (and
      §9: those writes likely hit `init.scope`, not the container cgroup).
      Idle-stop “unpinned” live may have been the 20-min zombie path — pin/unpin
      race + sendBeacon JSON can leave `Connected=true` (§9 P2).

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
- [x] gh/PR surface — resolved by the Loom integration (2026-08-29): the
      `/w/:id/pull-requests` page now lists Loom features (FRs) via the daemon's
      `/api/loom/*` proxy, and a new `/w/:id/ci` page shows the Loom event log
      (candidate verifications, CI results, promotions). The old GitHub
      machinery (pullRequests.\* stubs, git.resolvePullRequest/prepare) has no
      page calling it anymore — delete the RPC stubs in the next contracts pass.
      Graceful 503 state until LOOM_URL/LOOM_TOKEN land in host.env.
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
- [x] **Host token reached agent bash env** — `BASH_ENV_DENY` covered only
      `OPENROUTER_API_KEY`/`NERO_ACCESS_TOKEN`; the `NERO_*` pass-through leaked
      `NERO_HOST_TOKEN` (authorizes job-heartbeat for ANY workspace id). Deny
      list now also covers `NERO_HOST_TOKEN`/`NERO_HOST_URL`/`NERO_WORKSPACE_ID`
      (4ecfb70). Incomplete: the child env is stripped, but the same secrets
      sit in `/etc/nero/guest.env` (`0640 root:nero`) and in the daemon
      process environ (same UID as agent bash) — §9 P1.

## 5. Admission & sticker fidelity

- [ ] **32 GiB sticker warning** — still doc-only (`deploy/README.md:189`); no
      runtime warn when a workspace crosses 32 GiB. The 48 GiB `memory.high`
      throttle is likely inert as well (written on PID 1's innermost cgroup,
      usually `init.scope`, not the Docker container cgroup) — §9 P1.
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
`4ecfb70`. Re-verified 2026-08-29 @ `29d96a2`: stopped-workspace P1 closed;
preview-shortcut P2 and KasmVncFrame-src P3 were false positives; remaining
P1s still open (revert, harness poison, unbounded read).

### P1

- [x] **`thread.checkpoint.revert` semantics disagree three ways → durable data
      loss.** Web sends "keep N" — the clicked turn's checkpoint count minus 1
      (`ChatView.tsx:2637-2642`, dialog at `:5204`, send at `:5216-5222`). Daemon
      reads it as "remove N user turns": `keepUsers = userTurns.length -
command.turnCount` (`daemon.ts:1076-1091`). Client reducer keeps
      checkpoints `<= payload.turnCount` (`threadReducer.ts:524-536`). Reverting
      the last turn of a 4-turn thread permanently deletes turns 2–4 server-side
      while the optimistic UI shows 1–3 until reload. Daemon also never prunes
      `thread.checkpoints` (stale rows), never `harness.abort`s, and **never
      checks out the stored tree** — chat rewinds, workspace files stay at
      HEAD. Fix: pick one meaning and align all three; prune checkpoint state;
      restore the tree; abort/evict the harness conversation.
- [x] **Superseding a turn while a tool approval is pending poisons the shared
      LLM conversation.** `PiHarness.conversations` is one array per thread
      reused across turns (`harness.ts:115-147`); supersede only aborts at the
      next await. A turn parked in `approveTool` resolves "cancel" on abort and
      pushes `{role:"tool"}` for its old call id AFTER the superseding turn's
      user message (`harness.ts:450-479`) — orphaned tool message; OpenAI-strict
      backends 400 every later turn on that thread until daemon restart.
      Composer gates on `isSendBusy` only, so this is a normal flow. Same
      poison without a pending approval: interrupt can leave
      `assistant.tool_calls` on the array with no `role:"tool"` rows
      (`harness.ts:411-505`) if `executeTool` throws `aborted` before the push.
- [x] **Landing on a stopped workspace is a dead app.** `/` and the switcher
      now `ensureNeroWorkspaceAwake` (wake, wait for running) before
      `/w/:id/` (`29d96a2`). Remainder: first-run **create** still
      `location.assign`s without a state check (`_chat.index.tsx:110-111`,
      `WorkspaceSwitcher.tsx:183-186`) — if admission returns `queued`, same
      502 dead-end. Tracked as §9 P2.
- [x] **Unbounded `readFileSync` in file tools can OOM-kill the daemon.**
      `files.ts:113-135` (read) and `:323-331` (searchProjectContents, per file
      walked up to 8k entries) read the whole file before the 1 MiB cap /
      binary check; `stat.size` is in hand and unchecked. Same pattern:
      `tools.ts:213` (`edit` whole file), `:330-331` (shot `--out` before
      `MAX_SHOT_BYTES`), `http.ts` GET attachment (no cap on the stored
      dataURL). A multi-GB file in the workspace (agent bash can create one)
      kills the daemon for everyone.

### P2

- [x] **`NERO_HOST_TOKEN` leaked into every agent bash env.** `BASH_ENV_DENY`
      was only `OPENROUTER_API_KEY`/`NERO_ACCESS_TOKEN`; the `NERO_*` pass-through
      admitted the host control-plane token (`tools.ts:34,130`), which authorizes
      job-heartbeat for ANY workspace id — a prompt-injected agent could pin or
      unpin every workspace. Deny list extended to
      `NERO_HOST_TOKEN`/`NERO_HOST_URL`/`NERO_WORKSPACE_ID` (4ecfb70).
- [x] **Idle-stop TOCTOU.** `ReconcileIdle` snapshots ids then stops without
      re-checking `pinned(ws)`; each `docker stop -t 20` makes later decisions
      20s+ stale, so a freshly re-pinned workspace is stopped under the user
      (`landlord.go:335-353`, `stopOp` at `:455-464` only checks `wasRunning`).
- [x] **Attachment ids used unsanitized in filesystem paths (HTTP/delete).**
      Client-supplied `id` was joined into `dataDir/attachments` for read and
      write (`../` reads arbitrary files, plants files anywhere the daemon
      user can write). HTTP GET/POST and `attachments.delete` now enforce
      `^[A-Za-z0-9]{4,64}$` (4ecfb70). **RPC persist/read missed:**
      `persistIncomingAttachment` / `writeAttachmentDataUrl` still join the
      client id (`daemon.ts:1232-1239,1576-1579`) — §9 P2.
- [x] **`restore()` crash-loops the daemon on a poisoned `orchestration.json`.**
      Quarantine fix: decode happens into locals; any throw renames the file
      to `orchestration.json.corrupt-<ts>`, logs loudly, and boots from
      defaults instead of restart-looping.
      Settings go through unguarded `Schema.decodeUnknownSync`
      (`daemon.ts:145-146`), projects/threads are blind casts (`:296-312`);
      throws in the constructor before `runMain`, and `Restart=on-failure`
      boot-loops until the file is deleted by hand. The encode-side comment
      promises the opposite behavior.
- [x] **`nero-run` reports `running:false` on INT/TERM without killing the
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
- [x] **Checkpoint trees keyed by per-thread turn count; revert doesn't prune.**
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
- [x] **Revert never invalidates harness conversations.** The model keeps
      receiving pre-revert history on every later turn — the user-visible point
      of revert is silently defeated (`harness.ts:137-165`, no eviction path);
      relatedly `deltaAssistant` can resurrect messages deleted mid-stream
      (`daemon.ts:1603-1631`).
- [x] **Preview keyboard shortcuts swallow seat input** — **false
      positive.** The seat is an iframe; parent `window` `keydown`
      (`_chat.tsx:204-224`) does not see iframe keys. `PreviewView` still
      subscribes but ChatView mounts `PreviewPanel`, not `PreviewView`.
      Dead chrome handlers only; not a seat-focus swallow. Leave the
      unused dispatcher as §2/§3 cleanup, not a P2 bug.

### P3

- [x] **`pnpm test` was red on main** — 10 failures across the suite:
      client-runtime tests pinned removed T3 strings/paths and the deleted
      relay surface; daemon typecheck was broken (erasableSyntaxOnly param
      property + DaemonOptions test helpers); stale `remoteDpopTokens` fixture;
      orphaned UsagePage tests. All fixed (4ecfb70); 2623 tests green.
- [x] `enforceBudget` demotes by lexicographic id, ignoring pinned/in-use state
      (`landlord.go:608-623`) — bites when `syncRuntime` adopts an externally
      started container.
- [x] `serveUnixProxy` exits permanently on a transient `Accept` error (EMFILE)
      and `hub.bind`'s same-port early-return never rebinds → wedged proxy, no
      self-heal (`proxy.go:66-67,121-129`).
- [x] `tightenSocket` silently skips the caddy-group chown when group lookup
      fails → all workspace routes 502 silently on non-apt Caddy installs
      (`proxy.go:89-103`). Even when lookup succeeds, `Chown` errors are
      discarded (`proxy.go:101`) — §9 P2.
- [x] `runCmd` uses `CombinedOutput`, merging stderr into JSON parsed
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
- [x] First heartbeat pin fires even when the tab mounts hidden
      (`_chat.tsx:84-90`) → background-tab loads pin the 20-min zombie grace.
- [x] `KasmVncFrame` src teardown on every render — **false positive.**
      `seatVncClientUrl()` is prefix-stable under `/w/:id/*`; an identical
      `src` does not remount the iframe (`KasmVncFrame.tsx:20`).
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
      (now `apps/daemon/src/router/` — the old single-provider client was replaced by the router on 2026-08-29; re-verify this item against `router/openaiCompat.ts`).
- [ ] `applyToolDelta` merges index-less parallel tool calls into the first
      (now `apps/daemon/src/router/openaiCompat.ts:applyToolDelta`).
- [ ] Concurrent `setDriving(true)` can leave both `hold` children dead →
      driving:false after two explicit drive requests (`seat-lock.ts:57-108`).
- [ ] Interactive terminal PTY inherits the full daemon env including
      `ZAI_API_KEY` (`terminal.ts:92-98`) — human seat only, but visible
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
hex-constrained and re-validated); daemon SSE parsing is sound; neroHost.ts ↔
Go field shapes match end-to-end; `go test -race` passes; `.env` is untracked
and not VITE-exposed. **Retracted:** "`git.ts` has no command injection" — no
`sh -c` interpolation, but leading `-` on clone URL / ref / path is still git
option-injection (`git.ts:259-288,503-546,601-616`); tracked in §9.

---

## 9. Second full-tree pass (2026-08-29, main @ `29d96a2`)

Independent re-read of host, daemon, guest, web Nero surfaces, contracts, and
deploy. Excludes everything already tracked in §0–8 except where this pass
proved a “fixed” claim incomplete or a §8 item false. Every P1/P2 below was
verified against current source.

Suggested fix order: secret isolation → split `agentWorking`/`jobRunning` →
`memory.high` on the Docker cgroup → `/run/nero/w` mode → revert meaning +
tree restore + harness abort → harness conversation poison → create-queued
wake → `stat.size` before `readFileSync` → prefix all daemon URLs with
`/w/:id`.

### P1

- [x] **Agent can read every host secret.** `BASH_ENV_DENY` only strips the
      **child** env (`tools.ts:34-42,133-147`; `printenv` test at
      `tools.test.ts:143`). Agent bash is UID `nero`, same as the daemon.
      `/etc/nero/guest.env` is `0640 root:nero` (`export-container-env:46-47`)
      — systemd `EnvironmentFile=` is read as root, so the nero group does not
      need the file. `/proc/<daemon-pid>/environ` still holds
      `OPENROUTER_API_KEY` / `NERO_ACCESS_TOKEN` / `NERO_HOST_TOKEN` because
      `loadOptionsFromEnv` never unsets them (`runtime.ts:128-134`,
      `main.ts`). `nero-run` puts the host token on `curl` argv
      (`guest/nero-run:77-82`). `NERO_HOST_TOKEN` authorizes job-heartbeat for
      **any** workspace id (`server.go:254-279`). Fix: `chmod 0600 root:root`
      on `guest.env`; drop secrets from the daemon process env after load;
      per-workspace host tokens; heartbeat helper that is not agent-readable;
      `ProtectProc=` / split UID / `hidepid=`. Closed in `538f575` for the
      host-wide part: guests now hold only per-workspace derived tokens
      (the raw host/access secrets never enter a container), guest.env is
      0600 root:root, and nero-run keeps its token off argv in a 0600
      curl config. Remaining exposure: provider keys still ride the
      daemon process env, same-uid readable via /proc — see the open
      split-UID note.
- [x] **Live agent turns and `nero-run` share one boolean.** `HostTurnPulse`
      (`daemon.ts:157-202,1362,1764`) POSTs `{running}` to **job-heartbeat**.
      `nero-run` does the same (`guest/nero-run:70-93`). Landlord last-write
      wins on `JobRunning` (`landlord.go:228-229`). A finishing turn unpins a
      live bake (5 min idle-stop kills it); a finishing job unpins a live turn
      until the next 30s pulse. UI never sends `agentWorking`
      (`neroHost.ts:177-183`). PLAN keep-awake is three independent pins. Fix:
      pulse `agentWorking` (host-token on `/heartbeat`, or a third route);
      refcount jobs. Closed in `538f575`: the daemon pulses `agentWorking`
      and nero-run keeps `running` on the token-gated job-heartbeat route;
      the pins are independent and field-specific updates never touch the
      other bit.
- [x] **`memory.high` is written on the wrong cgroup.** `ApplyCgroup` uses
      PID 1’s current cgroup (`docker.go:207-232`). After guest systemd
      starts, that is typically `docker-….scope/init.scope`, not the Docker
      container cgroup where `--memory=64g` landed. User slices (`nero-daemon`,
      Chromium, `nero-job.slice`) are siblings, so the 48 GiB throttle and
      `oom.group=1` do not cover the pig. Tests stub
      `0::/system.slice/docker-abc.scope` (`docker_test.go:16-18`) and miss
      this. Start ignores apply errors (`docker.go:144`). `--memory=64g` still
      caps the workspace. Fix: walk up to the cgroup that has `memory.max=64g`;
      fail start if cgroupfs is present and the write fails. Done in
      `538f575` exactly that way (`containerCgroupDir` + start fails when
      cgroupfs is present).
- [x] **`/run/nero/w` is `0700` after reboot → all workspace routes 502.**
      `deploy/nero-host.service` has `UMask=0077` and
      `ExecStartPre=/bin/mkdir -p /run/nero/w`. `/run` is tmpfs. First reboot
      creates `root:root 0700`. Caddy cannot traverse to `0660` sockets even
      when `chown` to group `caddy` succeeds. `MkdirAll(..., 0755)`
      (`proxy.go:70-72`) will not chmod an existing dir. README’s `sudo mkdir`
      does not survive reboot. Fix: tmpfiles `d /run/nero/w 0750 root caddy`,
      or `RuntimeDirectory=` + `RuntimeDirectoryMode=0750` + `Group=caddy`.
      Shipped in `538f575`: deploy/tmpfiles/nero-host.conf (created at boot),
      the unit self-heals the same mode in ExecStartPre, and the proxy hub
      chmods on every bind with loud chown failures.

### P2

- [ ] **Privileged guest is host root, and README omits it.** `--privileged`
      is in `flags.go:63`. The unit file admits a guest escape is host root
      (`deploy/nero-host.service:17-19`); `deploy/README.md`’s docker block
      does not list `--privileged`. Chromium runs `--no-sandbox`. Combined
      with the P1 secret leak, the coding agent is a privileged container
      holding the host token. Also: `NERO_HOST=0.0.0.0`
      (`nero-daemon.service:22`) and a **shared** `NERO_ACCESS_TOKEN` mean
      workspace A can hit B:8787 if it can reach the published port (trivial
      once privileged). Fix: drop `--privileged` for `--cgroupns=host` +
      explicit caps if possible; private networks; per-workspace access
      tokens; document the threat model.
- [x] **Attachment RPC persist skipped the id check.** HTTP/delete validate
      `^[A-Za-z0-9]{4,64}$` (4ecfb70). `persistIncomingAttachment` /
      `writeAttachmentDataUrl` (`daemon.ts:1232-1239,1576-1579`) still
      `Path.join(dataDir, "attachments", id)` the client-supplied id.
      `../orchestration.json` (or anything the daemon user can write) is
      writable from `thread.turn.start`.
- [ ] **`NERO_ACCESS_TOKEN` is also a pairing password.**
      `acceptPairingCredential` treats the host-wide access token as a valid
      pairing secret (`daemon.ts:531-535`), minting administrative sessions
      via `/oauth/token` and `/api/auth/browser-session` (`http.ts:220-287`).
      From inside the guest, `curl localhost:8787` bypasses Caddy. Combined
      with guest.env, the agent mints daemon sessions. `pairingLinks()` also
      **returns the credential** (`daemon.ts:556-571`).
- [x] **`/internal/caddy-auth` is published on `grogan.dev`.** That vhost is a
      blanket reverse_proxy (`Caddyfile:45-47`). Caddy is always loopback to
      `:8080`, so `RemoteLoopback` (`caddy.go:22-25`) passes. An authenticated
      GET returns `X-Nero-Access` to the client. PLAN topology is landing +
      AuthKit only; create/wake/delete are also live on `grogan.dev`. Fix:
      do not proxy `/internal/*` (or `/api/workspaces*`) on `grogan.dev`;
      require a Caddy-to-host secret header on caddy-auth.
- [x] **Pin/unpin race stretches idle to zombie grace.** `pin()` is an
      in-flight `fetch`; hide/unmount `sendBeacon`s `{connected:false}`
      without aborting the pin (`_chat.tsx:84-99`, `neroHost.ts:190-198`). A
      late `true` leaves `Connected=true` with the interval skipping hidden
      tabs → 20 min zombie, not 5 min disconnect. Also verify `sendBeacon` +
      `Blob type: application/json` — that content-type is a known silent
      failure, which would make close-tab never unpin. Distinct from “first
      pin while already hidden” (§8 P3).
- [x] **Create can still land on a queued workspace.** `29d96a2` wakes before
      navigate for `/` and the switcher row. First-run create
      (`_chat.index.tsx:110-111`) and switcher create
      (`WorkspaceSwitcher.tsx:183-186`) `location.assign` without checking
      `state`. Host create may return `queued` (`landlord.go:371-377`);
      heartbeat does not start Docker.
- [x] **`isNeroRunCommand` is `/\bnero-run\b/` on the whole string**
      (`tools.ts:233-247,299-307`). Any command that _mentions_ `nero-run`
      skips process-group kill on abort **and** timeout, so
      `sleep 9999; nero-run true` outlives interrupt. Parse argv; only skip
      when the invocation **is** `nero-run`.
- [ ] **ZFS chown failure orphans a dataset with no landlord row.**
      `CreateDataset` `zfs create` then `os.Chown`; chown error is returned
      **without** `zfs destroy` (`docker.go:102-113`). Create never inserts
      the workspace (`landlord.go:149-151`). Distinct from the tracked
      tryStart orphan. Not API-deletable.
- [x] **`tightenSocket` swallows `Chown` errors.** Related to the tracked
      group-lookup skip (`proxy.go:93-96`): even after a successful `caddy`
      lookup, `_ = os.Chown(...)` (`proxy.go:101`) can leave `root:root 0660`
      sockets Caddy cannot use (silent 502). Treat chown failure as bind
      failure.
- [ ] **Git option-injection via leading `-`.** `spawnSync` avoids a shell,
      but refs/URLs are still argv: `git branch <refName>`, `git switch`,
      `git clone <remote> <dest>`, `git diff <baseRef>`
      (`git.ts:259-288,503-546,601-616`). `reviewDiffFileContents`
      `Path.join(cwd, filePath)` follows `../`. Reject operands starting with
      `-`; `resolveContained` every path; `--` before refs.
- [x] **`NERO_HOST_TOKEN` is not required in `AuthReady`.** Empty token →
      `hostTokenOK` is false (`server.go:282-294`) → job-heartbeat 401 →
      turns and jobs silently do not pin. Deploy README lists it; boot
      succeeds without it (`config.go:57-80`).
- [ ] **`NERO_HOST_URL` is hardcoded `http://host.docker.internal:8080`**
      (`flags.go:68`). Binding `127.0.0.1:8080` as README advises breaks
      `nero-run` (docker0 cannot reach host loopback). Binding `:8080`
      publishes list/create/wake/stop/heartbeat/job-heartbeat on the public
      IP (session still required; job-heartbeat is the shared host token).
      Make listen address + `NERO_HOST_URL` a pair; firewall 8080 to
      loopback+docker0.
- [ ] **Daemon browser-session cookie has no `Secure`.** `http.ts:244-248`:
      `httpOnly` + `sameSite: "lax"` only. Pairing is a dead path through
      Caddy today, but the cookie is still minted.
- [x] **`nero-run` resource `-p` probe can disable all job limits.** Probe
      `systemd-run -p MemoryHigh=48G … -- true` on failure **clears all job
      `-p`** (`guest/nero-run:41-50`). User manager in Docker often rejects
      those properties. Slice `MemoryMax=64G` may also be inert without
      `Delegate=`. Jobs then only have the (possibly wrong) container
      `memory.max`.

### P3

- [x] `pingDaemonHealthz` allocates a new `http.Client` per ping
      (`docker.go:295-301`). Each 200ms health wait (up to `opTimeout`)
      creates a Transport and keeps idle conns. FD spike while `opMu` is held.
- [ ] `searchProjectContents` compiles a client-supplied regex per line
      (`files.ts:250-254,335-341`) — ReDoS hangs the daemon event loop.
- [ ] `browseFilesystem` / `listProjectEntries` take client `cwd` with no
      workspace-root containment (`files.ts:50-53,361-399`) — UI can list
      `/etc/nero`.
- [ ] `auth.md` is a “humans only, no tokens” skill, not WorkOS agentic
      registration (no PRM JSON, no ID-JAG, Bearer ignored —
      `apps/host/authmd/auth.md:5-72`) while 401 still emits
      `Bearer resource_metadata="https://nero.grogan.dev/auth.md"`
      (`server.go:328-330`). Fine for one-human v1; not PLAN’s “agentic
      registration” sentence.
- [x] The model path was the retired third-party middleman with a Baseten pin;
      live notes already routed Z.ai directly. Superseded by the Nero Router
      (§9) — PLAN.md, the daemon, and deploy all agree now (2026-08-29).
      edit. Extra `provider` field is ignored by Z.ai today.
- [ ] Unquoted `NERO_LABEL` as EnvironmentFile injection is **not** live:
      `validateName` limits names to a safe alphabet (`landlord.go:807-830`).
      The unquoted-write item in §8 P3 stays as latent for future free-text
      keys.

---

Laws that outlive the plan (do not violate while fixing): T3 copy is copy-and-map,
never rewrite; ALL model traffic routes through the Nero Router
(`apps/daemon/src/router/`) — Z.ai main, Baseten fast mode, OpenAI Pro / Grok
Heavy subscriptions; never reintroduce a third-party routing middleman, and
PLAN.md is the implementation source of truth (retired approaches are deleted
from it, not annotated); control plane stays landlord-only (no agent loop in
`apps/host`).

## 9. Nero Router bring-up — LIVE (2026-08-29)

Browser sweep 2026-08-29 (all surfaces, live): diff panel ✓ (after
Initialize Git — the "not a git repository" empty state was accurate; the
agent's git experiments hadn't survived its cleanup), terminal drawer ✓,
files browser + editor preview ✓, workspace asset routes ✓ (1.3MB PNGs),
favicons ✓, settings render ✓, workspace switcher ✓ (state badges,
actions menu), model picker/bolt/reasoning menu ✓. Fixed: dead
Open-logs-folder buttons in Diagnostics (silent no-op in web — removed).
Cataloged, not yet fixed: fresh drafts inherit the Diff right-panel
surface ("Select ref" on a threadless draft); agent-captured seat shots
render only via diff/files, not in the chat transcript; Diagnostics
still shows Electron-only telemetry rows (unavailable) — web conversion
candidate.

- [x] Z.ai route end-to-end on Grid-01 (2026-08-29): `ZAI_API_KEY`/`BASETEN_API_KEY`/
      `OPENCODE_API_KEY` in `/etc/nero/host.env`, daemon + image redeployed,
      GLM turns streaming live (coding endpoint).
- [ ] GLM speed entries: `glm-5.3-highspeed` is the native Z.ai variant;
      `glm-5.3-flash-fast` fakes Flash's missing fast tier by routing Flash
      through Baseten (`BASETEN_API_KEY`) with the Z.ai plan behind it.
      Confirm both route correctly and that Baseten serves no other chains.
- [ ] **PLAN↔catalog drift in the model path — needs a plan decision (found by
      the docs-consistency validation pass):**
      (a) PLAN's selector label says the Speed entry routes
      `Z.ai Highspeed → Baseten`, but the shipped `glm-5.3-highspeed` chain is
      Z.ai → Z.ai PAYG only (the flash-fast-via-Baseten bolt is a separate
      toggle on the Flash entry). One of PLAN or the catalog is wrong.
      (b) PLAN contradicts itself on Baseten: "routed only when the user
      explicitly picks the fast model — never an automatic fallback" vs
      "fallback order: … → Baseten (GLM chains only)". The code implements the
      fallback-order reading (Baseten is the third leg of the default GLM
      chain, reached without a user pick) while `baseten.ts` comments claim
      the explicit-pick reading. Changing the fallback policy requires a plan
      change per the out-of-scope law; until then pick which sentence dies.
      (c) PLAN names a `glm-5.3` (text-only) model the curated catalog never
      offered — delete the sentence or add the entry.
- [x] Codex (OpenAI Pro): tokens borrowed from the local Codex CLI via
      `POST /api/router/codex/import`; `gpt-5.6-sol` streamed a live turn.
      Callback registration + first browser login still pending (import path
      works today; refresh rotation will eventually require the real flow).
- [x] Grok: CLI auth.json imported with `oidc_client_id` (the token endpoint
      400s without it — fixed in the store), OIDC refresh verified live,
      `grok-4.6` streamed. Heavy availability rides the subscription session.
- [ ] Composer fast-mode toggle (post-plan §2 UI): the fast model is selectable
      in the picker; the dedicated composer toggle is still UI work.
- [ ] OpenCode Zen route: inject `OPENCODE_API_KEY` (opencode.ai/auth billing),
      confirm all three Zen transports stream with tools — chat/completions
      (`kimi-k3`, `deepseek-v4-pro`, `gemini-3.7-flash`), Responses
      (`gpt-5.6-sol`, `grok-4.6`), Anthropic messages (`claude-fable-5`).
      Gemini's endpoint path on Zen is the least documented of the three —
      verify first. Go subscribers set `OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1`.
- [ ] Curated catalog (2026-08-29): the selector is latest-only per family
      (GLM/Kimi/Gemini/Claude/Grok/DeepSeek/GPT) with routing in the label and
      subscription-first chains; models.dev metadata vendored at
      `router/modelsdev.json`. Refresh the snapshot when new generations land
      (add, never accumulate).
