package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testPW = "0123456789abcdef0123456789abcdef"

func TestSealRoundTrip(t *testing.T) {
	sealed, err := Seal(Session{UserID: "user_1", Email: "z@grogan.dev"}, testPW)
	if err != nil {
		t.Fatal(err)
	}
	got, err := Unseal(sealed, testPW)
	if err != nil {
		t.Fatal(err)
	}
	if got.UserID != "user_1" || got.Email != "z@grogan.dev" {
		t.Fatalf("%+v", got)
	}
}

func TestUnsealRejectsTamperAndWrongPassword(t *testing.T) {
	sealed, err := Seal(Session{UserID: "user_1"}, testPW)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Unseal(sealed+"x", testPW); err == nil {
		t.Fatal("tamper")
	}
	if _, err := Unseal(sealed, "other-password-32-bytes-long!!!!"); err == nil {
		t.Fatal("wrong password")
	}
	if _, err := Unseal("", testPW); err == nil {
		t.Fatal("empty")
	}
}

func TestUnsealExpired(t *testing.T) {
	sealed, err := Seal(Session{UserID: "user_1", Exp: time.Now().Add(-time.Minute).Unix()}, testPW)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Unseal(sealed, testPW); err != ErrExpired {
		t.Fatalf("err=%v", err)
	}
}

func TestSessionCookieDomain(t *testing.T) {
	req := httptest.NewRequest("GET", "https://grogan.dev/auth/callback", nil)
	req.Host = "grogan.dev"
	req.Header.Set("X-Forwarded-Proto", "https")
	c := SessionCookie("abc", req)
	if c.Domain != "grogan.dev" {
		t.Fatalf("domain=%s", c.Domain)
	}
	if !c.Secure || !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("%+v", c)
	}

	local := httptest.NewRequest("GET", "http://127.0.0.1/auth/callback", nil)
	lc := SessionCookie("abc", local)
	if lc.Domain != "" {
		t.Fatalf("local domain=%s", lc.Domain)
	}
	if lc.Secure {
		t.Fatal("http cookie should not be Secure")
	}
}

func TestCookieDomainNeroHost(t *testing.T) {
	if got := cookieDomain("nero.grogan.dev"); got != "grogan.dev" {
		t.Fatal(got)
	}
	if got := cookieDomain("nero.grogan.dev:443"); got != "grogan.dev" {
		t.Fatal(got)
	}
	if got := cookieDomain("127.0.0.1:8080"); got != "" {
		t.Fatal(got)
	}
}
