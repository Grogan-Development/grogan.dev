package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

const MinCookiePasswordLen = 32

type Config struct {
	Listen           string
	DevBypass        bool
	AuthKitURL       string
	WorkOSAPIKey     string
	WorkOSClientID   string
	CookiePassword   string
	AllowedEmails    []string
	HostToken        string
	AccessToken      string
	OpenRouterAPIKey string
	GuestImage       string
	ZFSPool          string
	MountRoot        string
	SocketDir        string
	IdleTick         time.Duration
}

func FromEnv() Config {
	tick := 10 * time.Second
	if v := os.Getenv("NERO_IDLE_TICK"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			tick = d
		}
	}
	return Config{
		Listen:           env("NERO_LISTEN", ":8080"),
		DevBypass:        os.Getenv("NERO_DEV_BYPASS") == "1",
		AuthKitURL:       os.Getenv("WORKOS_AUTHKIT_URL"),
		WorkOSAPIKey:     os.Getenv("WORKOS_API_KEY"),
		WorkOSClientID:   os.Getenv("WORKOS_CLIENT_ID"),
		CookiePassword:   os.Getenv("WORKOS_COOKIE_PASSWORD"),
		AllowedEmails:    splitCSV(os.Getenv("NERO_ALLOWED_EMAILS")),
		HostToken:        os.Getenv("NERO_HOST_TOKEN"),
		AccessToken:      os.Getenv("NERO_ACCESS_TOKEN"),
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		GuestImage:       env("NERO_GUEST_IMAGE", "nero-guest:v1"),
		ZFSPool:          env("NERO_ZFS_POOL", "grid"),
		MountRoot:        env("NERO_WS_MOUNT", "/var/lib/nero/ws"),
		SocketDir:        env("NERO_SOCK_DIR", "/run/nero/w"),
		IdleTick:         tick,
	}
}

func (c Config) AuthReady() error {
	if c.DevBypass {
		return nil
	}
	var missing []string
	if c.WorkOSClientID == "" {
		missing = append(missing, "WORKOS_CLIENT_ID")
	}
	if c.WorkOSAPIKey == "" {
		missing = append(missing, "WORKOS_API_KEY")
	}
	if len(c.CookiePassword) < MinCookiePasswordLen {
		missing = append(missing, "WORKOS_COOKIE_PASSWORD")
	}
	if c.AccessToken == "" {
		missing = append(missing, "NERO_ACCESS_TOKEN")
	}
	if len(missing) > 0 {
		return fmt.Errorf("auth not configured: %s", strings.Join(missing, ", "))
	}
	return nil
}

func (c Config) EmailAllowed(email string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return false
	}
	for _, a := range c.AllowedEmails {
		if a == email {
			return true
		}
	}
	return false
}

func splitCSV(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
