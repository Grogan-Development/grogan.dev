# Nero v1

Pi-shaped coding workspaces on Grid-01, wearing a copied-and-adapted T3 Code web skin. One human (you). Host: `grid-01` (`104.238.222.91`). Sites: `grogan.dev` (landing + AuthKit start) → `nero.grogan.dev` (workspaces).

This file is the source of truth for implementation. File-level UI/RPC work follows `docs/research/t3-nero-map/`. Lifecycle/cgroup work follows `docs/research/workspace-lifecycle.md`. Do not invent a second architecture.

**Law for T3:** copy the listed tree, then apply the change maps. Do not rewrite the UI. Do not copy T3 server. After adapt there is no T3 product left (Connect, five harnesses, Clerk, self-update, T3 branding).

---

## Locked product

| Decision      | v1                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Guest         | Docker container + ZFS dataset on pool `grid`. Debian 13, systemd.                                                                       |
| Stickers      | 32 GiB / 8 vCPU = label + warning + CPU shares. Not a reservation.                                                                       |
| Hard memory   | `memory.max` ≈ 64 GiB, `memory.high` ≈ 48 GiB, `memory.min/low` = 0, no swap.                                                            |
| CPU           | `cpu.weight` / `--cpu-shares`. No `--cpus`.                                                                                              |
| Keep-awake    | UI connected **or** live agent turn **or** `nero-run` job (systemd scope). Stray processes do not pin.                                   |
| Scale-to-zero | `docker stop`. Disk lives. Cold start is fine. ~5 min after disconnect, ~20 min zombie tab.                                              |
| Admission     | FIFO for create/wake/job. ~two awake workspaces (`64G × n + ~24G` host reserve). Never host OOM.                                         |
| Occupancy     | You: T3 files / terminal / chat. Agent: one virtual seat (Chromium + Blender).                                                           |
| Preview       | **KasmVNC** of that seat, embedded in T3’s preview tab, **interactive**. You drive → agent `click`/`type` queue.                         |
| Harness       | Pi-like: bash + files. Seat CLI: `shot` / `click` / `type` / `key`. No memory system.                                                    |
| Threads       | User ↔ harness chats. Shared cwd. No worktree product. Many live threads. Transcripts on the workspace dataset.                          |
| Daemon        | **Inside each workspace.** Caddy: `nero.grogan.dev/w/:id/` → that process (`/ws`, PTY, files, seat, KasmVNC, GLM).                       |
| Host          | Landlord only: AuthKit session, create/stop/queue, cgroups, Caddy.                                                                       |
| Auth (you)    | WorkOS AuthKit. grogan.dev portal → session on nero.grogan.dev.                                                                          |
| Auth (agents) | Nero publishes WorkOS [auth.md](https://github.com/workos/auth.md) at `https://nero.grogan.dev/auth.md`.                                 |
| Model         | The **Nero Router** (below): Z.ai main (coding plan), Baseten fast mode, OpenAI Pro and Grok Heavy subscriptions. GLM-5.3-Flash default. |
| Deferred      | Video/audio judge, models.dev catalog integration, per-provider shopping.                                                                |

Batteries in the image: official Blender tarball, Chromium, KasmVNC, compositor for the seat, Nero daemon. No Docker-in-Docker in v1. No GPU (llvmpipe).

---

## Model path — the Nero Router

All model traffic goes through Nero's own router (`apps/daemon/src/router/`).
No third-party router, no middleman: the daemon talks to each provider
directly, and Nero owns the model catalog and the fallback policy.

- **Z.ai (main):** GLM Coding Plan, endpoint `https://api.z.ai/api/coding/paas/v4`
  (the coding endpoint is what spends plan quota — the generic `/api/paas/v4`
  burns pay-as-you-go and is only a fallback after quota errors). Auth
  `ZAI_API_KEY`. Models `glm-5.3-flash` (default, multimodal) and `glm-5.3`
  (text-only).
- **Baseten (fast mode):** `https://inference.baseten.co/v1`, model
  `zai-org/GLM-5.3-Flash`, auth `BASETEN_API_KEY`. Per-token spend; routed
  only when the user explicitly picks the fast model — never an automatic
  fallback.
- **OpenAI Pro (Codex subscription):** OAuth PKCE against auth.openai.com
  (public Codex client id), Responses transport at
  `chatgpt.com/backend-api/codex`. Tokens live in the daemon's own store on
  the workspace dataset — never in a shared local CLI file.
- **Grok Heavy (xAI OIDC):** the Grok Build auth path (first-party, open
  source). Import the Grok CLI's `~/.grok/auth.json` into the daemon token
  store; refreshes via OIDC discovery on the issuer.
- Fallback order: Z.ai plan quota → Z.ai PAYG on quota/rate errors → Baseten
  only when picked. Subscription models route to their own provider only.
- One `ServerConfig.providers` row: `driver` / `instanceId` = `nero`; the
  model picker lists the router catalog (`glm-5.3-flash` default, `glm-5.3`,
  `glm-5.3-flash-fast`, plus `grok-4.6` / `grok-4.5` / `codex` once their
  subscription is signed in).

Agent seat images (`shot`, ≤8 per turn) attach as inline image parts on the
Z.ai/Baseten requests.

---

## Topology

```
Browser  →  Caddy on Grid-01
              grogan.dev          landing + AuthKit start
              nero.grogan.dev     skin + control plane
                /                 workspace picker (AuthKit)
                /w/:id/           reverse proxy → workspace Nero daemon
                /auth.md          agentic registration
                /ws (per workspace, same origin under /w/:id)

Workspace container
  Nero daemon     /ws + Pi loop (Nero Router) + seat CLI
  KasmVNC         agent seat (Chromium, Blender)
  Ghostty PTY     via daemon (WASM client is in the skin)
  ZFS dataset     home, /nero/threads, ~/.nero
```

Control plane on the host does **not** run the agent loop. It creates datasets/containers, applies cgroups, queues wakes, and checks AuthKit.

---

## T3 skin

Upstream pin: `pingdotgg/t3code` `0009aacdf146e0532327fa3d9d0109d5adca68b9`.

**Copy:** `apps/web`, `packages/client-runtime`, `packages/contracts`, needed `packages/shared` (see `docs/research/t3-nero-map/08-shared.md`), `native/libghostty-vt`, vite-plus/`vp` workspace roots (`00-copy-set.md`, `11-build.md`).

**Do not copy:** `apps/server`, desktop, mobile, marketing, `infra/relay`, `effect-acp`, `effect-codex-app-server`, `ssh`, `tailscale` (`09-do-not-copy.md`).

**Adapt (mandatory, not optional stubs):**

- Routes: `/w/:workspaceId/:threadId` (`03-web-shell-auth-env.md`)
- One `nero` provider (`07-settings-providers.md`)
- Shared cwd; delete worktree-first-send chrome (`04`, `05`)
- Replace empty “preview is desktop-only” with KasmVNC client (`06`)
- Delete Connect / Clerk / DPoP / self-update / `npx t3` version skew
- Implement every RPC the **adapted** UI still calls (`01-contracts-rpc.md`). Delete an RPC only with the UI that called it.

Any PR that “ports the sidebar” or reimplements ChatView from scratch is out of spec.

---

## Implementation order

Do these in order. Each step should leave the previous one still true.

### 1. Host landlord

Caddy: TLS for `grogan.dev`, `www.grogan.dev` (redir), `nero.grogan.dev`. WorkOS AuthKit redirect URIs for both app hosts. Minimal grogan.dev landing with a portal control that starts AuthKit.

ZFS datasets per workspace under `grid`. Docker: Debian 13 image, cgroup v2 as in `workspace-lifecycle.md`. Control plane API: create / stop / wake / list / admission FIFO. `docker stop` on idle. `nero-run` is a scope in the guest; host only needs “job still running” via a guest heartbeat or a labeled process.

### 2. Guest image

systemd, official Blender, Chromium, seat compositor, KasmVNC, seat CLI (`shot`/`click`/`type`/`key`), `nero-run`. Nero daemon binary/service. Dataset mount at home. No T3 server.

### 3. Copy T3 web tree

Vendor the copy-set at the pinned SHA. `vp` build of `@t3tools/web` against a stub `/ws` is enough to prove the tree compiles **before** behavior. Then apply maps 02–10: branding, routes, provider row, delete Connect.

### 4. Nero daemon (`/ws`)

Implement the RPC tables in `01-contracts-rpc.md` against the container FS, PTY, git (`gh` for PR RPCs), and the Pi loop. Bearer ticket / AuthKit session forwarded from Caddy. Snapshots on the workspace dataset.

### 5. Seat + preview

One seat. KasmVNC in the adapted preview tab, interactive. Chromium + Blender on that display. Seat CLI serialized with human VNC input (human driving → agent click/type queue).

### 6. Harness

One GLM loop per live thread. Tools: bash, read/write/edit files, seat CLI via bash. Stream through the Nero Router (Z.ai main, Baseten fast mode, OpenAI Pro / Grok Heavy subscriptions). Attach `shot` PNGs on the next turn (≤8). `nero-run` holds keep-awake.

### 7. auth.md

Publish `https://nero.grogan.dev/auth.md` per WorkOS agentic registration. Humans still only use AuthKit.

---

## Acceptance (v1)

- AuthKit login on grogan.dev lands on nero.grogan.dev.
- Create a workspace; it is a container + dataset; it stops after idle and wakes with the same disk.
- Open a thread; GLM-5.3-Flash streams through the Nero Router (Z.ai primary; Baseten only on the explicit fast model).
- Files, terminal (Ghostty), diffs work in the copied skin.
- Preview tab is a real KasmVNC session of the agent seat (mouse/keyboard), not a video element and not an iframe of localhost.
- Second thread shares cwd; worktree UI is gone.
- A `nero-run` Blender job can exceed 32 GiB without being killed at 32; a third concurrent wake queues instead of OOM-killing the host.
- No T3 Connect, no Codex/Claude/Cursor/Grok/OpenCode, no T3 server process.

---

## Out of scope (v1)

Video/audio capture and judge, Docker-in-Docker, T3 desktop/mobile, multi-user AuthKit directory, GPU, changing the router provider/fallback policy without a plan change.

---

## PR Plan

Repo layout (do not invent a second tree):

```
apps/web                 # copied T3 skin
apps/daemon              # Nero /ws + Pi loop (guest)
apps/host                # landlord API (Grid-01)
packages/contracts
packages/client-runtime
packages/shared
guest/                   # Dockerfile, seat CLI, systemd units, nero-run
deploy/                  # Caddyfile, host systemd, ZFS helpers
docs/research/           # already present; do not rewrite
```

### PR 1: Host landlord

- **Description:** Control plane on Grid-01: Caddyfile for grogan.dev / www / nero.grogan.dev, ZFS dataset create/destroy under `grid`, Docker create/start/stop/wake with cgroup flags from `docs/research/workspace-lifecycle.md`, admission FIFO (~two awake), idle `docker stop`, workspace list API. Minimal grogan.dev landing HTML with portal button (AuthKit URL from env). No agent loop.
- **Files/components affected:** `apps/host`, `deploy/Caddyfile`, `deploy/nero-host.service`, `deploy/README.md`
- **Dependencies:** None

### PR 2: Guest image and seat CLI

- **Description:** Debian 13 Dockerfile: systemd, Chromium, official Blender tarball, seat compositor, KasmVNC, `nero-desktop` CLI (`shot`/`click`/`type`/`key`), `nero-run` (systemd-run --scope under `nero-job.slice`). Dataset mount at `/home/nero`. No T3 server. Daemon binary copied in later PRs.
- **Files/components affected:** `guest/Dockerfile`, `guest/seat/`, `guest/systemd/`, `guest/nero-run`
- **Dependencies:** None

### PR 3: Vendor T3 web copy-set

- **Description:** Copy `apps/web`, `packages/client-runtime`, `packages/contracts`, needed `packages/shared`, `native/libghostty-vt`, vite-plus workspace roots from `pingdotgg/t3code` SHA `0009aac`. Follow `docs/research/t3-nero-map/00-copy-set.md` and `09-do-not-copy.md`. `vp` build of `@t3tools/web` must succeed. Do not rewrite UI in this PR.
- **Files/components affected:** `apps/web`, `packages/*`, `native/libghostty-vt`, `pnpm-workspace.yaml`, `package.json`, `vite.config.ts`
- **Dependencies:** None

### PR 4: Nero daemon `/ws`

- **Description:** Guest daemon implementing adapted T3 contracts (`docs/research/t3-nero-map/01-contracts-rpc.md`) against container FS, PTY, git/`gh`. Bearer ticket from Caddy/AuthKit. Snapshots under `/home/nero/.nero`. One provider row `nero`. No five harnesses.
- **Files/components affected:** `apps/daemon`, `guest/systemd/nero-daemon.service`
- **Dependencies:** PR 2, PR 3

### PR 5: T3 skin adapt

- **Description:** Apply maps 02–10: `/w/:workspaceId/` routes, Nero branding, delete Connect/Clerk/DPoP/self-update/worktree-first-send, single `nero` provider. Do not reimplement ChatView. Preview tab still a placeholder until PR 7.
- **Files/components affected:** `apps/web`, `packages/client-runtime`
- **Dependencies:** PR 3

### PR 6: AuthKit landing

- **Description:** WorkOS AuthKit on grogan.dev portal and nero.grogan.dev. Session cookie. Control plane rejects unauthenticated create/wake. Redirect URIs documented in `deploy/README.md`.
- **Files/components affected:** `apps/host`, `deploy/`, grogan.dev landing
- **Dependencies:** PR 1

### PR 7: Seat KasmVNC in preview tab

- **Description:** Interactive KasmVNC of the agent seat in the adapted T3 preview panel (replace desktop-only empty state). Human VNC input queues agent `click`/`type`. Chromium+Blender on that display.
- **Files/components affected:** `apps/web` preview, `guest/seat`, `apps/daemon` preview RPCs
- **Dependencies:** PR 4, PR 5

### PR 8: Pi harness + Nero Router

- **Description:** One GLM loop per live thread. bash + file tools. Stream the router catalog through `apps/daemon/src/router/` (Z.ai main → PAYG fallback; Baseten fast model; OpenAI Pro / Grok Heavy subscription routes with their OAuth/OIDC token store). Attach `shot` images (≤8). `nero-run` keep-awake.
- **Files/components affected:** `apps/daemon`
- **Dependencies:** PR 4

### PR 9: auth.md

- **Description:** Serve WorkOS agentic `auth.md` at `https://nero.grogan.dev/auth.md`. Humans still AuthKit-only.
- **Files/components affected:** `deploy/`, `apps/host`
- **Dependencies:** PR 1, PR 6

### PR 10: Wire Caddy to workspaces

- **Description:** `nero.grogan.dev/w/:id/` reverse-proxy to the guest daemon. Idle/admission end-to-end. Image installs daemon from PR 4.
- **Files/components affected:** `deploy/Caddyfile`, `apps/host`, `guest/Dockerfile`
- **Dependencies:** PR 1, PR 4, PR 5, PR 7, PR 8
