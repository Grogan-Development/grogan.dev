package runtime

import (
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestCgroupRel(t *testing.T) {
	got := cgroupRel("0::/system.slice/docker-abc.scope\n")
	if got != "system.slice/docker-abc.scope" {
		t.Fatalf("got %q", got)
	}
	if cgroupRel("1:name=systemd:/\n") != "" {
		t.Fatal("expected empty for non-v2")
	}
}

func TestParseDockerPSPipeInNameDoesNotShiftState(t *testing.T) {
	out := `{"ID":"deadbeef","State":"running","Labels":"nero.workspace.id=abc,nero.workspace.name=foo|bar"}
{"ID":"cafebabe","State":"exited","Labels":"nero.workspace.id=def,nero.workspace.name=other"}`
	list, err := parseDockerPS(out)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("len=%d", len(list))
	}
	byID := map[string]ContainerInfo{}
	for _, c := range list {
		byID[c.ID] = c
	}
	if byID["abc"].Name != "foo|bar" || !byID["abc"].Running {
		t.Fatalf("abc=%+v", byID["abc"])
	}
	if byID["def"].Running {
		t.Fatalf("def should be stopped: %+v", byID["def"])
	}
}

func TestParseDockerPSEmpty(t *testing.T) {
	list, err := parseDockerPS("")
	if err != nil || len(list) != 0 {
		t.Fatalf("list=%v err=%v", list, err)
	}
}

func TestStartContainerWritesMemoryHigh(t *testing.T) {
	writes := map[string]string{}
	d := &Docker{
		run: func(_ context.Context, name string, args ...string) (string, error) {
			if name == "docker" && len(args) > 0 && args[0] == "start" {
				return "", nil
			}
			if name == "docker" && len(args) > 0 && args[0] == "inspect" {
				if strings.Contains(strings.Join(args, " "), "HostPort") {
					return "32768", nil
				}
				return "42", nil
			}
			t.Fatalf("unexpected %s %v", name, args)
			return "", nil
		},
		readFile: func(name string) ([]byte, error) {
			if name != "/proc/42/cgroup" {
				t.Fatalf("read %s", name)
			}
			return []byte("0::/system.slice/docker-abc.scope\n"), nil
		},
		writeFile: func(name string, data []byte, perm os.FileMode) error {
			writes[name] = string(data)
			return nil
		},
	}
	if err := d.StartContainer(context.Background(), "abc"); err != nil {
		t.Fatal(err)
	}
	dir := filepath.Join("/sys/fs/cgroup", "system.slice/docker-abc.scope")
	if writes[filepath.Join(dir, "memory.high")] != strconv.FormatInt(MemoryHighBytes, 10) {
		t.Fatalf("memory.high=%q", writes[filepath.Join(dir, "memory.high")])
	}
	if writes[filepath.Join(dir, "memory.oom.group")] != MemoryOOMGroup {
		t.Fatalf("oom.group=%q", writes[filepath.Join(dir, "memory.oom.group")])
	}
}

func TestStartContainerCgroupFailureDoesNotFailStart(t *testing.T) {
	d := &Docker{
		run: func(_ context.Context, name string, args ...string) (string, error) {
			if name == "docker" && len(args) > 0 && args[0] == "start" {
				return "", nil
			}
			if name == "docker" && len(args) > 0 && args[0] == "inspect" {
				if strings.Contains(strings.Join(args, " "), "HostPort") {
					return "32768", nil
				}
				return "0", nil
			}
			return "", nil
		},
	}
	if err := d.StartContainer(context.Background(), "abc"); err != nil {
		t.Fatalf("start must succeed: %v", err)
	}
}

func TestCreateContainerRequiresAccessToken(t *testing.T) {
	d := &Docker{
		Image: "nero-guest:v1",
		run: func(_ context.Context, name string, args ...string) (string, error) {
			t.Fatal("docker must not run without token")
			return "", nil
		},
	}
	if err := d.CreateContainer(context.Background(), WorkspaceSpec{ID: "0123456789abcdef", Name: "x"}); err == nil {
		t.Fatal("expected error")
	}
}

func TestWaitDaemonHealthz(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "ok")
	})
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: time.Second}
	go func() { _ = srv.Serve(ln) }()
	defer srv.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := pingDaemonHealthz(ctx, ln.Addr().String()); err != nil {
		t.Fatal(err)
	}
	if err := waitDaemon(ctx, func() error { return pingDaemonHealthz(ctx, ln.Addr().String()) }); err != nil {
		t.Fatal(err)
	}
}

func TestEnsureProxyWaitsThenRecordsPort(t *testing.T) {
	pings := 0
	d := &Docker{
		run: func(_ context.Context, name string, args ...string) (string, error) {
			if name == "docker" && len(args) > 0 && args[0] == "inspect" {
				return "32768", nil
			}
			t.Fatalf("unexpected %s %v", name, args)
			return "", nil
		},
		pingDaemon: func(_ context.Context, addr string) error {
			pings++
			if addr != "127.0.0.1:32768" {
				t.Fatalf("addr=%s", addr)
			}
			if pings < 2 {
				return context.DeadlineExceeded
			}
			return nil
		},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := d.EnsureProxy(ctx, "0123456789abcdef"); err != nil {
		t.Fatal(err)
	}
	got, err := d.DialAddr("0123456789abcdef")
	if err != nil || got != "127.0.0.1:32768" {
		t.Fatalf("dial=%s err=%v", got, err)
	}
	if pings < 2 {
		t.Fatalf("pings=%d", pings)
	}
}
