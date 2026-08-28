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
