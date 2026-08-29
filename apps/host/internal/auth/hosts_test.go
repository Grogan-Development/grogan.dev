package auth

import (
	"net/http/httptest"
	"testing"
)

func TestNormalizeHost(t *testing.T) {
	cases := map[string]string{
		"grogan.dev":          "grogan.dev",
		"GROGAN.DEV":          "grogan.dev",
		"grogan.dev:443":      "grogan.dev",
		"grogan.dev:80":       "grogan.dev",
		"nero.grogan.dev:443": "nero.grogan.dev",
		"www.grogan.dev":      "www.grogan.dev",
		"grogan.dev:8080":     "grogan.dev:8080",
		"evil.example":        "evil.example",
	}
	for in, want := range cases {
		if got := NormalizeHost(in); got != want {
			t.Errorf("%q: got %q want %q", in, got, want)
		}
	}
}

func TestAllowedRedirectHost(t *testing.T) {
	for _, h := range []string{"grogan.dev", "www.grogan.dev", "nero.grogan.dev", "nero.grogan.dev:443"} {
		if !AllowedRedirectHost(h) {
			t.Errorf("allowed %s", h)
		}
	}
	for _, h := range []string{"evil.example", "127.0.0.1", "grogan.dev:8080", "auth.grogan.dev"} {
		if AllowedRedirectHost(h) {
			t.Errorf("not allowed %s", h)
		}
	}
}

func TestRedirectOrigin(t *testing.T) {
	req := httptest.NewRequest("GET", "http://127.0.0.1/auth/login", nil)
	req.Host = "grogan.dev"
	got, err := RedirectOrigin(req)
	if err != nil || got != "https://grogan.dev" {
		t.Fatalf("got %q err=%v", got, err)
	}
	req.Host = "evil.example"
	if _, err := RedirectOrigin(req); err != ErrRedirectHost {
		t.Fatalf("err=%v", err)
	}
}
