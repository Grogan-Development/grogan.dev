package config

import "testing"

func TestAuthReady(t *testing.T) {
	ok := Config{
		WorkOSClientID: "client",
		WorkOSAPIKey:   "sk",
		CookiePassword: "0123456789abcdef0123456789abcdef",
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
}
