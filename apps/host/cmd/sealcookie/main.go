// sealcookie is a test helper: prints a "Cookie: wos-session=..." header for
// e2e calls against the control plane. Server-side only — reads secrets from
// /etc/nero/host.env and must never be deployed to a public machine.
package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"nero-host/internal/auth"
)

func main() {
	env := map[string]string{}
	f, err := os.Open("/etc/nero/host.env")
	if err != nil {
		panic(err)
	}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if k, v, ok := strings.Cut(line, "="); ok {
			env[k] = v
		}
	}
	email := strings.Split(env["NERO_ALLOWED_EMAILS"], ",")[0]
	val, err := auth.Seal(auth.Session{
		UserID: "e2e-test",
		Email:  email,
		Exp:    time.Now().Add(time.Hour).Unix(),
	}, env["WORKOS_COOKIE_PASSWORD"])
	if err != nil {
		panic(err)
	}
	fmt.Print("Cookie: wos-session=" + val)
}
