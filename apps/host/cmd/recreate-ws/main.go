// One-off ops tool: recreate workspace containers in place with the CURRENT
// derived per-workspace tokens (and the current image tag). Used after a host
// redeploy that changes the token scheme or the guest image — old containers
// keep their create-time env and must be recreated to pick up new values.
//
// The dataset (/var/lib/nero/ws/<id>) survives; only the container is
// replaced. The landlord adopts the new container on its next reconcile tick
// (the nero.workspace.id label is preserved).
//
// Usage (on Grid-01, from apps/host):
//
//	go run ./cmd/recreate-ws <id>:<name> [id:<name> ...]
//
// Example:
//
//	go run ./cmd/recreate-ws 7419a5b2049920f1:Updated-Test
//
// Reads /etc/nero/host.env for the host secrets and image tag. Never prints
// secrets; docker create errors are redacted by runtime.argvForErrors.
package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"nero-host/internal/runtime"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: recreate-ws <id>:<name> [id:name ...]")
		os.Exit(2)
	}
	env := map[string]string{}
	f, err := os.Open("/etc/nero/host.env")
	if err != nil {
		panic(err)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if k, v, ok := strings.Cut(line, "="); ok {
			env[strings.TrimSpace(k)] = strings.TrimSpace(v)
		}
	}
	for _, arg := range os.Args[1:] {
		id, name, ok := strings.Cut(arg, ":")
		if !ok {
			name = ""
		}
		if !runtime.ValidWorkspaceID(id) {
			fmt.Fprintf(os.Stderr, "invalid workspace id %q\n", id)
			os.Exit(1)
		}
		if name == "" {
			name = "workspace-" + id[:4]
		}
		mount := "/var/lib/nero/ws/" + id
		image := env["NERO_GUEST_IMAGE"]
		if image == "" {
			image = "nero-guest:v1"
		}
		args := runtime.DockerCreateArgs(image, id, name, mount, runtime.GuestEnv{
			HostToken:      runtime.DeriveWorkspaceToken(env["NERO_HOST_TOKEN"], id),
			AccessToken:    runtime.DeriveWorkspaceToken(env["NERO_ACCESS_TOKEN"], id),
			ZaiAPIKey:      env["ZAI_API_KEY"],
			BasetenAPIKey:  env["BASETEN_API_KEY"],
			OpenCodeAPIKey: env["OPENCODE_API_KEY"],
			LoomURL:        env["LOOM_URL"],
			LoomToken:      env["LOOM_TOKEN"],
			ZaiBaseUrl:     env["ZAI_BASE_URL"],
			NeroModel:      env["NERO_MODEL"],
		})
		// Replacing in place: drop the existing container (it holds the
		// create-time env we are migrating away from). Dataset untouched.
		_ = exec.Command("docker", "rm", "-f", runtime.ContainerName(id)).Run()
		if out, err := exec.Command("docker", args...).CombinedOutput(); err != nil {
			fmt.Printf("create %s failed: %v: %s\n", id, err, out)
			os.Exit(1)
		}
		if out, err := exec.Command("docker", "start", runtime.ContainerName(id)).CombinedOutput(); err != nil {
			fmt.Printf("start %s failed: %v: %s\n", id, err, out)
			os.Exit(1)
		}
		fmt.Printf("recreated %s (%s)\n", id, name)
	}
}
