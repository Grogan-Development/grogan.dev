package runtime

import "fmt"

// Cgroup / docker resource flags locked by PLAN.md and
// docs/research/workspace-lifecycle.md.
//
// Do not pass --cpus (that is cpu.max, a hard cap). Advertised 8 vCPU is a
// label; use --cpu-shares so the kernel maps to cpu.weight.
// Do not pass --memory-reservation: Moby has left memory.high=max
// (moby#49599). Write memory.high on the container cgroup after start.
const (
	MemoryMax        = "64g"
	MemorySwap       = "64g" // equal to memory → no extra swap for this cgroup
	CPUShares        = "1024"
	StopTimeoutSec   = 20
	MemoryHighBytes  = 48 << 30
	MemoryOOMGroup   = "1"
	DaemonPort       = "8787"
	DefaultSocketDir = "/run/nero/w"
	WSCookieName     = "nero-ws"
)

// GuestEnv is injected at docker create. Secrets come from host.env, not git.
type GuestEnv struct {
	HostToken        string
	AccessToken      string
	OpenRouterAPIKey string
}

func ContainerName(id string) string { return "nero-ws-" + id }

func DatasetName(pool, id string) string { return pool + "/nero/" + id }

func MountPath(mountRoot, id string) string { return mountRoot + "/" + id }

func DockerCreateArgs(image, id, name, mount string, env GuestEnv) []string {
	args := []string{
		"create",
		"--name", ContainerName(id),
		"--label", "nero.workspace.id=" + id,
		"--label", "nero.workspace.name=" + name,
		"--memory=" + MemoryMax,
		"--memory-swap=" + MemorySwap,
		"--cpu-shares=" + CPUShares,
		"--stop-timeout", fmt.Sprintf("%d", StopTimeoutSec),
		"--stop-signal", "SIGRTMIN+3",
		"--hostname", "ws-" + id,
		"--publish", "127.0.0.1::" + DaemonPort,
		"--add-host", "host.docker.internal:host-gateway",
		"--tmpfs", "/tmp:mode=1777",
		"--tmpfs", "/run",
		"--tmpfs", "/run/lock",
		"--shm-size", "1g",
		"--mount", "type=bind,source=" + mount + ",target=/home/nero",
		"--env", "NERO_WORKSPACE_ID=" + id,
		"--env", "NERO_ENVIRONMENT_ID=" + id,
		"--env", "NERO_LABEL=" + name,
		"--env", "NERO_HOST_URL=http://host.docker.internal:8080",
	}
	args = appendEnv(args, "NERO_HOST_TOKEN", env.HostToken)
	args = appendEnv(args, "NERO_ACCESS_TOKEN", env.AccessToken)
	args = appendEnv(args, "OPENROUTER_API_KEY", env.OpenRouterAPIKey)
	return append(args, image)
}

func appendEnv(args []string, key, val string) []string {
	if val == "" {
		return args
	}
	return append(args, "--env", key+"="+val)
}
