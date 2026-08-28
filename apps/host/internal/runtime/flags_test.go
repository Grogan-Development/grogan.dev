package runtime

import (
	"strings"
	"testing"
)

func TestDockerCreateArgsCgroupPolicy(t *testing.T) {
	args := DockerCreateArgs("nero-guest:v1", "abc", "ws", "/var/lib/nero/ws/abc")
	joined := strings.Join(args, " ")
	want := []string{
		"--memory=64g",
		"--memory-swap=64g",
		"--cpu-shares=1024",
		"--stop-timeout 20",
	}
	for _, w := range want {
		if !strings.Contains(joined, w) {
			t.Errorf("missing %q in %s", w, joined)
		}
	}
	for _, bad := range []string{"--cpus", "--memory-reservation"} {
		for _, a := range args {
			if a == bad || strings.HasPrefix(a, bad+"=") {
				t.Errorf("forbidden flag %s in %v", bad, args)
			}
		}
	}
}
