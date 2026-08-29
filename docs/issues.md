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
  501 removed (c52a2d6).
- [x] Daemon in the guest image — multi-stage Dockerfile builds `@nero/daemon`,
  `nero-daemon.service` enabled (c52a2d6).
- [x] Secret injection — `OPENROUTER_API_KEY`/`NERO_HOST_TOKEN` via docker env +
  `guest/export-container-env` → `/etc/nero/guest.env` (c52a2d6).
- [ ] **Keep-awake bridge — partial.** `nero-run` now heartbeats the host
  (`{"running":bool}` every 30s, final false on exit — 5afbd24), but a **live
  agent turn** still only writes `keep-awake.json`
  (`apps/daemon/src/daemon.ts:1483`); nothing in the daemon sets the host's
  `AgentWorking` bit.
- [ ] **Workspace picker — partial.** "Choose a workspace" list exists in the
  skin but reads `useEnvironments` (daemon ws); there is no `/api/workspaces`
  caller in `apps/web/src`, so the first workspace is API-only
  ("create from the host control plane").
- [ ] **v1 acceptance verification pass** (runtime): ACME/TLS + Caddy reload;
  unix-socket caddy-group perms; forward_auth through real AuthKit; guest image
  build (node-pty spawn-helper); live KasmVNC session; OpenRouter streaming with
  injected key; heartbeat → idle-stop → wake cycle; 64GiB Blender job; third-wake
  queue on Grid-01; WorkOS dashboard state.

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
