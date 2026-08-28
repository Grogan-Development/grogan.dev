# Nero host (Grid-01)

Landlord only: AuthKit session later (PR 6), workspace create/stop/wake/queue, cgroups, Caddy. No agent loop.

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
| `WORKOS_AUTHKIT_URL` | empty | Portal button `href` on grogan.dev landing. AuthKit itself is PR 6. |
| `NERO_GUEST_IMAGE` | `nero-guest:v1` | Image from PR 2. Create still records the name if the image is missing. |
| `NERO_ZFS_POOL` | `grid` | Datasets at `{pool}/nero/{id}` |
| `NERO_WS_MOUNT` | `/var/lib/nero/ws` | Bind-mounted at `/home/nero` in the container |
| `NERO_IDLE_TICK` | `10s` | How often the host reconciles idle stop |

WorkOS client id/secret, OpenRouter keys, and AuthKit cookie material belong in that env file or a later secret store — never in this repo.

Until PR 6, `/api/*` returns 401 unless `NERO_DEV_BYPASS=1`. Healthz and landing are public.

## API

JSON. Path IDs are workspace ids.

- `GET /healthz`
- `GET /` — grogan.dev landing; portal `href` from `WORKOS_AUTHKIT_URL`
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

`awake_count * 64GiB + 24GiB > 187GiB` → queue (`~2` awake). FIFO for create/wake. Stop (idle or API) starts the head of the queue. Never start a third 64 GiB-capable workspace and hope the OOM killer is smart.

## Idle

Host ticker. Keep-awake is UI `connected`, `agentWorking`, or `jobRunning` (guest `nero-run` reports via heartbeat). Stray processes do not pin.

- 20 minutes with no heartbeat (zombie tab / dead guest) → `docker stop`
- 5 minutes after last UI disconnect (`connected: true` → `false`) if no job/agent → `docker stop`

## Caddy / AuthKit redirect URIs (PR 6)

Sites: `https://grogan.dev`, `https://www.grogan.dev` (redir), `https://nero.grogan.dev`.

When AuthKit is wired, register at least:

- `https://grogan.dev/callback` (or whatever AuthKit path WorkOS issues)
- `https://nero.grogan.dev/callback`

`/w/*` on `nero.grogan.dev` is a 501 placeholder until PR 10.
