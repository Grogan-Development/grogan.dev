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
	MemoryMax       = "64g"
	MemorySwap      = "64g" // equal to memory → no extra swap for this cgroup
	CPUShares       = "1024"
	StopTimeoutSec  = 20
	MemoryHighBytes = 48 << 30
	MemoryOOMGroup  = "1"
)

func ContainerName(id string) string { return "nero-ws-" + id }

func DatasetName(pool, id string) string { return pool + "/nero/" + id }

func MountPath(mountRoot, id string) string { return mountRoot + "/" + id }

func DockerCreateArgs(image, id, name, mount string) []string {
	return []string{
		"create",
		"--name", ContainerName(id),
		"--label", "nero.workspace.id=" + id,
		"--label", "nero.workspace.name=" + name,
		"--memory=" + MemoryMax,
		"--memory-swap=" + MemorySwap,
		"--cpu-shares=" + CPUShares,
		"--stop-timeout", fmt.Sprintf("%d", StopTimeoutSec),
		"--hostname", "ws-" + id,
		"--mount", "type=bind,source=" + mount + ",target=/home/nero",
		image,
	}
}
