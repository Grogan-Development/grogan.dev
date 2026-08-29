# Nero host (Grid-01)

Landlord + Caddy: AuthKit session, workspace create/stop/wake/queue, cgroups, reverse-proxy into each workspace daemon. No agent loop on the host.

Sites:

- `https://grogan.dev` — landing + AuthKit start
- `https://nero.grogan.dev/` — adapted web (workspace picker / skin)
- `https://nero.grogan.dev/w/:id/` — skin + reverse_proxy to that workspace’s Nero daemon (`/ws`, `/vnc`, `/api`, …)

## Grid-01 bring-up

One-time on the box (`grid-01`, `104.238.222.91`). Repo checkout at `/opt/nero` (or equivalent).

### 1. Secrets (`/etc/nero/host.env`)

```bash
sudo install -d -m 0755 /etc/nero
sudo install -m 0600 /dev/null /etc/nero/host.env
```

Fill (never commit this file):

```
NERO_LISTEN=:8080
WORKOS_API_KEY=...
WORKOS_CLIENT_ID=...
WORKOS_AUTHKIT_URL=https://api.workos.com/user_management/authorize
WORKOS_COOKIE_PASSWORD=  # openssl rand -base64 32  (≥32 chars)
NERO_ALLOWED_EMAILS=you@grogan.dev
NERO_HOST_TOKEN=         # openssl rand -hex 32  (guest job-heartbeat)
NERO_ACCESS_TOKEN=       # openssl rand -hex 32  (required; Caddy → guest as X-Nero-Access)
ZAI_API_KEY=             # Nero Router: Z.ai GLM Coding Plan (main route)
BASETEN_API_KEY=         # Nero Router: Baseten (GLM chains only)
OPENCODE_API_KEY=        # Nero Router: OpenCode Zen (GPT/Grok fallback; primary for Claude/Kimi/Gemini/DeepSeek)
OPENCODE_BASE_URL=       # optional; Go subscribers: https://opencode.ai/zen/go/v1
NERO_GUEST_IMAGE=nero-guest:v1
NERO_ZFS_POOL=grid
NERO_WS_MOUNT=/var/lib/nero/ws
NERO_SOCK_DIR=/run/nero/w
NERO_IDLE_TICK=10s
```

`ZAI_API_KEY`, `BASETEN_API_KEY`, and `NERO_ACCESS_TOKEN` are docker `--env` at create. They are not in git and not in the image.

### 2. Build host + web + guest image

```bash
cd /opt/nero

# landlord
( cd apps/host && go test ./... && go build -o nero-host ./cmd/nero-host )
sudo install -m 755 apps/host/nero-host /usr/local/bin/nero-host

# adapted skin → Caddy file_server
pnpm install --frozen-lockfile
pnpm --filter @t3tools/web build
sudo install -d -m 0755 /var/lib/nero/web
sudo rsync -a --delete apps/web/dist/ /var/lib/nero/web/

# guest (daemon binary is built in the image; systemd enables nero-daemon.service)
sudo docker build -t nero-guest:v1 -f guest/Dockerfile .
```

ZFS parent dataset (once): `sudo zfs create -p -o mountpoint=/var/lib/nero/ws grid/nero`

### 3. Caddy + landlord unit

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo cp deploy/nero-host.service /etc/systemd/system/nero-host.service
sudo cp deploy/tmpfiles/nero-host.conf /etc/tmpfiles.d/nero-host.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/nero-host.conf
sudo mkdir -p /run/nero/w /var/lib/nero/ws
sudo systemctl daemon-reload
sudo systemctl enable --now nero-host
sudo systemctl reload caddy
```

The tmpfiles entry creates `/run/nero/w` as `root:caddy 0750` **at every boot** — `/run` is tmpfs, and without it a reboot leaves the dir root-only (the unit's `UMask=0077`), 502ing every workspace route. `nero-host.service` self-heals the same mode at start; the unit's `ExecStartPre` lines and the tmpfiles entry are redundant on purpose.

Caddy reverse-proxies to `/run/nero/w/<id>.sock` (group `caddy`, mode `0660`). Create/wake wait until that workspace’s `:8787` `/healthz` answers.

## Loom (git/repo server, dedicated to Nero)

`loomd` runs on Grid-01 as a container, bound to the docker bridge only (never
the public interface): `172.17.0.1:8088` → container `:8080`. Data lives in
`/opt/loom/data` (on the `grid/opt` dataset). The owner token is in
`/opt/loom/loom.env` (`0600`); workspaces get a **scoped** token
(`git/features/events/evidence/review` perms on `nero/grogan-dev`), passed via
`LOOM_URL`/`LOOM_TOKEN` in `host.env` → guest env → `export-container-env`.
The owner token never enters a workspace.

- Source: `github.com/Grogan-Development/loom` (public; release artifacts for
  the guest CLI installer live there).
- Build + run on Grid-01: clone to `/opt/loom/src`, `docker build -t loom:local .`,
  then the `docker run` above (mirror the `git config --system
init.defaultBranch main` line from the image).
- `loom.grogan.dev` DNS does not exist yet; the daemon path does not need it
  (`host.docker.internal:8088` from containers). When DNS is added, front it
  with the host Caddy and switch `LOOM_URL` to the public URL.
- Git gotcha (upstream bug, filed): repos imported over https have **no
  git_oid mapping**, so every `/git/` request 503s until a git push exists.
  Seed a repo by cloning it empty, pushing one commit to
  `refs/heads/workspaces/init`, then `POST /loom/v1/refs/bootstrap` with that
  `git_oid` (owner token).

### 4. WorkOS dashboard

Redirect URIs:

- `https://grogan.dev/auth/callback`
- `https://nero.grogan.dev/auth/callback`
- optional: `https://www.grogan.dev/auth/callback` (Caddy already redirs www → grogan.dev)

Initiate login URL: `https://grogan.dev/auth/login` (also valid: `https://nero.grogan.dev/auth/login`)

Sign-out redirect: `https://grogan.dev/` (this does not clear `wos-session`; use `/auth/logout`)

Authentication → **disable Sign up**. Set `NERO_ALLOWED_EMAILS` to the operator address.

Flow: grogan.dev portal → `/auth/login` → AuthKit hosted UI → `/auth/callback` (`grant_type=authorization_code`) → allowlist → `wos-session` cookie (`Domain=grogan.dev`, so `nero.grogan.dev` receives it) → `https://nero.grogan.dev/`.

## Workspace proxy mapping

Each workspace container’s Nero daemon listens on **:8787**. On create the landlord:

1. `docker create --publish 127.0.0.1::8787` (Docker picks a free loopback host port).
2. After start, inspects that port and:
   - caches `127.0.0.1:<port>` for Caddy
   - binds **`/run/nero/w/<id>.sock`** → `127.0.0.1:<port>` (same hop; fine to `curl --unix-socket`)

| Guest                | Host TCP                | Host unix               |
| -------------------- | ----------------------- | ----------------------- |
| `nero-ws-<id>` :8787 | `127.0.0.1:<ephemeral>` | `/run/nero/w/<id>.sock` |

Caddy reverse_proxies to `unix//run/nero/w/<id>.sock` (id from the `/w/:id` path, else `Referer`, else `nero-ws` cookie). `forward_auth` to loopback `GET /internal/caddy-auth` checks `wos-session` and sets **`X-Nero-Access`** (not `Authorization`) so KasmVNC HTTP Basic and Kasm cookies still reach `/vnc`. The guest hop strips only the `wos-session` cookie.

`nero-ws` is set with `Path=/w/<id>` and a `Path=/` fallback so origin-root `/ws` from the copied skin still routes. Two browser tabs on two awake workspaces can race the `Path=/` cookie; prefer `/w/:id/…` (the VNC iframe uses that prefix when the skin is on a workspace route).

Stopped / queued / not-yet-healthy workspaces: Caddy auth returns 503. Wake via `POST /api/workspaces/:id/wake`. Create/wake block until `/healthz` on the published port succeeds (or fail).

`nero-run` POSTs `/api/workspaces/:id/job-heartbeat` while the scope is alive (host is `host.docker.internal:8080`), authenticated with the **per-workspace derived token** the landlord injected at create: guests never hold `NERO_HOST_TOKEN` itself, only `HMAC-SHA256(secret, "nero-workspace-token:" + id)` — a leaked guest token authorizes this workspace's keep-awake bits and nothing else. The same derivation applies to `NERO_ACCESS_TOKEN`.

> **Upgrading from shared-token workspaces:** containers created before the derived-token change hold the raw secrets in their env. Their heartbeats and Caddy auth will 401 until each container is recreated (`docker rm nero-ws-<id>`, then create a replacement workspace — or delete + recreate the workspace outright; datasets are per-id). Afterwards, rotating `NERO_HOST_TOKEN`/`NERO_ACCESS_TOKEN` in `host.env` invalidates everything derived from the old values at once.

## Environment

Put values in `/etc/nero/host.env` (mode `0600`, **not in git**). systemd `EnvironmentFile=-/etc/nero/host.env`.

| Variable                  | Default                                            | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NERO_LISTEN`             | `:8080`                                            | Landlord HTTP bind                                                                                                                                                                                                                                                                                                      |
| `NERO_DEV_BYPASS`         | unset                                              | `1` skips auth. **Local tests only.** nero-host refuses to boot with it on a non-loopback listener, and it is never forwarded into guest containers.                                                                                                                                                                    |
| `WORKOS_API_KEY`          | empty                                              | User Management API key (`client_secret` on `authorization_code` exchange).                                                                                                                                                                                                                                             |
| `WORKOS_CLIENT_ID`        | empty                                              | AuthKit / User Management client id.                                                                                                                                                                                                                                                                                    |
| `WORKOS_AUTHKIT_URL`      | `https://api.workos.com/user_management/authorize` | Hosted UI start URL. `/auth/login` redirects here with `provider=authkit`.                                                                                                                                                                                                                                              |
| `WORKOS_COOKIE_PASSWORD`  | empty                                              | Seals the `wos-session` cookie. **≥32 characters.** `openssl rand -base64 32`. Without `NERO_DEV_BYPASS`, nero-host will not listen if this, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, or `NERO_ACCESS_TOKEN` is missing/short.                                                                                             |
| `NERO_ALLOWED_EMAILS`     | empty                                              | Comma-separated allowlist (v1: your email). Empty + no bypass **fail closed** (callback 403, APIs 401).                                                                                                                                                                                                                 |
| `NERO_HOST_TOKEN`         | empty                                              | Host secret from which per-workspace guest tokens are derived (`HMAC-SHA256(secret, "nero-workspace-token:" + id)`). The raw value **never enters a container**; it only authorizes derived tokens on `job-heartbeat`. Empty + no bypass → boot warns and that route 401s (workspaces idle-stop under live turns/jobs). |
| `NERO_ACCESS_TOKEN`       | empty                                              | **Required** unless `NERO_DEV_BYPASS`. Injected into guests as the per-workspace derived token; Caddy sends the matching `X-Nero-Access` (never overwrites `Authorization`). `openssl rand -hex 32`.                                                                                                                    |
| `LOOM_URL`                | empty                                              | Loom git/repo server (`https://loom.grogan.dev`). Injected into guests at create (`LOOM_URL`/`LOOM_TOKEN`); the FR/CI pages proxy through the daemon and 503 without it.                                                                                                                                                |
| `LOOM_TOKEN`              | empty                                              | Loom token with **scoped** git/features/events perms — never the owner token.                                                                                                                                                                                                                                           |
| `ZAI_API_KEY`             | empty                                              | Nero Router main route: Z.ai GLM Coding Plan (`glm-5.3-flash` default). Injected into guests at create. **Not in git.**                                                                                                                                                                                                 |
| `BASETEN_API_KEY`         | empty                                              | Nero Router fast mode (per-token). Optional; the fast model needs it. **Not in git.**                                                                                                                                                                                                                                   |
| `ZAI_BASE_URL`            | daemon default (Z.ai coding endpoint)              | Optional override for the Z.ai endpoint. Read from host env and forwarded into guests.                                                                                                                                                                                                                                  |
| `ZAI_PAYG_BASE_URL`       | daemon default (`/api/paas/v4`)                    | Optional override for the Z.ai pay-as-you-go fallback endpoint (daemon-side only).                                                                                                                                                                                                                                      |
| `BASETEN_BASE_URL`        | daemon default (`https://inference.baseten.co/v1`) | Optional override for the Baseten gateway (daemon-side only).                                                                                                                                                                                                                                                           |
| `NERO_MODEL`              | `glm-5.3-flash`                                    | Default model slug for new threads. Read from host env and forwarded into guests.                                                                                                                                                                                                                                       |
| `NERO_CODEX_REDIRECT_URI` | empty                                              | Callback for the OpenAI Pro (Codex) login flow, e.g. `https://nero.grogan.dev/w/{id}/api/router/codex/callback`. Without it the Codex route stays local-only.                                                                                                                                                           |
| `NERO_GUEST_IMAGE`        | `nero-guest:v1`                                    | Image from `guest/Dockerfile` (daemon + seat). `docker create` requires the image; failure rolls back the dataset.                                                                                                                                                                                                      |
| `NERO_ZFS_POOL`           | `grid`                                             | Datasets at `{pool}/nero/{id}`                                                                                                                                                                                                                                                                                          |
| `NERO_WS_MOUNT`           | `/var/lib/nero/ws`                                 | Bind-mounted at `/home/nero` in the container                                                                                                                                                                                                                                                                           |
| `NERO_SOCK_DIR`           | `/run/nero/w`                                      | Unix sockets `{dir}/{id}.sock`                                                                                                                                                                                                                                                                                          |
| `NERO_IDLE_TICK`          | `10s`                                              | How often the host reconciles idle stop                                                                                                                                                                                                                                                                                 |

WorkOS keys, allowlist, host token, access token, router keys (Z.ai, Baseten), and AuthKit cookie material belong in that env file — never in this repo.

In the WorkOS dashboard: **Authentication → disable Sign up** (email+password sign-up is on by default). v1 is one human; the app still fail-closes on `NERO_ALLOWED_EMAILS`.

Human `GET/POST /api/workspaces*` (list/create/wake/stop/heartbeat) requires a valid `wos-session` whose email is on the allowlist, unless `NERO_DEV_BYPASS=1`. Guest keep-awake is `POST /api/workspaces/:id/job-heartbeat` with the workspace's derived token (or `X-Nero-Host-Token`) — not the human cookie. `running`/`jobRunning` (the `nero-run` pin) and `agentWorking` (a live daemon turn) are independent: a field-specific update never touches the other pin, and a body with no fields clears both so a stray ping cannot keep a workspace awake forever. Healthz, landing, `/auth.md`, `/auth/login`, `/auth/callback`, and `/auth/logout` are public. Humans still AuthKit-only. `GET /auth.md` describes that fact; it is not an OAuth AS. Unauthenticated `/api/workspaces*` returns `WWW-Authenticate: Bearer resource_metadata="https://nero.grogan.dev/auth.md"`.

`GET /internal/caddy-auth` is **loopback-only** (Caddy → nero-host). Do not expose `:8080` on the public interface if you can avoid it; Caddy is the public listener.

## API

JSON. Path IDs are workspace ids.

- `GET /healthz`
- `GET /` — grogan.dev landing; portal starts AuthKit via `/auth/login` (nero.grogan.dev `/` is the web dist via Caddy)
- `GET /auth.md` — public markdown skill. Discover is AuthKit hosted UI (`/auth/login`). `/api/workspaces*` requires a human `wos-session`. This host does not run token/identity endpoints.
- `GET /auth/login` — redirect to AuthKit hosted UI (`provider=authkit`, S256 PKCE). `redirect_uri` host must be `grogan.dev`, `www.grogan.dev`, or `nero.grogan.dev` (default ports stripped). Always `https://`.
- `GET /auth/callback` — User Management `authorization_code` exchange; allowlist email; set session; redirect to `https://nero.grogan.dev/`
- `GET /auth/logout` — expire `wos-session` (`Domain=grogan.dev`, Path=/, MaxAge=-1); redirect to `https://grogan.dev/`. WorkOS dashboard sign-out does **not** revoke this cookie.
- `GET /api/workspaces`
- `POST /api/workspaces` body `{ "name": "optional" }` — ZFS dataset + docker create; start or FIFO-queue per admission
- `POST /api/workspaces/:id/wake`
- `DELETE /api/workspaces/:id` — permanently destroys the workspace: stops and removes the container, destroys the dataset (all threads/files gone), and drops it from landlord state
- `POST /api/workspaces/:id/stop` — `docker stop -t 20`; disk stays
- `POST /api/workspaces/:id/heartbeat` body `{ "connected", "agentWorking", "jobRunning" }` (optional bools) — human UI / agent; AuthKit session
- `POST /api/workspaces/:id/job-heartbeat` body `{ "running": true }` (nero-run job) or `{ "agentWorking": true }` (live daemon turn) — independent pins; workspace-derived token

## Docker / cgroup flags

Locked by `docs/research/workspace-lifecycle.md`. Implemented in `apps/host/internal/runtime/flags.go`.

```
docker create \
  --memory=64g \
  --memory-swap=64g \     # no extra swap for this cgroup; host has no swap
  --cpu-shares=1024 \     # cpu.weight; do not pass --cpus
  --stop-timeout 20 \
  --stop-signal SIGRTMIN+3 \
  --hostname ws-<id> \
  --publish 127.0.0.1::8787 \
  --add-host host.docker.internal:host-gateway \   # NERO_HOST_URL depends on this
  --tmpfs /tmp:rw,nosuid,nodev,exec,mode=1777 \    # exec: pip/venv/compilers stage binaries in /tmp
  --tmpfs /run --tmpfs /run/lock \
  --shm-size 1g \
  --privileged \          # guest systemd + cgroup scopes; a guest escape is host root
  --mount type=bind,source=/var/lib/nero/ws/<id>,target=/home/nero \
  --env NERO_WORKSPACE_ID=<id> \
  --env NERO_ENVIRONMENT_ID=<id> \
  --env ZAI_API_KEY=... \
  --env BASETEN_API_KEY=... \
  --env NERO_ACCESS_TOKEN=<derived> \   # HMAC(secret, "nero-workspace-token:"+id), never the raw secret
  --env NERO_HOST_TOKEN=<derived> \
  ...
```

After `docker start`, the landlord finds the container's cgroup — PID 1's innermost cgroup is usually its `init.scope`, so it walks up to the ancestor carrying the container's `memory.max` — and writes there (not `--memory-reservation`; Moby has left `memory.high=max`, moby#49599):

- `memory.high` = 48 GiB (throttle)
- `memory.oom.group` = 1

`memory.min` / `memory.low` stay 0. 32 GiB is a label/warning, not a kernel reservation. If cgroupfs is present but the write fails, **start fails** — an unthrottled workspace is the host-OOM scenario this design forbids.

The guest image runs `nero-daemon.service` (Node, `/usr/local/bin/nero-daemon` → `/usr/lib/nero/daemon/main.js`) on port 8787.

## Admission

Queue if `(running+1)*64GiB + 24GiB > 187GiB` (max 2 awake). FIFO for create/wake. Stop (idle or API) starts the head of the queue. Never start a third 64 GiB-capable workspace and hope the OOM killer is smart. Restore fails closed if `docker ps` fails (systemd retries); extras already running are stopped and queued until the packing invariant holds.

## Idle

Host ticker. Keep-awake is UI `connected`, `agentWorking`, or `jobRunning`. Guest `nero-run` reports job pin via `job-heartbeat` + `NERO_HOST_TOKEN` (do not copy `wos-session` into the guest). Stray processes do not pin.

- 20 minutes with no heartbeat **while pinned** (zombie tab / stale guest) → `docker stop`
- 5 minutes after the workspace becomes **unpinned** (no session, agent, or job — including never-connected) → `docker stop`

Each idle tick reconciles `docker ps` (exited guests free a slot; unknown running nero containers are adopted then packed), re-applies `memory.high`, and re-binds `/run/nero/w/:id.sock`.
