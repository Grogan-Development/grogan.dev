package config

import "testing"

func TestFromEnvSecretsAndSocketDir(t *testing.T) {
	t.Setenv("NERO_ACCESS_TOKEN", "access")
	t.Setenv("ZAI_API_KEY", "zai-key")
	t.Setenv("BASETEN_API_KEY", "bt-key")
	t.Setenv("NERO_SOCK_DIR", "/tmp/nero-w")
	cfg := FromEnv()
	if cfg.AccessToken != "access" || cfg.ZaiAPIKey != "zai-key" || cfg.BasetenAPIKey != "bt-key" || cfg.SocketDir != "/tmp/nero-w" {
		t.Fatalf("%+v", cfg)
	}
}

func TestAuthReady(t *testing.T) {
	ok := Config{
		WorkOSClientID: "client",
		WorkOSAPIKey:   "sk",
		CookiePassword: "0123456789abcdef0123456789abcdef",
		AccessToken:    "guest-token",
	}
	if err := ok.AuthReady(); err != nil {
		t.Fatal(err)
	}
	if err := (Config{DevBypass: true, Listen: "127.0.0.1:8080"}).AuthReady(); err != nil {
		t.Fatal(err)
	}
	if err := (Config{DevBypass: true, Listen: "localhost:8080"}).AuthReady(); err != nil {
		t.Fatal(err)
	}
	// Dev bypass disables every auth check, so it must refuse any listener
	// that is not loopback (including "" = all interfaces).
	for _, listen := range []string{"", ":8080", "0.0.0.0:8080", "104.238.222.91:8080"} {
		if err := (Config{DevBypass: true, Listen: listen}).AuthReady(); err == nil {
			t.Fatalf("dev bypass should refuse listener %q", listen)
		}
	}
	if err := (Config{}).AuthReady(); err == nil {
		t.Fatal("empty should fail")
	}
	short := ok
	short.CookiePassword = "too-short"
	if err := short.AuthReady(); err == nil {
		t.Fatal("short password")
	}
	noTok := ok
	noTok.AccessToken = ""
	if err := noTok.AuthReady(); err == nil {
		t.Fatal("missing NERO_ACCESS_TOKEN")
	}
}
