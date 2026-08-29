package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
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
	HostToken string
	log       *slog.Logger
	run       func(ctx context.Context, name string, args ...string) (string, error)
	readFile  func(name string) ([]byte, error)
	writeFile func(name string, data []byte, perm os.FileMode) error
}

func NewDocker(image, pool, mountRoot, hostToken string, log *slog.Logger) *Docker {
	if log == nil {
		log = slog.Default()
	}
	return &Docker{
		Image:     image,
		Pool:      pool,
		MountRoot: mountRoot,
		HostToken: hostToken,
		log:       log,
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
	args := DockerCreateArgs(d.Image, spec.ID, spec.Name, mp, d.HostToken)
	_, err := d.run(ctx, "docker", args...)
	return err
}

func (d *Docker) StartContainer(ctx context.Context, id string) error {
	if _, err := d.run(ctx, "docker", "start", ContainerName(id)); err != nil {
		return err
	}
	// Best-effort: --memory already set memory.max. Do not fail start if
	// cgroupfs is missing (dev) or the path differs across Docker versions.
	_ = d.ApplyCgroup(ctx, id)
	return nil
}

func (d *Docker) StopContainer(ctx context.Context, id string) error {
	_, err := d.run(ctx, "docker", "stop", "-t", strconv.Itoa(StopTimeoutSec), ContainerName(id))
	return err
}

func (d *Docker) InspectContainer(ctx context.Context, id string) (ContainerInfo, error) {
	out, err := d.run(ctx, "docker", "inspect", "--format",
		`{"id":{{json (index .Config.Labels "nero.workspace.id")}},"name":{{json (index .Config.Labels "nero.workspace.name")}},"running":{{json .State.Running}}}`,
		ContainerName(id))
	if err != nil {
		return ContainerInfo{}, err
	}
	var row struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Running bool   `json:"running"`
	}
	if err := json.Unmarshal([]byte(out), &row); err != nil {
		return ContainerInfo{}, fmt.Errorf("inspect json: %w", err)
	}
	return ContainerInfo{ID: row.ID, Name: row.Name, Running: row.Running}, nil
}

func (d *Docker) ListContainers(ctx context.Context) ([]ContainerInfo, error) {
	out, err := d.run(ctx, "docker", "ps", "-a",
		"--filter", "label=nero.workspace.id",
		"--format", "{{json .}}")
	if err != nil {
		return nil, err
	}
	return parseDockerPS(out)
}

func (d *Docker) ApplyCgroup(ctx context.Context, id string) error {
	dir, err := d.applyCgroup(ctx, id)
	if err != nil && d.log != nil {
		d.log.Warn("cgroup apply failed", "id", id, "dir", dir, "err", err)
	}
	return err
}

func (d *Docker) applyCgroup(ctx context.Context, id string) (string, error) {
	pidStr, err := d.run(ctx, "docker", "inspect", "-f", "{{.State.Pid}}", ContainerName(id))
	if err != nil {
		return "", err
	}
	pid, err := strconv.Atoi(strings.TrimSpace(pidStr))
	if err != nil || pid <= 0 {
		return "", fmt.Errorf("container pid %q", pidStr)
	}
	raw, err := d.readFile(fmt.Sprintf("/proc/%d/cgroup", pid))
	if err != nil {
		return "", err
	}
	rel := cgroupRel(string(raw))
	if rel == "" {
		return "", fmt.Errorf("no cgroup v2 path for pid %d", pid)
	}
	dir := filepath.Join("/sys/fs/cgroup", rel)
	high := []byte(strconv.FormatInt(MemoryHighBytes, 10))
	if err := d.writeFile(filepath.Join(dir, "memory.high"), high, 0o644); err != nil {
		return dir, err
	}
	if err := d.writeFile(filepath.Join(dir, "memory.oom.group"), []byte(MemoryOOMGroup), 0o644); err != nil {
		return dir, err
	}
	return dir, nil
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

// docker ps --format '{{json .}}' is NDJSON. Labels is a comma-separated
// k=v string; State is its own field (so a '|' in the name cannot shift running).
type dockerPsRow struct {
	State  string `json:"State"`
	Labels string `json:"Labels"`
}

func parseDockerPS(out string) ([]ContainerInfo, error) {
	out = strings.TrimSpace(out)
	if out == "" {
		return nil, nil
	}
	if strings.HasPrefix(out, "[") {
		var rows []dockerPsRow
		if err := json.Unmarshal([]byte(out), &rows); err != nil {
			return nil, fmt.Errorf("docker ps json array: %w", err)
		}
		list := make([]ContainerInfo, 0, len(rows))
		for _, row := range rows {
			info, ok := row.info()
			if ok {
				list = append(list, info)
			}
		}
		return list, nil
	}
	var list []ContainerInfo
	dec := json.NewDecoder(strings.NewReader(out))
	for {
		var row dockerPsRow
		if err := dec.Decode(&row); err != nil {
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("docker ps json: %w", err)
		}
		info, ok := row.info()
		if ok {
			list = append(list, info)
		}
	}
	return list, nil
}

func (row dockerPsRow) info() (ContainerInfo, bool) {
	labels := parseLabelString(row.Labels)
	id := labels["nero.workspace.id"]
	if id == "" {
		return ContainerInfo{}, false
	}
	return ContainerInfo{
		ID:      id,
		Name:    labels["nero.workspace.name"],
		Running: row.State == "running",
	}, true
}

func parseLabelString(s string) map[string]string {
	m := make(map[string]string)
	if s == "" {
		return m
	}
	for _, part := range strings.Split(s, ",") {
		k, v, ok := strings.Cut(part, "=")
		if ok {
			m[k] = v
		}
	}
	return m
}
