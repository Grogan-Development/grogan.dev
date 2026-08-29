package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestAPIAuthenticateWithCode(t *testing.T) {
	var got map[string]any
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method=%s", r.Method)
		}
		if r.URL.Path != "/user_management/authenticate" {
			t.Errorf("path=%s", r.URL.Path)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("content-type=%s", r.Header.Get("Content-Type"))
		}
		b, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(b, &got); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"user":{"id":"user_1","email":"z@grogan.dev"},"access_token":"at","refresh_token":"rt"}`)
	}))
	defer ts.Close()

	c := &API{APIKey: "sk_test", ClientID: "client_test", BaseURL: ts.URL, HTTP: ts.Client()}
	u, err := c.AuthenticateWithCode(context.Background(), "abc123", "verifier")
	if err != nil {
		t.Fatal(err)
	}
	if u.ID != "user_1" || u.Email != "z@grogan.dev" {
		t.Fatalf("%+v", u)
	}
	if got["grant_type"] != "authorization_code" {
		t.Fatalf("grant_type=%v", got["grant_type"])
	}
	if got["code"] != "abc123" {
		t.Fatalf("code=%v", got["code"])
	}
	if got["client_id"] != "client_test" {
		t.Fatalf("client_id=%v", got["client_id"])
	}
	if got["client_secret"] != "sk_test" {
		t.Fatalf("client_secret=%v", got["client_secret"])
	}
	if got["code_verifier"] != "verifier" {
		t.Fatalf("code_verifier=%v", got["code_verifier"])
	}
}

func TestAPIAuthenticateWithCodeRejects(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "nope", http.StatusUnauthorized)
	}))
	defer ts.Close()
	c := &API{APIKey: "sk", ClientID: "c", BaseURL: ts.URL, HTTP: ts.Client()}
	if _, err := c.AuthenticateWithCode(context.Background(), "bad", "v"); err == nil {
		t.Fatal("expected error")
	}
}

func TestAuthorizationURL(t *testing.T) {
	got, err := AuthorizationURL("https://authkit.example/start", "client_test", "https://grogan.dev/auth/callback", "st", "chal")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Host != "authkit.example" || u.Path != "/start" {
		t.Fatalf("base %s", got)
	}
	q := u.Query()
	if q.Get("provider") != "authkit" {
		t.Fatalf("provider=%s", q.Get("provider"))
	}
	if q.Get("response_type") != "code" {
		t.Fatalf("response_type=%s", q.Get("response_type"))
	}
	if q.Get("client_id") != "client_test" {
		t.Fatalf("client_id=%s", q.Get("client_id"))
	}
	if q.Get("redirect_uri") != "https://grogan.dev/auth/callback" {
		t.Fatalf("redirect_uri=%s", q.Get("redirect_uri"))
	}
	if q.Get("state") != "st" {
		t.Fatalf("state=%s", q.Get("state"))
	}
	if q.Get("code_challenge") != "chal" || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("pkce=%s", u.RawQuery)
	}
}

func TestAuthorizationURLDefault(t *testing.T) {
	got, err := AuthorizationURL("", "client_test", "https://nero.grogan.dev/auth/callback", "st", "chal")
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.Host != "api.workos.com" || u.Path != "/user_management/authorize" {
		t.Fatalf("default %s", got)
	}
	if u.Query().Get("provider") != "authkit" {
		t.Fatal(u.Query().Get("provider"))
	}
	if u.Query().Get("code_challenge_method") != "S256" {
		t.Fatal(u.Query().Get("code_challenge_method"))
	}
}

func TestRandomPKCE(t *testing.T) {
	v, ch, err := RandomPKCE()
	if err != nil || v == "" || ch == "" {
		t.Fatalf("v=%q ch=%q err=%v", v, ch, err)
	}
	sum := sha256.Sum256([]byte(v))
	want := base64.RawURLEncoding.EncodeToString(sum[:])
	if ch != want {
		t.Fatalf("challenge %s want %s", ch, want)
	}
}
