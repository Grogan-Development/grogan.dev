# Nero audit issues tracker

Defects, deviations, and debt found while auditing PLAN.md against the branches.
Re-baselined to **main @ `5afbd24`** after the pass-3 sweep (2026-08-28) — v1 is
implemented and merged; this is now the post-v1 defect list. Fixed items are
checked with the commit that closed them. Roadmap work lives in
`docs/post-plan.md`.

Sweep tally: ~28 open, 6 partial.

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
- [x] Workspace management UI — host-API picker, create/wake/stop, heartbeat
      watcher; project abstraction being replaced by a sidebar workspace switcher
      dialog (restructure in flight).
- [ ] **v1 acceptance verification pass — partially done live** (2026-08-29,
      Grid-01): TLS + ACME ✓; AuthKit fail-closed 401s ✓; create/wake/stop ✓;
      GLM turn via bash tool ✓ (Z.ai coding endpoint, plan quota); thread
      persistence across daemon reboot ✓; KasmVNC seat `noVNC_connected` through
      Caddy ✓; idle-stop reaped an unpinned workspace live ✓ (works as designed).
      Still unverified: `nero-run` >32 GiB survival, third-wake FIFO queue under
      real pressure, guest image memory.high cgroup writes under load.

## 1. Process / repo hygiene

- [x] Merge to main (c52a2d6 + 5afbd24 integrate all ten PRs' content).
- [x] CHECKLIST.md removed from main.
- [ ] **Stale branches.** `execute-plan/…pr-1/2/3` are empty and `pr-4`–`pr-9`
      carry mislabeled subsets; main is the integrated history now. Archive/delete.

## 2. T3-skin remnant cleanup (PR 5 leftovers)

Law: "After adapt there is no T3 product left." Survivors at main:

- [ ] `ThreadWorktreeIndicator` rendered — `apps/web/src/components/Sidebar.tsx:152,1569`,
      `LegacySidebar.tsx:791`.
- [ ] `composerDraftStore` persists `worktreePath`/`envMode` (`composerDraftStore.ts:221-223`);
      `BranchToolbar.logic.ts:16` EnvMode helpers.
- [ ] Five driver kinds in contracts (`packages/contracts/src/model.ts:130-131`);
      `codex`/`claudeAgent` branches in ChatView; `ProviderModelPicker`/`TraitsPicker`.
- [ ] Settings remnants — `SettingsPanels.tsx:283,340,1509`; `planModeEnabled`
      (`ChatView.tsx:1622`); `LegacySidebar` still mounted
      (`AppSidebarLayout.tsx:18,141`).
- [ ] `server.updateServer*` stubs (`apps/daemon/src/rpc.ts:79-83`) — no UI
      callers remain; delete.
- [ ] Delete-listed files still present: `desktopAuth.ts`, `desktopLocal.ts`,
      `useT3ProjectFileScripts.ts`, `t3ProjectFileDefaults.ts`
      (`useDesktopLocalBootstraps.ts`, `wslPaths.ts` already gone).
- [ ] Electron preview-guest files (`ElectronBrowserHost.tsx`, `usePreviewBridge.ts`).
- [ ] `remoteDpopTokens` fixture (`connection/storage.test.ts:15`) — stale DPoP
      comments already gone.
- [ ] `@t3tools/*` package names (4 package.json + client-runtime).
- [ ] `/.well-known/t3/environment` (`apps/daemon/src/http.ts:105`).

## 3. Daemon contract cleanup

- [x] `getTurnDiff`/`getFullThreadDiff` — wired to `checkpoints.rangeDiff`
      (`daemon.ts:1792-1813`).
- [ ] Plan-DELETEd RPC stubs still advertised (`rpc.ts:78-119`): `getSettings`,
      `updateServerWithProgress`, `cloud.*`, `getUsageSummary`,
      `reportHostPowerState`, `getBackgroundPolicy`. Typed rejection is not deletion.
- [ ] gh/PR RPCs — `git.ts:485-495` throw; `pullRequests.*` stubs (`rpc.ts:133-148`).
- [ ] assets/attachments backing routes for minted `/api/assets/*`,
      `/api/attachments/*` URLs.
- [ ] `getWorkflowScript` always not-found (`rpc.ts:395`) — implement or delete.
- [ ] `UsagePage` (`apps/web/src/components/usage/UsagePage.tsx`) — design a Nero
      usage contract or delete.

## 4. Security & config hardening

- [x] Daemon trust contract — explicit and fail-closed: host mints
      `X-Nero-Access` after AuthKit check (`apps/host/internal/api/caddy.go`),
      daemon accepts `x-nero-access`/bearer/cookie and strips it before Kasm
      (`daemon.ts:388-410`) (5afbd24).
- [ ] `NERO_DEV_BYPASS=1` still unguarded (`config.go` env check; `AuthReady`
      returns nil on bypass). 5afbd24's fail-closed work covered access/host tokens
      only — add a public-host refusal.
- [ ] KasmVNC password hardcoded `"nero"` at build (`guest/Dockerfile`).
- [ ] `job-heartbeat` defaults `running=true` on empty body
      (`apps/host/internal/api/server.go:251-261`).
- [ ] `isHTTPS` — partial: loopback + `X-Forwarded-Proto` branch added
      (`session.go:227`); the `*.grogan.dev` domain heuristic remains (`:224`).

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
- [ ] Workspace datasets: no delete/destroy surface end-to-end (host has
      DestroyDataset internally only); add API + UI action later.

- [ ] Clerk catalog refs (23) in `pnpm-workspace.yaml`.
- [ ] `assets/` web-favicon sources from `00-copy-set.md` never copied (cosmetic).
- [ ] `debian:trixie` base unpinned (deliberate deferral).
- [ ] `nero-run` user-slice placement is by design, but heartbeat → idle-stop →
      wake needs the runtime verification pass to prove.

---

Laws that outlive the plan (do not violate while fixing): T3 copy is copy-and-map,
never rewrite; the OpenRouter-Baseten pin is v1 law only — its retirement is
decided and recorded in `docs/post-plan.md` §1–2 (Nero Router + Z.ai/Baseten);
control plane stays landlord-only (no agent loop in `apps/host`).
