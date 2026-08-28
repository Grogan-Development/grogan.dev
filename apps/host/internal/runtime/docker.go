package runtime

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

type Docker struct {
	Image     string
	Pool      string
	MountRoot string
	run       func(ctx context.Context, name string, args ...string) (string, error)
	readFile  func(name string) ([]byte, error)
	writeFile func(name string, data []byte, perm os.FileMode) error
}

func NewDocker(image, pool, mountRoot string) *Docker {
	return &Docker{
		Image:     image,
		Pool:      pool,
		MountRoot: mountRoot,
		run:       runCmd,
		readFile:  os.ReadFile,
		writeFile: os.WriteFile,
	}
}

func runCmd(ctx context.Context, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	out, err := cmd.CombinedOutput()
	s := strings.TrimSpace(string(out))
	if err != nil {
		if s != "" {
			return s, fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, s)
		}
		return s, fmt.Errorf("%s %s: %w", name, strings.Join(args, " "), err)
	}
	return s, nil
}

func (d *Docker) CreateDataset(ctx context.Context, id string) error {
	ds := DatasetName(d.Pool, id)
	mp := MountPath(d.MountRoot, id)
	_, err := d.run(ctx, "zfs", "create", "-p", "-o", "mountpoint="+mp, ds)
	return err
}

func (d *Docker) DestroyDataset(ctx context.Context, id string) error {
	ds := DatasetName(d.Pool, id)
	_, err := d.run(ctx, "zfs", "destroy", "-r", ds)
	return err
}

func (d *Docker) CreateContainer(ctx context.Context, spec WorkspaceSpec) error {
	mp := MountPath(d.MountRoot, spec.ID)
	args := DockerCreateArgs(d.Image, spec.ID, spec.Name, mp)
	_, err := d.run(ctx, "docker", args...)
	return err
}

func (d *Docker) StartContainer(ctx context.Context, id string) error {
	if _, err := d.run(ctx, "docker", "start", ContainerName(id)); err != nil {
		return err
	}
	// Best-effort: --memory already set memory.max. Do not fail start if
	// cgroupfs is missing (dev) or the path differs across Docker versions.
	_ = d.applyCgroup(ctx, id)
	return nil
}

func (d *Docker) StopContainer(ctx context.Context, id string) error {
	_, err := d.run(ctx, "docker", "stop", "-t", strconv.Itoa(StopTimeoutSec), ContainerName(id))
	return err
}

func (d *Docker) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	out, err := d.run(ctx, "docker", "ps", "-a",
		"--filter", "label=nero.workspace.id",
		"--format", "{{index .Labels \"nero.workspace.id\"}}|{{index .Labels \"nero.workspace.name\"}}|{{.State}}")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return nil, nil
	}
	var list []ContainerInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "|")
		if len(parts) < 3 {
			continue
		}
		list = append(list, ContainerInfo{
			ID:      parts[0],
			Name:    parts[1],
			Running: parts[2] == "running",
		})
	}
	return list, nil
}

func (d *Docker) applyCgroup(ctx context.Context, id string) error {
	pidStr, err := d.run(ctx, "docker", "inspect", "-f", "{{.State.Pid}}", ContainerName(id))
	if err != nil {
		return err
	}
	pid, err := strconv.Atoi(strings.TrimSpace(pidStr))
	if err != nil || pid <= 0 {
		return fmt.Errorf("container pid %q", pidStr)
	}
	raw, err := d.readFile(fmt.Sprintf("/proc/%d/cgroup", pid))
	if err != nil {
		return err
	}
	rel := cgroupRel(string(raw))
	if rel == "" {
		return fmt.Errorf("no cgroup v2 path for pid %d", pid)
	}
	dir := filepath.Join("/sys/fs/cgroup", rel)
	high := []byte(strconv.FormatInt(MemoryHighBytes, 10))
	if err := d.writeFile(filepath.Join(dir, "memory.high"), high, 0o644); err != nil {
		return err
	}
	return d.writeFile(filepath.Join(dir, "memory.oom.group"), []byte(MemoryOOMGroup), 0o644)
}

func cgroupRel(procCgroup string) string {
	for _, line := range strings.Split(procCgroup, "\n") {
		line = strings.TrimSpace(line)
		if rest, ok := strings.CutPrefix(line, "0::"); ok {
			return strings.TrimPrefix(rest, "/")
		}
	}
	return ""
}
