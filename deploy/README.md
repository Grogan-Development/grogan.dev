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
NERO_ACCESS_TOKEN=       # openssl rand -hex 32  (Caddy → guest daemon Bearer)
OPENROUTER_API_KEY=      # harness; injected into guests at create
NERO_GUEST_IMAGE=nero-guest:v1
NERO_ZFS_POOL=grid
NERO_WS_MOUNT=/var/lib/nero/ws
NERO_SOCK_DIR=/run/nero/w
NERO_IDLE_TICK=10s
```

`OPENROUTER_API_KEY` and `NERO_ACCESS_TOKEN` are docker `--env` at create. They are not in git and not in the image.

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
sudo mkdir -p /run/nero/w /var/lib/nero/ws
sudo systemctl daemon-reload
sudo systemctl enable --now nero-host
sudo systemctl reload caddy
```

Caddy must be able to dial `127.0.0.1:<workspace-port>` (loopback docker publish) and read `/run/nero/w/*.sock` (same mapping, unix).

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

| Guest | Host TCP | Host unix |
| --- | --- | --- |
| `nero-ws-<id>` :8787 | `127.0.0.1:<ephemeral>` | `/run/nero/w/<id>.sock` |

Caddy does **not** hard-code ports. For `/w/:id/{ws,vnc,api,…}` (and origin `/ws` `/vnc` `/api` after the `nero-ws` cookie) it `forward_auth`s to `http://127.0.0.1:8080/internal/caddy-auth` (loopback only). A valid `wos-session` on the allowlist gets `X-Nero-Dial: 127.0.0.1:<port>` and `Authorization: Bearer $NERO_ACCESS_TOKEN`. The guest hop **drops Cookie** so `wos-session` never reaches the daemon.

Stopped / queued workspaces: Caddy auth returns 503. Wake via `POST /api/workspaces/:id/wake`.

## Environment

Put values in `/etc/nero/host.env` (mode `0600`, **not in git**). systemd `EnvironmentFile=-/etc/nero/host.env`.

| Variable | Default | Notes |
| --- | --- | --- |
| `NERO_LISTEN` | `:8080` | Landlord HTTP bind |
| `NERO_DEV_BYPASS` | unset | `1` skips auth. **Local tests only.** Do not set on the public host. |
| `WORKOS_API_KEY` | empty | User Management API key (`client_secret` on `authorization_code` exchange). |
| `WORKOS_CLIENT_ID` | empty | AuthKit / User Management client id. |
| `WORKOS_AUTHKIT_URL` | `https://api.workos.com/user_management/authorize` | Hosted UI start URL. `/auth/login` redirects here with `provider=authkit`. |
| `WORKOS_COOKIE_PASSWORD` | empty | Seals the `wos-session` cookie. **≥32 characters.** `openssl rand -base64 32`. Without `NERO_DEV_BYPASS`, nero-host will not listen if this, `WORKOS_CLIENT_ID`, or `WORKOS_API_KEY` is missing/short. |
| `NERO_ALLOWED_EMAILS` | empty | Comma-separated allowlist (v1: your email). Empty + no bypass **fail closed** (callback 403, APIs 401). |
| `NERO_HOST_TOKEN` | empty | Shared secret for guest `POST /api/workspaces/:id/job-heartbeat`. Injected into containers as `NERO_HOST_TOKEN`. Empty + no bypass → that route 401. |
| `NERO_ACCESS_TOKEN` | empty | Injected into guests as `NERO_ACCESS_TOKEN`. Caddy `forward_auth` sends it as `Authorization: Bearer` to the daemon. Generate with `openssl rand -hex 32`. |
| `OPENROUTER_API_KEY` | empty | Injected into guests at create. Harness streams GLM-5.3-Flash via OpenRouter (Baseten pin). **Not in git.** |
| `NERO_GUEST_IMAGE` | `nero-guest:v1` | Image from `guest/Dockerfile` (daemon + seat). `docker create` requires the image; failure rolls back the dataset. |
| `NERO_ZFS_POOL` | `grid` | Datasets at `{pool}/nero/{id}` |
| `NERO_WS_MOUNT` | `/var/lib/nero/ws` | Bind-mounted at `/home/nero` in the container |
| `NERO_SOCK_DIR` | `/run/nero/w` | Unix sockets `{dir}/{id}.sock` |
| `NERO_IDLE_TICK` | `10s` | How often the host reconciles idle stop |

WorkOS keys, allowlist, host token, access token, OpenRouter key, and AuthKit cookie material belong in that env file — never in this repo.

In the WorkOS dashboard: **Authentication → disable Sign up** (email+password sign-up is on by default). v1 is one human; the app still fail-closes on `NERO_ALLOWED_EMAILS`.

Human `GET/POST /api/workspaces*` (list/create/wake/stop/heartbeat) requires a valid `wos-session` whose email is on the allowlist, unless `NERO_DEV_BYPASS=1`. Guest job keep-awake is `POST /api/workspaces/:id/job-heartbeat` with `Authorization: Bearer $NERO_HOST_TOKEN` (or `X-Nero-Host-Token`) — not the human cookie. Healthz, landing, `/auth.md`, `/auth/login`, `/auth/callback`, and `/auth/logout` are public. Humans still AuthKit-only. `GET /auth.md` describes that fact; it is not an OAuth AS. Unauthenticated `/api/workspaces*` returns `WWW-Authenticate: Bearer resource_metadata="https://nero.grogan.dev/auth.md"`.

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
- `POST /api/workspaces/:id/stop` — `docker stop -t 20`; disk stays
- `POST /api/workspaces/:id/heartbeat` body `{ "connected", "agentWorking", "jobRunning" }` (optional bools) — human UI / agent; AuthKit session
- `POST /api/workspaces/:id/job-heartbeat` body `{ "running": true }` — guest `nero-run` keep-awake; `NERO_HOST_TOKEN`

## Docker / cgroup flags

Locked by `docs/research/workspace-lifecycle.md`. Implemented in `apps/host/internal/runtime/flags.go`.

```
docker create \
  --memory=64g \
  --memory-swap=64g \     # no extra swap for this cgroup; host has no swap
  --cpu-shares=1024 \     # cpu.weight; do not pass --cpus
  --stop-timeout 20 \
  --stop-signal SIGRTMIN+3 \
  --publish 127.0.0.1::8787 \
  --tmpfs /tmp --tmpfs /run --tmpfs /run/lock \
  --shm-size 1g \
  --mount type=bind,source=/var/lib/nero/ws/<id>,target=/home/nero \
  --env NERO_WORKSPACE_ID=<id> \
  --env NERO_ENVIRONMENT_ID=<id> \
  --env OPENROUTER_API_KEY=... \
  --env NERO_ACCESS_TOKEN=... \
  --env NERO_HOST_TOKEN=... \
  ...
```

After `docker start`, write on the container cgroup (not `--memory-reservation`; Moby has left `memory.high=max`, moby#49599):

- `memory.high` = 48 GiB (throttle)
- `memory.oom.group` = 1

`memory.min` / `memory.low` stay 0. 32 GiB is a label/warning, not a kernel reservation.

The guest image runs `nero-daemon.service` (Node, `/usr/local/bin/nero-daemon` → `/usr/lib/nero/daemon/main.js`) on port 8787.

## Admission

Queue if `(running+1)*64GiB + 24GiB > 187GiB` (max 2 awake). FIFO for create/wake. Stop (idle or API) starts the head of the queue. Never start a third 64 GiB-capable workspace and hope the OOM killer is smart. Restore fails closed if `docker ps` fails (systemd retries); extras already running are stopped and queued until the packing invariant holds.

## Idle

Host ticker. Keep-awake is UI `connected`, `agentWorking`, or `jobRunning`. Guest `nero-run` reports job pin via `job-heartbeat` + `NERO_HOST_TOKEN` (do not copy `wos-session` into the guest). Stray processes do not pin.

- 20 minutes with no heartbeat **while pinned** (zombie tab / stale guest) → `docker stop`
- 5 minutes after the workspace becomes **unpinned** (no session, agent, or job — including never-connected) → `docker stop`

Each idle tick reconciles `docker ps` (exited guests free a slot; unknown running nero containers are adopted then packed), re-applies `memory.high`, and re-binds `/run/nero/w/:id.sock`.
