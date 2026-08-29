package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type DockerSettings struct {
	Image            string
	Pool             string
	MountRoot        string
	HostToken        string
	AccessToken      string
	OpenRouterAPIKey string
	SocketDir        string
}

type Docker struct {
	Image            string
	Pool             string
	MountRoot        string
	HostToken        string
	AccessToken      string
	OpenRouterAPIKey string
	log              *slog.Logger
	run              func(ctx context.Context, name string, args ...string) (string, error)
	readFile         func(name string) ([]byte, error)
	writeFile        func(name string, data []byte, perm os.FileMode) error
	pingDaemon       func(ctx context.Context, addr string) error

	mu        sync.Mutex
	hostPorts map[string]string
	hub       *proxyHub
}

func NewDocker(cfg DockerSettings, log *slog.Logger) *Docker {
	if log == nil {
		log = slog.Default()
	}
	dir := cfg.SocketDir
	if dir == "" {
		dir = DefaultSocketDir
	}
	return &Docker{
		Image:            cfg.Image,
		Pool:             cfg.Pool,
		MountRoot:        cfg.MountRoot,
		HostToken:        cfg.HostToken,
		AccessToken:      cfg.AccessToken,
		OpenRouterAPIKey: cfg.OpenRouterAPIKey,
		log:              log,
		run:              runCmd,
		readFile:         os.ReadFile,
		writeFile:        os.WriteFile,
		pingDaemon:       pingDaemonHealthz,
		hostPorts:        make(map[string]string),
		hub:              newProxyHub(dir),
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
	if _, err := d.run(ctx, "zfs", "create", "-p", "-o", "mountpoint="+mp, ds); err != nil {
		return err
	}
	// The dataset becomes /home/nero in the guest; a fresh mountpoint is
	// root-owned, which leaves the nero user (uid 1000) unable to write home.
	if err := os.Chown(mp, GuestUID, GuestUID); err != nil {
		return fmt.Errorf("chown %s: %w", mp, err)
	}
	return nil
}

func (d *Docker) DestroyDataset(ctx context.Context, id string) error {
	ds := DatasetName(d.Pool, id)
	_, err := d.run(ctx, "zfs", "destroy", "-r", ds)
	return err
}

func (d *Docker) CreateContainer(ctx context.Context, spec WorkspaceSpec) error {
	if d.AccessToken == "" {
		return fmt.Errorf("NERO_ACCESS_TOKEN is required")
	}
	mp := MountPath(d.MountRoot, spec.ID)
	args := DockerCreateArgs(d.Image, spec.ID, spec.Name, mp, GuestEnv{
		HostToken:         d.HostToken,
		AccessToken:       d.AccessToken,
		OpenRouterAPIKey:  d.OpenRouterAPIKey,
		OpenRouterBaseUrl: os.Getenv("OPENROUTER_BASE_URL"),
		NeroModel:         os.Getenv("NERO_MODEL"),
	})
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
	if err := d.EnsureProxy(ctx, id); err != nil {
		stopCtx, cancel := context.WithTimeout(context.Background(), time.Duration(StopTimeoutSec+5)*time.Second)
		defer cancel()
		_, _ = d.run(stopCtx, "docker", "stop", "-t", strconv.Itoa(StopTimeoutSec), ContainerName(id))
		d.CloseProxy(id)
		return err
	}
	return nil
}

func (d *Docker) StopContainer(ctx context.Context, id string) error {
	_, err := d.run(ctx, "docker", "stop", "-t", strconv.Itoa(StopTimeoutSec), ContainerName(id))
	if err == nil {
		d.CloseProxy(id)
	}
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

const hostPortFormat = `{{with (index .NetworkSettings.Ports "8787/tcp")}}{{with (index . 0)}}{{.HostPort}}{{end}}{{end}}`

func (d *Docker) EnsureProxy(ctx context.Context, id string) error {
	port, err := d.inspectHostPort(ctx, id)
	if err != nil {
		if d.log != nil {
			d.log.Warn("workspace host port inspect failed", "id", id, "err", err)
		}
		return err
	}
	addr := HostDial(port)
	if d.pingDaemon != nil {
		if err := waitDaemon(ctx, func() error { return d.pingDaemon(ctx, addr) }); err != nil {
			return fmt.Errorf("daemon %s: %w", addr, err)
		}
	}
	d.mu.Lock()
	if d.hostPorts == nil {
		d.hostPorts = make(map[string]string)
	}
	d.hostPorts[id] = port
	d.mu.Unlock()
	if d.hub == nil {
		return nil
	}
	if err := d.hub.bind(id, port); err != nil {
		if d.log != nil {
			d.log.Warn("workspace unix socket bind failed", "id", id, "err", err)
		}
		return err
	}
	return nil
}

func waitDaemon(ctx context.Context, ping func() error) error {
	var last error
	if err := ping(); err == nil {
		return nil
	} else {
		last = err
	}
	t := time.NewTicker(200 * time.Millisecond)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			if last == nil {
				last = ctx.Err()
			}
			return last
		case <-t.C:
			if err := ping(); err == nil {
				return nil
			} else {
				last = err
			}
		}
	}
}

func pingDaemonHealthz(ctx context.Context, addr string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+addr+"/healthz", nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz status %s", res.Status)
	}
	return nil
}

func (d *Docker) CloseProxy(id string) {
	d.mu.Lock()
	delete(d.hostPorts, id)
	d.mu.Unlock()
	if d.hub != nil {
		d.hub.close(id)
	}
}

func (d *Docker) DialAddr(id string) (string, error) {
	d.mu.Lock()
	port := d.hostPorts[id]
	d.mu.Unlock()
	if port == "" {
		return "", fmt.Errorf("no host port for %s", id)
	}
	return HostDial(port), nil
}

func (d *Docker) inspectHostPort(ctx context.Context, id string) (string, error) {
	out, err := d.run(ctx, "docker", "inspect", "--format", hostPortFormat, ContainerName(id))
	if err != nil {
		return "", err
	}
	port := strings.TrimSpace(out)
	if port == "" || port == "0" || !isDigits(port) {
		return "", fmt.Errorf("container %s has no published %s/tcp port", id, DaemonPort)
	}
	return port, nil
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
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
