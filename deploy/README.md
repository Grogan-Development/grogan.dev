# Nero host (Grid-01)

Landlord only: AuthKit session, workspace create/stop/wake/queue, cgroups, Caddy. No agent loop.

## Build

```bash
cd apps/host
go test ./...
go build -o nero-host ./cmd/nero-host
sudo install -m 755 nero-host /usr/local/bin/nero-host
```

Caddyfile and unit:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo cp deploy/nero-host.service /etc/systemd/system/nero-host.service
sudo systemctl daemon-reload
sudo systemctl enable --now nero-host
sudo systemctl reload caddy
```

## Environment

Put values in `/etc/nero/host.env` (mode `0600`, **not in git**). systemd `EnvironmentFile=-/etc/nero/host.env`.

| Variable | Default | Notes |
| --- | --- | --- |
| `NERO_LISTEN` | `:8080` | Landlord HTTP bind |
| `NERO_DEV_BYPASS` | unset | `1` skips auth. **Local tests only.** Do not set on the public host. |
| `WORKOS_API_KEY` | empty | User Management API key (`client_secret` on `authorization_code` exchange). |
| `WORKOS_CLIENT_ID` | empty | AuthKit / User Management client id. |
| `WORKOS_AUTHKIT_URL` | `https://api.workos.com/user_management/authorize` | Hosted UI start URL. `/auth/login` redirects here with `provider=authkit`. |
| `WORKOS_COOKIE_PASSWORD` | empty | Seals the `wos-session` cookie. **≥32 characters.** `openssl rand -base64 32`. |
| `NERO_GUEST_IMAGE` | `nero-guest:v1` | Image from PR 2. `docker create` requires the image; failure rolls back the dataset. |
| `NERO_ZFS_POOL` | `grid` | Datasets at `{pool}/nero/{id}` |
| `NERO_WS_MOUNT` | `/var/lib/nero/ws` | Bind-mounted at `/home/nero` in the container |
| `NERO_IDLE_TICK` | `10s` | How often the host reconciles idle stop |

WorkOS keys and AuthKit cookie material belong in that env file — never in this repo.

`GET/POST /api/workspaces*` requires a valid `wos-session` cookie unless `NERO_DEV_BYPASS=1`. Healthz, landing, `/auth/login`, and `/auth/callback` are public.

## API

JSON. Path IDs are workspace ids.

- `GET /healthz`
- `GET /` — grogan.dev landing; portal starts AuthKit via `/auth/login`
- `GET /auth/login` — redirect to AuthKit hosted UI (`provider=authkit`)
- `GET /auth/callback` — User Management `authorization_code` exchange; sets session; redirect to `https://nero.grogan.dev/`
- `GET /api/workspaces`
- `POST /api/workspaces` body `{ "name": "optional" }` — ZFS dataset + docker create; start or FIFO-queue per admission
- `POST /api/workspaces/:id/wake`
- `POST /api/workspaces/:id/stop` — `docker stop -t 20`; disk stays
- `POST /api/workspaces/:id/heartbeat` body `{ "connected", "agentWorking", "jobRunning" }` (all optional bools)

## Docker / cgroup flags

Locked by `docs/research/workspace-lifecycle.md`. Implemented in `apps/host/internal/runtime/flags.go`.

```
docker create \
  --memory=64g \
  --memory-swap=64g \     # no extra swap for this cgroup; host has no swap
  --cpu-shares=1024 \     # cpu.weight; do not pass --cpus
  --stop-timeout 20 \
  --mount type=bind,source=/var/lib/nero/ws/<id>,target=/home/nero \
  ...
```

After `docker start`, write on the container cgroup (not `--memory-reservation`; Moby has left `memory.high=max`, moby#49599):

- `memory.high` = 48 GiB (throttle)
- `memory.oom.group` = 1

`memory.min` / `memory.low` stay 0. 32 GiB is a label/warning, not a kernel reservation.

## Admission

Queue if `(running+1)*64GiB + 24GiB > 187GiB` (max 2 awake). FIFO for create/wake. Stop (idle or API) starts the head of the queue. Never start a third 64 GiB-capable workspace and hope the OOM killer is smart. Restore fails closed if `docker ps` fails (systemd retries); extras already running are stopped and queued until the packing invariant holds.

## Idle

Host ticker. Keep-awake is UI `connected`, `agentWorking`, or `jobRunning` (guest `nero-run` reports via heartbeat). Stray processes do not pin.

- 20 minutes with no heartbeat **while pinned** (zombie tab / stale guest) → `docker stop`
- 5 minutes after the workspace becomes **unpinned** (no session, agent, or job — including never-connected) → `docker stop`

Each idle tick reconciles `docker ps` (exited guests free a slot; unknown running nero containers are adopted then packed) and re-applies `memory.high`.

## Caddy / AuthKit redirect URIs

Sites: `https://grogan.dev`, `https://www.grogan.dev` (redir), `https://nero.grogan.dev`.

Register in the WorkOS dashboard (Redirects):

- Redirect URIs:
  - `https://grogan.dev/auth/callback`
  - `https://nero.grogan.dev/auth/callback`
- Initiate login URL: `https://grogan.dev/auth/login` (also valid: `https://nero.grogan.dev/auth/login`)
- Sign-out redirect: `https://grogan.dev/`

Flow: grogan.dev portal → `/auth/login` → AuthKit hosted UI → `/auth/callback` (`grant_type=authorization_code`) → `wos-session` cookie (`Domain=grogan.dev`, so `nero.grogan.dev` receives it) → `https://nero.grogan.dev/`.

`/w/*` on `nero.grogan.dev` is a 501 placeholder until PR 10.
