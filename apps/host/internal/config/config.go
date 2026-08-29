package config

import (
	"os"
	"time"
)

type Config struct {
	Listen         string
	DevBypass      bool
	AuthKitURL     string
	WorkOSAPIKey   string
	WorkOSClientID string
	CookiePassword string
	GuestImage     string
	ZFSPool        string
	MountRoot      string
	IdleTick       time.Duration
}

func FromEnv() Config {
	tick := 10 * time.Second
	if v := os.Getenv("NERO_IDLE_TICK"); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			tick = d
		}
	}
	return Config{
		Listen:         env("NERO_LISTEN", ":8080"),
		DevBypass:      os.Getenv("NERO_DEV_BYPASS") == "1",
		AuthKitURL:     os.Getenv("WORKOS_AUTHKIT_URL"),
		WorkOSAPIKey:   os.Getenv("WORKOS_API_KEY"),
		WorkOSClientID: os.Getenv("WORKOS_CLIENT_ID"),
		CookiePassword: os.Getenv("WORKOS_COOKIE_PASSWORD"),
		GuestImage:     env("NERO_GUEST_IMAGE", "nero-guest:v1"),
		ZFSPool:        env("NERO_ZFS_POOL", "grid"),
		MountRoot:      env("NERO_WS_MOUNT", "/var/lib/nero/ws"),
		IdleTick:       tick,
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
