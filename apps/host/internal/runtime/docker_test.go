package runtime

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"testing"
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
				return "0", nil
			}
			return "", nil
		},
	}
	if err := d.StartContainer(context.Background(), "abc"); err != nil {
		t.Fatalf("start must succeed: %v", err)
	}
}
