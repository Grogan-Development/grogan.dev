package config

import "testing"

func TestFromEnvSecretsAndSocketDir(t *testing.T) {
	t.Setenv("NERO_ACCESS_TOKEN", "access")
	t.Setenv("OPENROUTER_API_KEY", "sk-or")
	t.Setenv("NERO_SOCK_DIR", "/tmp/nero-w")
	cfg := FromEnv()
	if cfg.AccessToken != "access" || cfg.OpenRouterAPIKey != "sk-or" || cfg.SocketDir != "/tmp/nero-w" {
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
	if err := (Config{DevBypass: true}).AuthReady(); err != nil {
		t.Fatal(err)
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
