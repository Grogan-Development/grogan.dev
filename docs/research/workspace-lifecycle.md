# Workspace lifecycle: idle, scale-to-zero, cgroups, admission

Primary-source research for Nero. Implementations must serve the locked policy, not replace it. No Nero / code-broker / grid-01 product code was consulted.

---

## 1. What we locked

Nero’s workspace is a Docker container plus a persistent ZFS dataset, with a fat Debian 13 userland.

- **Scale-to-zero** = `docker stop` (or equivalent). Disk lives. Cold start is acceptable.
- **Keep-awake if and only if**: human UI/IDE connected, **or** live agent turn, **or** a registered job (`nero-run` style). Stray processes do not pin the workspace.
- **CPU**: shares (`cpu.weight`), not a hard 8-vCPU cap. Advertised 8 vCPU / 32 GiB is a **label + warning**, not a reservation.
- **Memory**: no reservation. Soft warning at 32 GiB. Hard per-workspace cap high enough for a Blender bake (~64 GiB `memory.max` candidate) so one pig cannot take the host.
- **Jobs** may burst to 40–50 GiB then RSS should fall when the process exits.
- **When the host cannot fit another awake workspace or job**: QUEUE admission (create / wake / job start). Do not rely on the host OOM killer. **No swap**.
- **One user. Many workspaces. Many agent threads inside a workspace.**

Host: single Debian 13 bare-metal box (AMD 7950X, 187 GiB RAM, no GPU, no swap, Docker + ZFS already present).

---

## 2. What others do

### 2.1 Workspace / codespace idle + autostop

Vendors disagree on the three things that matter: **what counts as activity**, **whether a forgotten daemon keeps the box alive**, and **what is destroyed vs persisted**.

#### GitHub Codespaces

Idle timeout **defaults to 30 minutes**, configurable **5–240 minutes**. A codespace **stops running** after inactivity; compute billing stops; storage continues until deletion. Closing a browser tab does **not** stop the codespace. Stopped codespaces that stay inactive are deleted after a retention period (**default 30 days**). Concurrent running codespaces are capped: hitting the active-codespace limit prompts the user to stop one rather than OOM-killing neighbors.

**Inactivity is presence, not CPU.** Official definition: “absence of activity indicative of a user’s presence.” Typing, mouse, and **terminal input or output** reset the timer. A published web app that writes to a terminal keeps the codespace alive. Sharing a port **without** terminal output does **not**. Processes that produce no terminal I/O and no editor input do not keep the codespace awake.

On stop: running processes are killed. Saved files persist. Terminal **history** is preserved; visible terminal contents are not. Rebuilds wipe everything outside `/workspaces`.

Sources:

- [Setting your timeout period for GitHub Codespaces](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces)
- [Understanding the codespace lifecycle](https://docs.github.com/en/codespaces/getting-started/understanding-the-codespace-lifecycle)
- [Stopping and starting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/stopping-and-starting-a-codespace)
- [Restricting the idle timeout period](https://docs.github.com/en/codespaces/managing-codespaces-for-your-organization/restricting-the-idle-timeout-period)

#### Gitpod Classic (now Ona)

Default idle: **30 minutes without user input** (keystrokes or terminal **input** commands). Paid users can raise it to **24 hours**. There is also a **maximum lifetime** independent of activity: **8 hours** (free) / **36 hours** (paid). Installer config names this `MaxLifetime` and documents “the maximum time a workspace is allowed to run. After that, the workspace times out despite activity.”

**Editor disconnect is a separate, shorter timer.** Closing the Gitpod-connected IDE drops the timeout to **5 minutes** unless an explicit inactivity timeout is set. Heartbeats are stored **in-memory** on the controller; a controller restart looks like “never produced any activity.”

The timeout controller in `gitpod-io/gitpod` (`components/ws-manager-mk2/controllers/timeout_controller.go`) distinguishes:

- `activityNone` — period of inactivity
- `activityClosed` — after being closed (no IDE heartbeat)
- `activityMaxLifetime` — hard lifetime
- `activityRunningHeadless` — headless / prebuild workspaces use a different timeout

On stop: the **container is removed**. Only `/workspace` is backed up and restored into a **new** ephemeral container. This is **not** `docker stop` of a fat userland; it is backup-and-recreate.

Sources:

- [Workspace Lifecycle (Gitpod Classic / Ona)](https://ona.com/docs/classic/user/configure/workspaces/workspace-lifecycle)
- [gitpod installer `Workspace.MaxLifetime` / `TimeoutAfterClose`](https://github.com/gitpod-io/gitpod/blob/main/install/installer/pkg/config/v1/config.go)
- [ws-manager-mk2 `timeout_controller.go`](https://github.com/gitpod-io/gitpod/blob/main/components/ws-manager-mk2/controllers/timeout_controller.go)

#### Coder

Autostop is a **TTL plus activity bump**, not a pure idle timer. Default activity bump is **1 hour**. Autostop will not stop a workspace that still has an active session; after the TTL it waits for inactivity, then checks connections again.

**What counts as activity (session types only):**

- VS Code / code-server sessions
- JetBrains Gateway / remote IDE plugins
- Web terminal sessions (including reconnect)
- SSH (`coder ssh` or SSH config integration)
- **AI agent task status `"working"`** — this is first-party: Coder Tasks bump the deadline when the agent reports working

**What does not count:** dashboard views, settings edits, build/audit logs, **accessing ports through direct URLs without an session**, background agent **statistics** (distinct from task-status `"working"`).

Stop destroys **ephemeral** Terraform resources and leaves **persistent** ones idle. Coder Tasks pause = workspace stop; persistent storage remains; conversation snapshot is stored server-side. Autostop **requirement** (Premium) **ignores** active connections and is used for forced template updates.

Sources:

- [Workspace scheduling](https://coder.com/docs/user-guides/workspace-scheduling)
- [Workspace lifecycle](https://coder.com/docs/user-guides/workspace-lifecycle)
- [Coder Tasks lifecycle](https://coder.com/docs/ai-coder/tasks-lifecycle)

#### DevPod

Activity is **“user hasn’t connected.”** Official providers default to **5–10 minutes**. Two mechanisms:

- **Non-machine (Docker / Kubernetes / SSH):** a process inside the container tracks connections, then **kills PID 1**. “This will not erase any state within the container and instead only stop it.” Resume is container restart. Manual stop is `docker stop` for Docker providers.
- **Machine:** a daemon on the VM runs `agent.exec.shutdown` (AWS/GCP API stop, Azure `shutdown -t now`, DigitalOcean **delete the VM** and keep a volume — because DO bills stopped VMs).

Sources:

- [Auto-Inactivity Timeout](https://devpod.sh/docs/developing-in-workspaces/inactivity-timeout)
- [Provider Agent](https://devpod.sh/docs/developing-providers/agent)
- [Stop a Workspace](https://devpod.sh/docs/developing-in-workspaces/stop-a-workspace) (links `docker stop`)

#### OpenShift Dev Spaces / DevWorkspace

Two independent timers on the DevWorkspace operator config:

| Knob | Default | Meaning |
| --- | --- | --- |
| `secondsOfInactivityBeforeIdling` | **1800** (30 min) | Idle → idle then stop. `-1` disables. |
| `secondsOfRunBeforeIdling` | **-1** (disabled) | Max run time **regardless of activity**. |

Older Che-era docs (`CHE_LIMITS_WORKSPACE_IDLE_TIMEOUT`) define idleness as “one of the agents has not received interaction” and explicitly: **“Leaving a browser window open counts toward idleness.”** That is the opposite of “tab still open = active.”

Long-running CLI tools do **not** keep the workspace alive unless the user opts in. The **CLI Watcher** reads a `.noidle` file listing command names (`helm`, `odo`, `sleep`, …); when a matching process is seen, it resets the idle timer. This is an allow-list, not “any process.”

Stop is `spec.started: false` on the `DevWorkspace` CR; pods go away; PVC strategy is typically `per-user`. A separate pruner deletes DevWorkspace objects after **30 days** not started (`retainTime: 2592000`).

Sources:

- [Administration guide: `secondsOfInactivityBeforeIdling` / `secondsOfRunBeforeIdling`](https://docs.redhat.com/en/documentation/red_hat_openshift_dev_spaces/3.29/html-single/administration_guide/index)
- [Prevent workspace idling for long-running commands](https://docs.redhat.com/en/documentation/red_hat_openshift_dev_spaces/3.27/html/user_guide/proc_preventing-workspace-idling-for-long-running-commands_user_guide)
- [Stop workspaces (`spec.started: false`)](https://docs.redhat.com/en/documentation/red_hat_openshift_dev_spaces/3.27/html/user_guide/assembly_integrating-with-openshift_user_guide)
- [Automatic cleanup of inactive workspaces](https://docs.redhat.com/en/documentation/red_hat_openshift_dev_spaces/3.29/html/optimize_performance/proc_configure-automatic-cleanup-of-inactive-workspaces_optimize)

#### VS Code Server / Remote

The standalone VS Code Server is a connection service, not a workspace orchestrator. First-party behavior:

- CLI “server of server” (`cli: implement 'server of server'`, microsoft/vscode): **servers with zero connections for 1 hour are shut down** (`SERVER_IDLE_TIMEOUT_SECS = 60 * 60`). With any connection, the timeout is effectively never (`* 24 * 30 * 12`).
- `--enable-remote-auto-shutdown` / `--remote-auto-shutdown-without-delay` exist as server flags. A 2026 keepalive PR notes the remote server’s wall-clock auto-shutdown as **5 minutes** when the client sleeps.

Activity is **open websocket connections**, not CPU.

Sources:

- [Visual Studio Code Server](https://code.visualstudio.com/docs/remote/vscode-server)
- [microsoft/vscode `enable-remote-auto-shutdown` flags](https://github.com/microsoft/vscode/blob/main/src/vs/server/node/serverEnvironmentService.ts)
- [vscode CLI idle timeout (`SERVER_IDLE_TIMEOUT_SECS`)](https://github.com/microsoft/vscode/commit/1fe8359ed0ef9c52bd6986565da97c395607a130)

#### JetBrains Gateway / Toolbox remote agent

When the frontend IDE disconnects, the **remote agent keeps running for a configurable idle timeout, then exits**. Default **`agent_idle_timeout_ms` = 300000 (5 minutes)**. `0` = exit as soon as the last IDE disconnects. `-1` = never. Exit code **83 (`IDLE_EXIT`)**. Closing the project locally does **not** close it on the remote host until that timeout.

This is IDE-backend process lifetime, not VM/container stop. Disk is whatever the host already has.

Source: [Remote agent timeout mechanism (Toolbox App)](https://www.jetbrains.com/help/toolbox-app/remote-agent-timeout-machanism.html)

#### Daytona

Default **auto-stop 15 minutes**. **Auto-stop triggers even if there are internal processes running in the sandbox.** Preview URL access does **not** count as activity. SDK operations, state changes, and `refresh_activity()` do. Auto-stop `0` = run indefinitely.

Container vs VM diverge: containers **stop** (filesystem kept, memory lost); Linux/Windows VMs **pause** (filesystem + memory). Auto-stop and auto-pause are mutually exclusive. GPU sandboxes are **deleted** on stop unless a volume is mounted.

Sources:

- [Sandboxes (auto-stop / refresh activity)](https://www.daytona.io/docs/en/sandboxes/)
- [Persistence](https://www.daytona.io/docs/en/persistence/)

#### e2b

Timeout is a **TTL from last `setTimeout`**, not an activity detector. Default on connect extend is **5 minutes**. Max continuous run: **1 hour** (Hobby) / **24 hours** (Pro). `onTimeout` defaults to **`"kill"`**; set `"pause"` to snapshot memory+filesystem. Pause cost: **~4 seconds per 1 GiB RAM**; resume **~1 second**. Paused sandboxes are kept indefinitely until explicit kill.

Source: [Sandbox persistence](https://docs.e2b.dev/sandbox/persistence)

#### Disagreements (activity)

| System | CPU / stray process pins? | Terminal I/O pins? | IDE disconnect |
| --- | --- | --- | --- |
| GitHub Codespaces | **No** (unless it produces terminal output) | **Yes** (input **and** output) | Tab close ≠ stop; idle timer still runs |
| Gitpod Classic | No (user input) | Terminal **input** commands; not generic CPU | **5 min** unless override |
| Coder | **No** | Only if it is a counted **session** (web terminal / SSH / IDE / agent `"working"`) | Open session = active; close it and TTL/bump apply |
| DevPod | **No** — connection tracker | n/a | Kill PID 1 / shutdown VM |
| OpenShift Dev Spaces | **No**, unless `.noidle` allow-list | Agent interaction; **open browser counts as idle** | Idle then stop |
| Daytona | **No** — internal processes do **not** block auto-stop | SDK / explicit refresh | Stop or pause by class |
| e2b | n/a (TTL) | n/a | Kill or pause on TTL |
| VS Code Server | No | No | 0 connections → 1 h (CLI) / ~5 min (`--enable-remote-auto-shutdown`) |
| JetBrains remote agent | No | No | **5 min** then agent exits |

Nero’s locked “stray processes do not pin” matches Coder, DevPod, Daytona, OpenShift (default), and Codespaces-without-terminal-spam. It **disagrees** with treating Codespaces-style terminal **output** as presence. A forgotten `npm start` that logs to a TTY would keep a Codespace alive and must **not** keep Nero awake unless it is a registered job.

---

### 2.2 Scale-to-zero compute, persist disk

The unit of stop is not the same across vendors. Wake latency follows the unit.

#### `docker stop` (DevPod Docker provider, Docker Engine)

`docker stop` sends **SIGTERM** to PID 1 (or image `STOPSIGNAL`), then **SIGKILL** after timeout (**default 10 s** on Linux). Writable container layer is kept. `docker start` resumes that layer. This is Nero’s locked unit.

`docker pause` is **not** stop: it freezes all processes via the **cgroup freezer**. Processes are unaware (not SIGSTOP). CPU is parked; memory stays charged. Wrong primitive for scale-to-zero.

Sources:

- [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/)
- [docker container pause](https://docs.docker.com/reference/cli/docker/container/pause/) (freezer cgroup)

#### Fly Machines

A Machine is a Firecracker microVM. **Stop** shuts the VM; **CPU and RAM are released**; **rootfs is rebuilt from the image** on next start (unless `persist_rootfs`). A volume attached 1:1 survives. Destroying a Machine does not destroy its volume.

**Suspend** is a Firecracker snapshot of CPU + memory. Resume: **a few hundred ms**. Cold start: **~2+ s**. Constraints: **≤ 2 GiB RAM recommended**; no swap; no schedule. **Suspended machines still reserve host capacity** — Fly’s own docs: “suspension is not a way to fit more machines into a capacity-constrained region.” Billing for suspend = stop (storage only), but **capacity is not freed**.

Autostop/autostart is **proxy-driven** (`auto_stop_machines = "stop" | "suspend" | "off"`). The proxy stop loop runs every few minutes and **stops at most one Machine per region per pass** — Fly says this cannot keep up with thousands of per-user dev environments; those should self-exit.

Sources:

- [An introduction to Fly Machines](https://fly.io/docs/machines/overview/)
- [Autostop/autostart Machines](https://fly.io/docs/launch/autostop-autostart/)
- [Machine Suspend and Resume](https://fly.io/docs/reference/suspend-resume/)
- [Fly Volumes overview](https://fly.io/docs/volumes/overview/)

#### Cloud Run / Knative

Unit of stop = **replica count → 0**. Disk is **not** a PVC: local disk dies with the instance. Cloud Run may keep instances idle up to **15 minutes** (10 for GPUs) to blunt cold starts. Default is scale-to-zero when idle.

Knative Serving:

- `enable-scale-to-zero` default `true` (global only, KPA autoscaler)
- `scale-to-zero-grace-period` default **30 s** — **upper bound for network reprogramming**, **not** “keep last pod this long”
- `scale-to-zero-pod-retention-period` default **0 s** — **minimum** time the last pod stays after the decision to scale to zero

Cloud Run’s request-scoped CPU is the opposite of a fat workspace: **no CPU allocated outside a request** unless instance-based billing is on. Wake is “next request.”

Sources:

- [About instance autoscaling in Cloud Run services](https://docs.cloud.google.com/run/docs/about-instance-autoscaling)
- [Knative: Configuring scale to zero](https://knative.dev/docs/serving/autoscaling/scale-to-zero/)
- [knative/serving `config-autoscaler` defaults](https://github.com/knative/serving/blob/main/config/core/configmaps/autoscaler.yaml)

#### Modal

Unit = **Function container**. Default **scale to zero**. `scaledown_window` is max idle seconds before a container is removed. `min_containers` keeps a warm pool. Memory snapshots (`enable_memory_snapshot=True`) checkpoint process tree + filesystem mutations for faster cold start (3–10× claimed in Modal’s own guide). GPU snapshots are a separate alpha. This is CRIU-class restore, not `docker stop`.

Sources:

- [Scaling out](https://modal.com/docs/guide/scale)
- [Memory Snapshots](https://modal.com/docs/guide/memory-snapshots)

#### Kubernetes emptyDir vs PVC + scaled replicas

Official volume docs:

- **emptyDir**: created when the Pod is assigned to a node; **deleted permanently when the Pod is removed from the node**. Container crash does **not** wipe it. Scaling a Deployment to 0 **destroys** emptyDir.
- **PVC**: lifecycle **independent of any Pod**. Scaling replicas to 0 leaves the claim. `ReadWriteOnce` means you cannot attach the same volume to two running replicas.

A workspace that must survive scale-to-zero **cannot** use emptyDir as the home disk. PVC (or host ZFS, which is the Nero equivalent) is the persist-disk primitive. Replica count 0 is the compute-off primitive.

Sources:

- [Kubernetes Volumes (`emptyDir`, `persistentVolumeClaim`)](https://kubernetes.io/docs/concepts/storage/volumes/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Ephemeral volumes](https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/)

#### Firecracker snapshots

API: `PATCH /vm` `{state: Paused}` → `PUT /snapshot/create` → later `PUT /snapshot/load` on a **fresh** Firecracker process → `PATCH /vm` `{state: Resumed}`. Guest wall-clock continues from snapshot time (must be corrected). Snapshots are **host-kernel and hardware sensitive**. Userfaultfd can defer memory load to page-fault time.

This is what Fly suspend and e2b/Daytona VM pause sit on. It is **not** `docker stop`. Memory stays on disk as a dump; on Fly it still **reserves** live capacity.

Source: [Firecracker snapshot-support.md](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md)

#### Gitpod vs Codespaces vs Nero (persist unit)

| System | Compute off | Disk that survives |
| --- | --- | --- |
| Nero (locked) | `docker stop` | ZFS dataset + container writable layer |
| GitHub Codespaces | stop VM | whole codespace disk (until retention delete) |
| Gitpod Classic | delete container | **`/workspace` backup only** |
| Coder | destroy ephemeral TF resources | resources marked persistent |
| DevPod Docker | `docker stop` / kill PID 1 | container state |
| DevPod cloud VM | stop or delete VM | volume (DO deletes VM) |
| Fly | Machine stop or suspend | volume; rootfs ephemeral unless configured |
| Knative / Cloud Run | replicas = 0 | nothing local |
| OpenShift Dev Spaces | `spec.started: false` | PVC (`per-user` default) |

Wake times (vendor-stated, not independent benchmarks): Fly suspend **hundreds of ms**, Fly cold **~2+ s**, e2b pause **~4 s/GiB** and resume **~1 s**, `docker start` of a fat Debian userland is typically seconds (image already local, ZFS already mounted) — acceptable per lock.

---

### 2.3 cgroup v2 memory/CPU on Docker

Authoritative interface: [Control Group v2 (kernel)](https://docs.kernel.org/admin-guide/cgroup-v2.html). systemd mapping: [systemd.resource-control(5)](https://man7.org/linux/man-pages/man5/systemd.resource-control.5.html). Docker flags: [Resource constraints](https://docs.docker.com/engine/containers/resource_constraints/).

#### Memory files (bytes)

| File | Kernel meaning | systemd | Docker flag |
| --- | --- | --- | --- |
| `memory.min` | **Hard protection**. Below effective min, memory is **not reclaimed under any conditions**. If nothing else is reclaimable, **OOM is invoked**. Default `0`. Over-commit “may lead to constant OOMs.” | `MemoryMin=` | **none** |
| `memory.low` | **Best-effort protection**. Reclaimed only if unprotected cgroups have nothing left. Default `0`. | `MemoryLow=` | **none** (not `--memory-reservation`) |
| `memory.high` | **Throttle limit**. Over high → processes **throttled** and put under **heavy reclaim**. **Never invokes OOM.** “Under extreme conditions the limit may be breached.” Intended with an **external monitor**. Default `max`. | `MemoryHigh=` — systemd: **“the main mechanism to control memory usage”** | intended mapping of `--memory-reservation` on cgroup v2; **Moby has a documented bug** where `docker update --memory-reservation` leaves `memory.high=max` ([moby#49599](https://github.com/moby/moby/issues/49599)) |
| `memory.max` | **Hard limit**. If usage cannot be reduced, **OOM killer is invoked in the cgroup**. May go over temporarily. Default `max`. | `MemoryMax=` — systemd: **“last line of defense”** | `--memory` / `-m` (minimum **6m**) |
| `memory.swap.max` | Swap hard limit | `MemorySwapMax=` | `--memory-swap` (set **equal to `--memory`** to forbid swap) |
| `memory.oom.group` | If `1`, OOM kills **the whole cgroup** (except `oom_score_adj=-1000`) | via unit OOM policy | not a first-class `docker run` flag |
| `memory.events` | Counters: `high`, `max`, `oom`, `oom_kill`, `oom_group_kill` | — | inspect via cgroupfs |
| `memory.reclaim` | Write e.g. `1G` to trigger **proactive reclaim** (not PSI) | — | — |
| `memory.current` | Current usage including descendants | — | `docker stats` |

**What happens at a 40–50 GiB burst then drop (no swap, `memory.max=64G`):**

1. Anonymous + file cache charge `memory.current`.
2. If `memory.high` is unset (`max`), nothing throttles until `memory.max`.
3. Hitting `memory.max` → direct reclaim inside the cgroup → if that fails, **cgroup OOM**, not host OOM (if the cap is below host free memory).
4. When the job process **exits**, its anonymous pages are freed. **File cache may remain charged to the cgroup** until reclaimed. RSS of the process falls; `memory.current` may stay high because of cache. That is expected. `memory.stat` splits `anon` vs `file`.
5. Nero has **no swap**, so `--memory-swap` must equal `--memory` or the container can still swap if the **host** later gains swap. Docker default when `--memory` is set and `--memory-swap` is unset: **2× memory** if host swap exists.

**Do not set `memory.min` for Nero workspaces.** Kernel: putting more memory than generally available under min protection is discouraged and can cause **constant OOMs**. That is a reservation. Locked policy: no reservation.

Kubernetes Memory QoS (kubelet, cgroup v2, beta in 1.37) independently reached the same four knobs:

- Burstable: `memory.high = requests + memoryThrottlingFactor * (limits - requests)`
- Guaranteed + `TieredReservation`: `memory.min = requests` (equals `memory.max` — kubelet **warns this can OOM on large page cache**)
- Default kubelet: **does not** set `memory.high` / `memory.min` / `memory.low`

Source: [Pod Quality of Service Classes — Memory QoS with cgroup v2](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)

#### CPU files

| File | Kernel | systemd | Docker |
| --- | --- | --- | --- |
| `cpu.weight` | Work-conserving share, range **[1, 10000]**, default **100**. Only among **currently runnable** children. | `CPUWeight=` | `--cpu-shares` (cgroup v1-era 1024 default; runtime converts to weight) |
| `cpu.max` | `$MAX $PERIOD` bandwidth cap, default `max 100000`. **Not** work-conserving. | `CPUQuota=` / `CPUQuotaPeriodSec=` | `--cpus`, `--cpu-quota` + `--cpu-period` |
| `cpu.idle` | `1` = SCHED_IDLE cgroup | `CPUWeight=idle` | — |
| `cpu.pressure` | PSI | — | — |

Kernel: weights are the model for **stateless** resources; unused cycles go to others. `--cpus=8` is `cpu.max`, a **hard cap**, which the lock forbids as the advertised 8 vCPU.

Docker: `--cpu-shares` “is only enforced when CPU cycles are constrained. When plenty of CPU cycles are available, all containers use as much CPU as they need.” That is exactly `cpu.weight`.

#### OOM: kernel, systemd-oomd, PSI

- **Kernel cgroup OOM** fires at `memory.max` (or global OOM if no max). Docker: “OOM priority on containers isn’t adjusted” relative to each other; the **daemon** is protected. `--oom-kill-disable` is only legal **with** `-m`; without a limit it can take down the host. Docker tells you not to.
- **`memory.oom.group=1`**: kill the job/workspace tree together instead of a random child (e.g. a compiler vs ninja).
- **PSI** ([Documentation/accounting/psi.rst](https://docs.kernel.org/accounting/psi.html)): `some` vs `full` stall ratios over 10/60/300 s; pollable triggers. Explicit purpose: “load shedding, migrating jobs, or **strategically pausing or killing low priority or restartable batch jobs**” **before** OOM.
- **systemd-oomd** ([systemd-oomd.service(8)](https://www.freedesktop.org/software/systemd/man/latest/systemd-oomd.service.html)): userspace killer using cgroup v2 + PSI. `ManagedOOMMemoryPressure=kill` → SIGKILL the selected cgroup. **“It is highly recommended for the system to have swap enabled … With swap enabled, the system spends enough time swapping pages to let systemd-oomd react.”** Nero has **no swap**. This is a first-party mismatch.
- **Meta oomd** ([facebookincubator/oomd](https://github.com/facebookincubator/oomd)): same PSI + cgroup v2 idea, plugin policy, GPL-2. Used in production to avoid 30-minute host livelocks. Does not require systemd. Still needs a **policy** of whom to kill — for Nero that should be “refuse admission / stop idle / kill the registered job,” not surprise-kill a neighbor workspace.

#### Docker flags Nero actually has

```
docker run \
  --memory=64g \
  --memory-swap=64g \          # no swap for this cgroup
  --cpu-shares=1024 \          # → cpu.weight ~100 (fair share); do not pass --cpus
  # do not pass --memory-reservation until Moby applies it to memory.high
  # do not pass --oom-kill-disable
```

Live update: `docker update --memory` writes `memory.max`. For `memory.high`, prefer writing the cgroup file (or systemd `MemoryHigh=`) until Moby’s reservation mapping is trustworthy.

---

### 2.4 Admission queues instead of OOM

The shared idea: **if it does not fit, it does not start.** Victims are not random neighbors.

#### Kubernetes default scheduler

Unschedulable Pods stay **Pending**. kube-scheduler **filters** (e.g. `PodFitsResources` uses **requests**, not limits) then **scores**. If the feasible-node list is empty, the Pod **remains unscheduled**. It does not start “anyway.”

QoS (`Guaranteed` / `Burstable` / `BestEffort`) is **not** used by kube-scheduler for preemption. Preemption uses **Priority**. QoS is used by **kubelet node-pressure eviction**. kube-scheduler docs: if no node fits, the pod stays unscheduled.

**ResourceQuota**: namespace aggregate. Violating create/update → **403 Forbidden**. Explicitly: “Neither contention nor changes to quota will affect already created resources.” If namespace quotas sum to more than cluster capacity, contention is **first-come-first-served** at schedule time (Pending), not OOM.

**LimitRange**: per-object min/max/default/ratio at **admission**. Running objects are not retroactively killed.

**In-place Pod resize (KEP-1287, GA in 1.35):** mutate CPU/memory on a running Pod via `/resize`. Memory limit **decrease** is allowed at GA but kubelet only applies it if current usage is below the new limit (**best-effort**, not a guarantee). **A resize that would change QoS class is rejected.** A resize that does not fit the node goes **Deferred**; KEP-5836 (scheduler preemption for IPPR) is the follow-on so Deferred resizes can preempt — not GA behavior yet.

Sources:

- [Kubernetes Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/)
- [Pod QoS classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)
- [Resource Quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [Limit Ranges](https://kubernetes.io/docs/concepts/policy/limit-range/)
- [KEP-1287 In-place Update of Pod Resources](https://www.kubernetes.dev/resources/keps/1287/)
- [Resize CPU and Memory Resources assigned to Pods](https://kubernetes.io/docs/tasks/configure-pod-container/resize-pod-resources/)

#### Apache YuniKorn

App-aware queueing: applications sit in hierarchical queues (`FIFO` / `Fair` / `StateAware` / `Priority`). Queue **max** is a hard quota; jobs **wait in the queue** when the queue is at capacity. Gang scheduling: the app is scheduled only when the **minimal gang** fits; otherwise it waits. Pods stuck Pending with event `Application <appID> does not fit into <queuePath> queue`.

Source: [YuniKorn features](https://yunikorn.apache.org/docs/get_started/core_features), [Gang Scheduling](https://yunikorn.apache.org/docs/user_guide/gang_scheduling), [Troubleshooting Pending](https://yunikorn.apache.org/docs/1.0.0/user_guide/trouble_shooting)

#### Volcano

`Queue` CR: `capability` = **hard upper bound**; `guarantee` = reserved (other queues cannot take it); `deserved` / `weight` = fair share; `reclaimable` default true. Status `Open` accepts PodGroups; `Closed` does not. Jobs without a queue go to `default`.

Source: [Volcano Queue](https://volcano.sh/en/docs/queue/)

#### Slurm

`sbatch` / `salloc` submit into a **scheduling queue**. States: `PENDING` → `RUNNING` → `COMPLETING` / `COMPLETED`. Pending reasons include `Resources` (waiting for allocation) and `Priority` (queued behind a higher-priority job). **No start without an allocation.** Blender-style batch jobs are the native unit (`sbatch` script with `--mem`, `--cpus-per-task`, `--time`).

Source: [Slurm Quick Start User Guide](https://slurm.schedmd.com/quickstart.html)

#### Nomad

If a job cannot place all allocations, Nomad creates a **blocked evaluation** that **waits for additional capacity**. `nomad job status -evals` shows `Status = blocked` / “waiting for additional capacity to place remainder.” Preemption can evict lower-priority allocations so a higher-priority job can run; the evicted job goes pending.

Sources:

- [Inspect running jobs (blocked evals)](https://developer.hashicorp.com/nomad/docs/job-run/inspect)
- [Use preemption for job priority](https://developer.hashicorp.com/nomad/docs/job-scheduling/preemption)
- [How scheduling works](https://github.com/hashicorp/web-unified-docs/blob/main/content/nomad/v1.11.x/content/docs/concepts/scheduling/how-scheduling-works.mdx)

#### What this means on a 187 GiB, no-swap box

Kubernetes-style **requests** would be a reservation; Nero forbids memory reservation. So kube **Guaranteed** QoS is the wrong import. The import is:

1. **Admit in userspace** (403 / Pending / blocked eval / Slurm PD).
2. **Account using a budget**, not “hope the OOM killer is smart.”
3. **Hard cap each admitted unit** so a bug cannot eat the host (`memory.max`).
4. **Do not start the 4th 64 GiB-capable workspace** if 3×64 GiB + OS does not fit — even if current RSS is low.

---

### 2.5 Jobs vs leftover daemons

The problem is marking “this is work” vs “this is a forgotten server.”

#### systemd-run / scopes / slices

`systemd-run COMMAND` creates a **transient `.service`** (manager is parent, detached env). `systemd-run --scope COMMAND` creates a **transient `.scope`**: the command stays a child of the caller (inherits env/TTY) but **cgroup + resource control** belong to systemd.

`--slice=` places the unit in a slice. `-p MemoryMax=` / `-p MemoryHigh=` / `-p CPUWeight=` apply [systemd.resource-control(5)](https://man7.org/linux/man-pages/man5/systemd.resource-control.5.html). `--wait` blocks until exit and can print accounting. `--collect` unloads the unit after completion.

A **service/scope that has exited is no longer a unit that holds keep-alive.** A random `python -m http.server` started from a shell is **not** a unit unless wrapped. That is the distinction Nero needs.

Source: [systemd-run(1)](https://www.mankier.com/1/systemd-run)

#### Kubernetes Jobs vs Deployments

- **Deployment**: desired replica count forever; Pod `restartPolicy` defaults **Always**. Stateless service.
- **Job**: “one-off tasks that run to completion and then stop.” `restartPolicy` **Never** or **OnFailure** only. Completions + parallelism. `ttlSecondsAfterFinished` garbage-collects. `activeDeadlineSeconds` is a wall clock. `suspend: true` deletes **active** Pods until resume (KEP-stable). Indexed jobs fit “render frame N.”

A Deployment is a forgotten server if you forget to scale to 0. A Job is work with a defined end.

Sources:

- [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Workloads](https://kubernetes.io/docs/concepts/workloads/)

#### Slurm jobs

Allocation + job script + time limit. When the job (or time) ends, the allocation is **relinquished**. Interactive `salloc` is still a job. There is no “I left vim running on a login node so my 64 GiB allocation continues” unless you requested that allocation.

Source: [Slurm Quick Start](https://slurm.schedmd.com/quickstart.html)

#### Coder: workspace vs extra containers / agent `"working"`

Coder’s keep-alive is **sessions + agent task status**, not processes inside the workspace. Extra Docker is a **template concern** (privileged DinD sidecar, Sysbox, etc.) — those sidecars live as long as the workspace compute resource. They do **not** independently pin autostop; autostop stops the workspace (and thus sidecars). Coder Tasks: agent `"working"` **does** bump the deadline; background stats **do not**.

Newer Coder Agents run the **agent loop in the control plane**; the workspace is “standard compute” and is only provisioned when tools need it. Chat state lives in the database, not the workspace. That is a later-generation split of “agent turn” from “workspace process.”

Sources:

- [Workspace scheduling (activity list)](https://coder.com/docs/user-guides/workspace-scheduling)
- [Docker in Workspaces (sidecars)](https://coder.com/docs/admin/templates/extending-templates/docker-in-workspaces)
- [Coder Agents](https://coder.com/docs/ai-coder/agents)

#### OpenShift `.noidle`

Explicit allow-list of process **names** that reset idle. Default: nothing. A forgotten `sleep` does not pin unless listed.

#### Daytona

Opposite of “process = work”: auto-stop **fires even with internal processes**. Work that must survive must disable auto-stop (`0`) or refresh activity from the SDK — i.e. the **control plane**, not PID 1’s children.

**Nero mapping:** a registered job is a **named cgroup/unit** created by `nero-run`. Anything else is a stray. This matches systemd-run, k8s Job, Slurm, and Coder’s session/agent-status model — not “scan `/proc` for CPU.”

---

### 2.6 Novel or unusually good approaches (cited)

Only items with a first-party source.

**CRIU (checkpoint/restore in userspace).** Freeze a process tree to files; restore from the same point. Used by Docker (experimental checkpoint), LXC/LXD, OpenVZ. Distinctive: mostly userspace. TCP connections can be restored via libsoccr. Not a substitute for `docker stop` of a fat Debian workspace on v1 (compatibility, devices, time, network). Source: [checkpoint-restore/criu README](https://github.com/checkpoint-restore/criu/blob/master/README.md).

**Firecracker snapshots.** Pause VM → dump memory+devices → load on a new process. Fly and e2b/Daytona VM pause. Fly: **does not free capacity** while suspended; **≤ 2 GiB** recommended. Nero workspaces are **64 GiB-class**; snapshot/restore of 50 GiB RAM is minutes of disk and still holds host RAM if implemented like Fly. Source: [Firecracker snapshot-support](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md), [Fly suspend](https://fly.io/docs/reference/suspend-resume/).

**cgroup freezer (`cgroup.freeze`).** Kernel: write `1` to freeze the cgroup and descendants; processes stop until unfrozen; they can still be SIGKILL’d. Docker `pause` uses this. **Memory remains charged.** Useful as a PSI reaction for a **job** (“pause the bake, don’t OOM the IDE”) — not as scale-to-zero. Source: [cgroup-v2 `cgroup.freeze`](https://docs.kernel.org/admin-guide/cgroup-v2.html).

**PSI-triggered freeze/kill.** Kernel PSI doc lists pausing or killing low-priority batch jobs as the point of the interface. systemd-oomd implements kill; Meta oomd is the plugin version. Nero: use PSI as a **signal to the admission daemon** (don’t start the next job; freeze or SIGTERM the registered job cgroup), not as a host-wide surprise killer — especially **without swap**, which systemd-oomd itself says it wants. Sources: [psi.rst](https://docs.kernel.org/accounting/psi.html), [systemd-oomd](https://www.freedesktop.org/software/systemd/man/latest/systemd-oomd.service.html), [facebookincubator/oomd](https://github.com/facebookincubator/oomd).

**`memory.high` as the working limiter, `memory.max` as the last line.** systemd’s own man page: “It is recommended to use MemoryHigh= as the main control mechanism and use MemoryMax= as the last line of defense.” Kernel: high never OOM-kills. This is the right shape for “soft warning at 32 GiB / throttle around 40–50 / hard 64.” Source: [systemd.resource-control(5)](https://man7.org/linux/man-pages/man5/systemd.resource-control.5.html), [cgroup-v2 memory.high / memory.max](https://docs.kernel.org/admin-guide/cgroup-v2.html).

**In-place resize.** KEP-1287: grow/shrink CPU and memory on a running workload without recreate. A Blender job could raise `memory.max`/`memory.high` for the bake and drop them after. GA in Kubernetes 1.35; memory shrink is best-effort vs current usage. Docker analog: `docker update --memory` (and manual `memory.high`). Source: [KEP-1287](https://www.kubernetes.dev/resources/keps/1287/).

**Gitpod `TimeoutAfterClose` vs inactivity vs max lifetime.** Three clocks. Nero needs at least two: **disconnect grace** (JetBrains/Gitpod 5 min class) and **idle-with-connection grace** (Codespaces 30 min class), plus **job registration** which bypasses both.

**Coder agent `"working"` as a first-class activity type.** Matches Nero’s “live agent turn.” Do not invent CPU heuristics; take a status bit from the agent runtime.

**e2b filesystem-only pause (`keepMemory: false`).** Persist disk, drop RAM, cold-boot processes. That is closer to `docker stop` than a full VM snapshot. Source: [e2b persistence](https://docs.e2b.dev/sandbox/persistence).

**Fly’s warning on autostop loops.** Proxy-driven stop of thousands of workspaces **does not scale** (one stop per region per few minutes). Nero should **self-stop from inside** (DevPod agent pattern) or have a host daemon that can stop many containers per pass.

---

## 3. What Nero should steal

### v1 (fits the lock)

| Steal | From | Why |
| --- | --- | --- |
| Keep-awake = **sessions + agent-working bit + registered job units**, never `/proc` CPU | Coder activity list; DevPod connection tracker; Nero lock | Stray daemons must not pin |
| **Disconnect grace ~5 min** when no IDE/SSH; **idle-with-connection grace ~15–30 min** | Gitpod `TimeoutAfterClose`; JetBrains 5 min; Codespaces 30 min | Tab close ≠ instant kill; also ≠ infinite |
| **`docker stop`** (SIGTERM, 10–30 s, SIGKILL); ZFS stays imported | Docker; DevPod Docker provider | Locked scale-to-zero |
| **`memory.max=64G`**, **`memory.swap.max=64G`** (no swap), **`cpu.weight` via `--cpu-shares`**, **no `--cpus`** | kernel cgroup v2; systemd; Docker resource constraints | Label 8/32 is not a cap or a reservation |
| **`memory.high` ~40–48G** as throttle (write cgroupfs if Docker reservation is broken) | systemd MemoryHigh; kernel memory.high; kube Memory QoS formula | Burst 40–50 GiB then reclaim without cgroup OOM |
| Userspace **32 GiB warning** (log / UI), not a kernel knob | Codespaces-style “advertised SKU”; lock | `memory.low`/`min` would be a reservation |
| **`memory.oom.group=1`** on the workspace cgroup | kernel `memory.oom.group` | One pig dies as a unit, not a random child |
| Jobs = **`systemd-run --scope --slice=nero-job.slice`** (or equivalent) with `MemoryHigh`/`MemoryMax`; scope exit drops keep-alive | systemd-run; k8s Job vs Deployment; Slurm | Forgotten `python http.server` is not a job |
| **Admission FIFO** before `docker start` / `docker run` / job start: if `sum(memory.max of awake) + new.max + host_reserve > 187 GiB` → queue | k8s Pending; Nomad blocked eval; Slurm PD; YuniKorn queue | No host OOM |
| Host reserve: OS + containerd + ZFS ARC cap, **tens of GiB**, not 0 | implied by no-swap + 64G caps | Two 64G workspaces + OS on 187G is the real packing limit |
| Idle agent **inside** the workspace or a host watcher that can stop **many** containers per tick | DevPod agent; Fly “don’t use the slow proxy loop” | One-at-a-time stop loops will lag |
| Watch `memory.events` + `memory.current` + PSI `memory.pressure` **for warnings and admission**, not for surprise kills | kernel PSI; cgroup memory.events | Policy: queue or stop idle first |

### Later (not v1)

| Later | From | Why wait |
| --- | --- | --- |
| Firecracker / e2b-style **memory snapshot** | Fly suspend, e2b pause, Firecracker | 50 GiB dumps are slow; Fly still **holds capacity**; lock already accepts cold start |
| CRIU of the Docker container | CRIU, Modal memory snapshots | Compatibility with Debian 13 userland, Docker, ZFS, time, sockets |
| `cgroup.freeze` the **job** under PSI `full` | kernel freezer; PSI | Good for “pause bake, keep IDE”; extra state machine |
| In-place raise/lower `memory.max` for the bake | KEP-1287; `docker update` | v1 can just set 64G always; shrink after job is polish |
| systemd-oomd | systemd-oomd | **Wants swap**; Nero has none |
| Gitpod-style **wipe container, restore `/workspace` only** | Gitpod | Conflicts with fat Debian + ZFS userland |
| Knative / Cloud Run request-scoped CPU | Cloud Run | Opposite of an interactive workspace |
| Hierarchical fair-share queues (YuniKorn/Volcano weights) | YuniKorn, Volcano | One user; FIFO is enough |
| Autostop **requirement** / max lifetime despite activity | Gitpod MaxLifetime; Coder autostop requirement | Useful later for wedged agent loops; not required for v1 |

---

## 4. Explicit non-goals

- **Not** Firecracker as the v1 compute unit. Docker + ZFS is locked.
- **Not** `docker pause` / cgroup freeze as scale-to-zero (memory stays charged).
- **Not** host swap, zswap-as-safety-net, or systemd-oomd as the admission story.
- **Not** `memory.min` / `memory.low` / Docker `--memory-reservation` as a “guarantee.” That is a reservation; kube even warns `memory.min == memory.max` OOMs on cache.
- **Not** `--cpus=8` / `cpu.max` as the advertised 8 vCPU. That is a hard cap. Use `cpu.weight`.
- **Not** “any process with CPU keeps the workspace awake.” Codespaces terminal-output-as-presence is **too sticky** for Nero.
- **Not** relying on the kernel OOM killer to choose between workspaces.
- **Not** Gitpod’s “only `/workspace` survives.” The ZFS dataset **is** the userland disk.
- **Not** Fly suspend semantics (fast resume **and** continued capacity reservation). Nero stop must **free** CPU and RAM.
- **Not** multi-tenant quota / PriorityClass / preemption of other users. One user.
- **Not** implementing CRIU, Modal snapshots, or in-place Pod resize machinery in v1.
- **Not** making preview-port hits or dashboard views count as activity (Coder and Daytona both reject this; copy that).

---

## 5. Recommended v1 mechanism

One host daemon (or the workspace agent plus a host supervisor) owns four primitives: **keep-awake signals**, **`docker stop`/`start`**, **cgroup limits**, **admission FIFO**.

### 5.1 Unit of compute and disk

- Compute: one Docker container per workspace.
- Disk: ZFS dataset mounted into the container; **never** emptyDir-like ephemeral.
- Off: `docker stop -t 20` (SIGTERM → 20 s → SIGKILL). Matches [docker stop](https://docs.docker.com/reference/cli/docker/container/stop/).
- On: `docker start`. Cold start OK. No CRIU.

### 5.2 Keep-awake (iff)

A workspace is **awake-eligible** only while any of:

1. **Human session**: ≥1 SSH session, or IDE websocket (code-server / VS Code Remote / JetBrains backend) with a recent heartbeat (≤ 60 s).
2. **Live agent turn**: agent runtime sets `working=true` (Coder Tasks pattern). Heartbeat while the turn runs; clear when the turn ends.
3. **Registered job**: a live systemd scope under `nero-job.slice` created by `nero-run` (see 5.4).

**Not** keep-awake: CPU, unnamed daemons, port-forward hits, preview URLs, `docker exec` leftovers, `tmux` with a forgotten server.

Timers (steal Gitpod’s two clocks, not Codespaces’ terminal-output clock):

- If **no** sessions and **no** agent-working and **no** jobs: **disconnect grace 5 minutes** → `docker stop`.
- If sessions exist but no input/heartbeat for **20 minutes**: treat as idle-with-zombie-tab → stop. (Codespaces 30 min class, slightly tighter.)
- Re-arm on any keep-awake signal.

Implement the idle agent **in the workspace** (DevPod: kill PID 1 / request host to `docker stop`) **and** a host reconciler that can stop many containers per pass (do not copy Fly’s one-per-few-minutes proxy loop).

### 5.3 cgroup v2 layout (one workspace)

```
nero.slice/
  ws-<id>.scope          # docker container cgroup (or systemd-nspawn-style scope Docker already creates)
    memory.max = 64G
    memory.swap.max = 0  # or memory.swap.max = 64G with --memory-swap=64g; host has no swap
    memory.high = 48G    # throttle before OOM; burst 40–50 GiB lives here
    memory.min = 0
    memory.low = 0
    memory.oom.group = 1
    cpu.weight = 100     # default; all workspaces equal; host CFS shares 16 cores
    cpu.max = max 100000 # NO quota
    nero-job.slice/      # optional child; jobs charged inside the same 64G
      job-<n>.scope      # systemd-run --scope
```

Docker create/update:

```
--memory=64g --memory-swap=64g --cpu-shares=1024
```

Do **not** set `--cpus`. Do **not** set `--memory-reservation` until Moby writes `memory.high` reliably; set `memory.high` on the container cgroup after start.

**32 GiB warning:** userspace. When `memory.current` crosses 32 GiB, log/UI warn (“advertised 32 GiB; hard cap 64 GiB”). No kernel file for that.

**Burst then drop:** job RSS in `memory.stat` `anon` should fall on process exit. If `memory.current` stays fat on `file`, that is cache; `memory.high` reclaim will shrink it under pressure. Do not confuse cache with a leak.

### 5.4 Jobs (`nero-run`)

```
systemd-run --scope --user --slice=nero-job.slice \
  -p MemoryHigh=48G -p MemoryMax=64G \
  -p CPUWeight=100 \
  --unit=nero-job-<id>.scope \
  --collect -- \
  blender -b scene.blend -f 1
```

(Or the host systemd if the agent is root in the container.)

- Creating the scope **registers** keep-awake until the scope’s cgroup is empty (`cgroup.events` `populated=0`).
- Unregistered children of the workspace PID 1 never register.
- Optional: `activeDeadlineSeconds` analog — a wall-clock on the scope so a stuck bake cannot pin forever (Gitpod max lifetime, later if needed).

This is Kubernetes Job vs Deployment, in one cgroup tree.

### 5.5 Admission FIFO (create / wake / job start)

Host budget (constants for this box):

- `HOST_MEM = 187 GiB`
- `HOST_RESERVE = 24 GiB` (kernel, ZFS ARC cap, Docker, Nero daemon) — pick a real measured floor, not 0
- `WS_HARD = 64 GiB` (`memory.max` of an awake workspace)
- Packing invariant: `awake_count * WS_HARD + HOST_RESERVE <= HOST_MEM`  
  → **at most 2 awake workspaces** on this host if every awake workspace is allowed to bake.  
  If you ever lower `WS_HARD` for “light” workspaces, admission can pack more; v1 should **not** oversubscribe `memory.max`. Oversubscribe **weight**, not max.

Queue:

1. Operations: `create`, `wake` (`docker start`), `job-start` (if job would require a wake, or if a third job needs a third 64G — it doesn’t; jobs share the workspace cap).
2. If invariant holds after the op → run immediately.
3. Else → FIFO wait. Head of line starts when a workspace stops (cgroup gone, memory.max released).
4. Never start and hope; never rely on host OOM.

Optional v1.1: a **job** that would push `memory.current` of an already-awake workspace through `memory.high` still runs (that’s what high is for); a **wake** of a third workspace does not.

PSI: if host `memory.pressure` `full avg10` is high, **stop admitting** even if the 64G arithmetic still has a hole (cache / reclaim storm). Do **not** auto-kill a neighbor workspace. Prefer: pause/SIGTERM the **registered job**, or refuse the new wake.

### 5.6 What gets killed vs persisted

| Event | Processes | Container RW layer | ZFS dataset |
| --- | --- | --- | --- |
| Idle autostop | SIGTERM then SIGKILL (`docker stop`) | kept | kept |
| Registered job exit | job cgroup empty | kept | kept |
| cgroup OOM at 64 GiB | whole workspace cgroup if `oom.group=1` | kept (dirty) | kept |
| User delete | removed | removed | destroyed |

Same split Codespaces documents for stop vs delete; disk analog is ZFS not a cloud volume.

### 5.7 Why this and not the alternatives

- **Not systemd-oomd:** no swap, and the man page wants swap for time to react.
- **Not Fly suspend:** would not free 64 GiB-class capacity; lock wants compute off.
- **Not Gitpod backup-of-`/workspace`:** fat Debian userland is the product.
- **Not `--cpus=8`:** lock says shares, not a cap.
- **Not Codespaces “terminal output = presence”:** a log-spewing daemon would pin the box.
- **Not kube Guaranteed requests:** that is a reservation.

This is DevPod’s Docker stop + Coder’s session/agent keep-alive + systemd’s MemoryHigh/MemoryMax split + Slurm/Nomad/k8s Pending admission, on one machine, with `memory.max=64G` as the pig fence.
