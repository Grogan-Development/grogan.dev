---
name: nero-run
description: Keep the workspace awake during long-running commands (builds, bakes, training runs) with nero-run.
---

# Long jobs with nero-run

Idle workspaces stop after ~5 minutes unpinned. A normal bash command that
outlives the turn does not pin anything — wrap long work in `nero-run` so the
workspace stays awake until the job actually exits.

```
nero-run COMMAND [ARGS...]          # run COMMAND as a keep-awake job
NERO_JOB_ID=bake nero-run ...       # name the scope (alphanumeric/-/_)
NERO_RUN_DRY=1 nero-run ...         # print the systemd-run argv, run nothing
```

## Behavior

- The job runs as a systemd **user scope** under `nero-job.slice`
  (MemoryHigh=48G, MemoryMax=64G, CPU weight applied; the container's own
  64 GiB cap still fences everything).
- While the scope lives, `nero-run` heartbeats the host every 30s; when it
  exits (or is interrupted), the last heartbeat unpins.
- `nero-run` survives the turn that started it — it is detached from the
  bash tool's process-group kill on purpose. Check on it with normal bash:
  `systemctl --user status nero-job-*.scope`, `journalctl --user -u <scope>`.
- If a command times out inside the bash tool but was started with
  `nero-run`, the job keeps running — that is the point. Kill it with
  `systemctl --user stop <scope>` when it should not keep running.
- Interrupting a turn also stops scopes this turn started (the wrapper traps
  INT/TERM and tears the scope down before unpinning).

## When to use it

- Blender renders / bakes, dataset training, long builds, big downloads.
- Anything you expect to outlive ~4 minutes.
- Do NOT wrap quick commands; every job occupies the workspace's 64 GiB
  admission slot until it exits.
