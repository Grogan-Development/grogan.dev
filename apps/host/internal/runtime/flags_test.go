package runtime

import (
	"strings"
	"testing"
)

func TestDockerCreateArgsCgroupPolicy(t *testing.T) {
	args := DockerCreateArgs("nero-guest:v1", "abc", "ws", "/var/lib/nero/ws/abc", GuestEnv{
		HostToken:        "tok",
		AccessToken:      "access",
		ZaiAPIKey: "zai-key-test",
		BasetenAPIKey: "bt-key-test",
	})
	joined := strings.Join(args, " ")
	for _, want := range []string{
		"NERO_HOST_TOKEN=tok",
		"NERO_WORKSPACE_ID=abc",
		"NERO_ENVIRONMENT_ID=abc",
		"NERO_LABEL=ws",
		"NERO_ACCESS_TOKEN=access",
		"ZAI_API_KEY=zai-key-test",
		"BASETEN_API_KEY=bt-key-test",
		"--memory=64g",
		"--memory-swap=64g",
		"--cpu-shares=1024",
		"--stop-timeout 20",
		"--publish 127.0.0.1::8787",
		"--add-host host.docker.internal:host-gateway",
		"NERO_HOST_URL=http://host.docker.internal:8080",
		"--tmpfs /tmp:rw,nosuid,nodev,exec,mode=1777",
		"--tmpfs /run",
		"--shm-size 1g",
		"--stop-signal SIGRTMIN+3",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing %q in %s", want, joined)
		}
	}
	for _, bad := range []string{"--cpus", "--memory-reservation"} {
		for _, a := range args {
			if a == bad || strings.HasPrefix(a, bad+"=") {
				t.Errorf("forbidden flag %s in %v", bad, args)
			}
		}
	}
	if args[len(args)-1] != "nero-guest:v1" {
		t.Fatalf("image must be last: %v", args)
	}
}

func TestDockerCreateArgsOmitsEmptySecrets(t *testing.T) {
	args := DockerCreateArgs("nero-guest:v1", "abc", "ws", "/var/lib/nero/ws/abc", GuestEnv{})
	joined := strings.Join(args, " ")
	for _, leak := range []string{
		"ZAI_API_KEY=zai-key-test",
		"BASETEN_API_KEY=bt-key-test",
		"OPENCODE_API_KEY=",
		"LOOM_URL=",
		"LOOM_TOKEN=",
		"NERO_ACCESS_TOKEN=",
		"NERO_HOST_TOKEN=",
	} {
		if strings.Contains(joined, leak) {
			t.Errorf("empty secret should be omitted: %s", leak)
		}
	}
}

func TestDockerCreateArgsForwardsLoom(t *testing.T) {
	args := DockerCreateArgs("nero-guest:v1", "abc", "ws", "/var/lib/nero/ws/abc", GuestEnv{
		LoomURL:   "https://loom.grogan.dev",
		LoomToken: "loom-tok",
	})
	joined := strings.Join(args, " ")
	for _, want := range []string{"LOOM_URL=https://loom.grogan.dev", "LOOM_TOKEN=loom-tok"} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing %q in %s", want, joined)
		}
	}
}

func TestValidWorkspaceID(t *testing.T) {
	if !ValidWorkspaceID("0123456789abcdef") {
		t.Fatal("16 hex")
	}
	if ValidWorkspaceID("../etc/passwd") || ValidWorkspaceID("ABC") || ValidWorkspaceID("short") {
		t.Fatal("rejected ids")
	}
}
