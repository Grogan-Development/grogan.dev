package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"nero-host/authmd"
	"nero-host/internal/auth"
	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/internal/runtime"
)

const testCookiePW = "0123456789abcdef0123456789abcdef"

func testServer(t *testing.T, bypass bool) (*httptest.Server, *landlord.Landlord, *runtime.Fake, *auth.Fake) {
	t.Helper()
	rt := runtime.NewFake()
	clk := landlord.NewFakeClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	ll := landlord.New(rt, clk, slog.New(slog.NewTextHandler(io.Discard, nil)))
	wo := auth.NewFake()
	wo.Users["ok"] = auth.User{ID: "user_1", Email: "z@grogan.dev"}
	wo.Users["other"] = auth.User{ID: "user_2", Email: "other@example.com"}
	cfg := config.Config{
		DevBypass:      bypass,
		AuthKitURL:     "https://authkit.example/start",
		WorkOSClientID: "client_test",
		CookiePassword: testCookiePW,
		AllowedEmails:  []string{"z@grogan.dev"},
		HostToken:      "host-token-test",
	}
	srv := New(cfg, ll, wo, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts, ll, rt, wo
}

func noRedirect(ts *httptest.Server) *http.Client {
	c := ts.Client()
	c.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}
	return c
}

func cookie(res *http.Response, name string) *http.Cookie {
	for _, c := range res.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func doHost(t *testing.T, client *http.Client, method, rawURL, host string, cookies []*http.Cookie, body io.Reader) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, rawURL, body)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = host
	req.Header.Set("X-Forwarded-Proto", "https")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

func startLogin(t *testing.T, ts *httptest.Server, host string) (state string, cookies []*http.Cookie) {
	t.Helper()
	res := doHost(t, noRedirect(ts), http.MethodGet, ts.URL+"/auth/login", host, nil, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatal(res.Status)
	}
	loc, err := url.Parse(res.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	st := cookie(res, auth.StateCookieName)
	pk := cookie(res, auth.PKCECookieName)
	if st == nil || pk == nil {
		t.Fatal("missing state/pkce cookies")
	}
	return loc.Query().Get("state"), []*http.Cookie{st, pk}
}

func TestHealthz(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
}

func TestAuthMD(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/auth.md")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	if got := res.Header.Get("Content-Type"); got != "text/markdown; charset=utf-8" {
		t.Fatalf("content-type=%s", got)
	}
	b, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	body := string(b)
	if body != authmd.Markdown {
		t.Fatal("handler body != embedded auth.md")
	}
	for _, heading := range []string{
		"# auth.md",
		"## Step 1 — Discover",
		"## Step 3 — Register",
		"## Step 4 — Claim ceremony",
		"## Step 5 — Exchange the assertion",
	} {
		if !strings.Contains(body, heading) {
			t.Errorf("missing heading %q", heading)
		}
	}
	for _, want := range []string{
		"https://nero.grogan.dev/",
		"https://nero.grogan.dev/api/workspaces",
		"https://nero.grogan.dev/auth/login",
		"https://grogan.dev/auth/login",
		"wos-session",
		"AuthKit hosted UI",
		"requires that session",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("missing %q", want)
		}
	}
	if strings.Contains(strings.ToLower(body), "sign up") {
		t.Fatal("must not tell agents to sign up")
	}
	for _, leak := range []string{
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-authorization-server",
		"/oauth2/token",
		"/oauth2/revoke",
		"/agent/identity",
		"token_endpoint",
		"identity_endpoint",
		"pre_claim_scopes",
		"jwt-bearer",
		"login_hint",
	} {
		if strings.Contains(body, leak) {
			t.Errorf("must not describe undeployed AS surface %q", leak)
		}
	}
}

func TestAuthRequiredWithoutBypass(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/api/workspaces")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d", res.StatusCode)
	}
	want := `Bearer resource_metadata="https://nero.grogan.dev/auth.md"`
	if got := res.Header.Get("WWW-Authenticate"); got != want {
		t.Fatalf("www-authenticate=%q", got)
	}
}

func TestBearerDoesNotUnlockWorkspaces(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/api/workspaces", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer anything")
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d", res.StatusCode)
	}
	want := `Bearer resource_metadata="https://nero.grogan.dev/auth.md"`
	if got := res.Header.Get("WWW-Authenticate"); got != want {
		t.Fatalf("www-authenticate=%q", got)
	}
}

func TestLandingPortalStartsAuthKit(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(b), `href="/auth/login"`) {
		t.Fatalf("portal href missing: %s", b)
	}
}

func TestLoginRedirectsToAuthKit(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/auth/login", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "grogan.dev"
	req.Header.Set("X-Forwarded-Proto", "https")
	res, err := noRedirect(ts).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatal(res.Status)
	}
	loc, err := url.Parse(res.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if loc.Scheme+"://"+loc.Host+loc.Path != "https://authkit.example/start" {
		t.Fatalf("location=%s", loc)
	}
	q := loc.Query()
	if q.Get("provider") != "authkit" || q.Get("response_type") != "code" {
		t.Fatalf("query=%s", loc.RawQuery)
	}
	if q.Get("client_id") != "client_test" {
		t.Fatalf("client_id=%s", q.Get("client_id"))
	}
	if q.Get("redirect_uri") != "https://grogan.dev/auth/callback" {
		t.Fatalf("redirect_uri=%s", q.Get("redirect_uri"))
	}
	if q.Get("state") == "" {
		t.Fatal("missing state")
	}
	if q.Get("code_challenge") == "" || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("pkce query=%s", loc.RawQuery)
	}
	st := cookie(res, auth.StateCookieName)
	if st == nil || st.Value != q.Get("state") {
		t.Fatalf("state cookie=%v", st)
	}
	pk := cookie(res, auth.PKCECookieName)
	if pk == nil || pk.Value == "" {
		t.Fatal("missing pkce cookie")
	}
}

func TestLoginRedirectURIOnNeroHost(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/auth/login", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "nero.grogan.dev"
	req.Header.Set("X-Forwarded-Proto", "https")
	res, err := noRedirect(ts).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	loc, err := url.Parse(res.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if loc.Query().Get("redirect_uri") != "https://nero.grogan.dev/auth/callback" {
		t.Fatalf("redirect_uri=%s", loc.Query().Get("redirect_uri"))
	}
}

func TestCallbackSetsSessionAndRedirects(t *testing.T) {
	ts, _, _, wo := testServer(t, false)
	client := noRedirect(ts)

	loginReq, _ := http.NewRequest(http.MethodGet, ts.URL+"/auth/login", nil)
	loginReq.Host = "grogan.dev"
	loginReq.Header.Set("X-Forwarded-Proto", "https")
	loginRes, err := client.Do(loginReq)
	if err != nil {
		t.Fatal(err)
	}
	loginRes.Body.Close()
	st := cookie(loginRes, auth.StateCookieName)
	pk := cookie(loginRes, auth.PKCECookieName)
	if st == nil || pk == nil {
		t.Fatal("no login cookies")
	}
	loc, err := url.Parse(loginRes.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	state := loc.Query().Get("state")

	cb, _ := http.NewRequest(http.MethodGet, ts.URL+"/auth/callback?code=ok&state="+url.QueryEscape(state), nil)
	cb.Host = "grogan.dev"
	cb.Header.Set("X-Forwarded-Proto", "https")
	cb.AddCookie(st)
	cb.AddCookie(pk)
	cbRes, err := client.Do(cb)
	if err != nil {
		t.Fatal(err)
	}
	defer cbRes.Body.Close()
	if cbRes.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("cache-control=%s", cbRes.Header.Get("Cache-Control"))
	}
	if cbRes.StatusCode != http.StatusFound {
		t.Fatal(cbRes.Status)
	}
	if cbRes.Header.Get("Location") != "https://nero.grogan.dev/" {
		t.Fatalf("location=%s", cbRes.Header.Get("Location"))
	}
	if wo.LastCode != "ok" {
		t.Fatalf("code=%s", wo.LastCode)
	}
	if wo.LastVerifier != pk.Value {
		t.Fatalf("verifier=%s", wo.LastVerifier)
	}
	sess := cookie(cbRes, auth.CookieName)
	if sess == nil || sess.Value == "" {
		t.Fatal("missing session cookie")
	}
	if sess.Domain != "grogan.dev" {
		t.Fatalf("domain=%s", sess.Domain)
	}
	if !sess.HttpOnly || !sess.Secure {
		t.Fatalf("%+v", sess)
	}

	apiReq, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/workspaces", nil)
	apiReq.AddCookie(sess)
	apiRes, err := client.Do(apiReq)
	if err != nil {
		t.Fatal(err)
	}
	defer apiRes.Body.Close()
	if apiRes.StatusCode != 200 {
		t.Fatal(apiRes.Status)
	}
}

func TestCallbackRejectsBadCodeAndState(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	client := noRedirect(ts)

	res := doHost(t, client, http.MethodGet, ts.URL+"/auth/callback", "grogan.dev", nil, nil)
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing code status=%d", res.StatusCode)
	}

	state, cookies := startLogin(t, ts, "grogan.dev")

	res = doHost(t, client, http.MethodGet, ts.URL+"/auth/callback?code=ok&state=nope", "grogan.dev", cookies, nil)
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad state status=%d", res.StatusCode)
	}

	res = doHost(t, client, http.MethodGet, ts.URL+"/auth/callback?code=nope&state="+url.QueryEscape(state), "grogan.dev", cookies, nil)
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bad code status=%d", res.StatusCode)
	}
}

func TestAPIRejectsTamperedSession(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/workspaces", nil)
	req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: "not-a-session"})
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d", res.StatusCode)
	}
}

func TestSessionAllowsCreate(t *testing.T) {
	ts, _, rt, _ := testServer(t, false)
	client := noRedirect(ts)
	state, cookies := startLogin(t, ts, "grogan.dev")
	cbRes := doHost(t, client, http.MethodGet, ts.URL+"/auth/callback?code=ok&state="+url.QueryEscape(state), "grogan.dev", cookies, nil)
	cbRes.Body.Close()
	sess := cookie(cbRes, auth.CookieName)

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/workspaces", strings.NewReader(`{"name":"alpha"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(sess)
	res, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatal(res.Status)
	}
	var ws landlord.Workspace
	if err := json.NewDecoder(res.Body).Decode(&ws); err != nil {
		t.Fatal(err)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("runtime not started")
	}
}

func TestCreateListWakeStopHeartbeat(t *testing.T) {
	ts, _, rt, _ := testServer(t, true)
	res, err := http.Post(ts.URL+"/api/workspaces", "application/json", strings.NewReader(`{"name":"alpha"}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusCreated {
		t.Fatal(res.Status)
	}
	var ws landlord.Workspace
	if err := json.NewDecoder(res.Body).Decode(&ws); err != nil {
		t.Fatal(err)
	}
	if ws.Name != "alpha" || ws.State != landlord.StateRunning {
		t.Fatalf("%+v", ws)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("runtime not started")
	}

	listRes, err := http.Get(ts.URL + "/api/workspaces")
	if err != nil {
		t.Fatal(err)
	}
	defer listRes.Body.Close()
	var list struct {
		Workspaces []landlord.Workspace `json:"workspaces"`
	}
	if err := json.NewDecoder(listRes.Body).Decode(&list); err != nil {
		t.Fatal(err)
	}
	if len(list.Workspaces) != 1 {
		t.Fatalf("len=%d", len(list.Workspaces))
	}

	hb, err := http.Post(ts.URL+"/api/workspaces/"+ws.ID+"/heartbeat", "application/json",
		strings.NewReader(`{"connected":true}`))
	if err != nil {
		t.Fatal(err)
	}
	hb.Body.Close()
	if hb.StatusCode != 200 {
		t.Fatal(hb.Status)
	}

	stop, err := http.Post(ts.URL+"/api/workspaces/"+ws.ID+"/stop", "application/json", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	stop.Body.Close()
	if stop.StatusCode != 200 {
		t.Fatal(stop.Status)
	}
	if rt.Running(ws.ID) {
		t.Fatal("should be stopped")
	}

	wake, err := http.Post(ts.URL+"/api/workspaces/"+ws.ID+"/wake", "application/json", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	defer wake.Body.Close()
	if wake.StatusCode != 200 {
		t.Fatal(wake.Status)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("should be running")
	}
}

func TestCreateAdmissionThroughAPI(t *testing.T) {
	ts, _, _, _ := testServer(t, true)
	var ids []string
	for i := 0; i < 3; i++ {
		res, err := http.Post(ts.URL+"/api/workspaces", "application/json", bytes.NewReader(nil))
		if err != nil {
			t.Fatal(err)
		}
		var ws landlord.Workspace
		if err := json.NewDecoder(res.Body).Decode(&ws); err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		ids = append(ids, ws.ID)
		if i < 2 && ws.State != landlord.StateRunning {
			t.Fatalf("i=%d state=%s", i, ws.State)
		}
		if i == 2 && ws.State != landlord.StateQueued {
			t.Fatalf("third should queue, got %s", ws.State)
		}
	}
}

func TestMissingWorkspace(t *testing.T) {
	ts, _, _, _ := testServer(t, true)
	res, err := http.Post(ts.URL+"/api/workspaces/nope/wake", "application/json", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatal(res.Status)
	}
}

func TestLoginRejectsUnknownHost(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res := doHost(t, noRedirect(ts), http.MethodGet, ts.URL+"/auth/login", "evil.example", nil, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("status=%d", res.StatusCode)
	}
}

func TestLoginWWWHost(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	res := doHost(t, noRedirect(ts), http.MethodGet, ts.URL+"/auth/login", "www.grogan.dev", nil, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatal(res.Status)
	}
	loc, err := url.Parse(res.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if loc.Query().Get("redirect_uri") != "https://www.grogan.dev/auth/callback" {
		t.Fatalf("redirect_uri=%s", loc.Query().Get("redirect_uri"))
	}
}

func TestAllowlistRejectsOtherEmail(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	client := noRedirect(ts)
	state, cookies := startLogin(t, ts, "grogan.dev")
	res := doHost(t, client, http.MethodGet, ts.URL+"/auth/callback?code=other&state="+url.QueryEscape(state), "grogan.dev", cookies, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d", res.StatusCode)
	}
	if cookie(res, auth.CookieName) != nil {
		t.Fatal("must not set session")
	}

	sealed, err := auth.Seal(auth.Session{UserID: "user_2", Email: "other@example.com"}, testCookiePW)
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/workspaces", strings.NewReader(`{"name":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: sealed})
	apiRes, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer apiRes.Body.Close()
	if apiRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d", apiRes.StatusCode)
	}
}

func TestEmptyAllowlistFailClosed(t *testing.T) {
	rt := runtime.NewFake()
	clk := landlord.NewFakeClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	ll := landlord.New(rt, clk, slog.New(slog.NewTextHandler(io.Discard, nil)))
	wo := auth.NewFake()
	wo.Users["ok"] = auth.User{ID: "user_1", Email: "z@grogan.dev"}
	srv := New(config.Config{
		AuthKitURL:     "https://authkit.example/start",
		WorkOSClientID: "client_test",
		CookiePassword: testCookiePW,
	}, ll, wo, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	client := noRedirect(ts)
	state, cookies := startLogin(t, ts, "grogan.dev")
	res := doHost(t, client, http.MethodGet, ts.URL+"/auth/callback?code=ok&state="+url.QueryEscape(state), "grogan.dev", cookies, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusForbidden {
		t.Fatalf("status=%d", res.StatusCode)
	}
}

func TestLogoutClearsSession(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	client := noRedirect(ts)
	res := doHost(t, client, http.MethodGet, ts.URL+"/auth/logout", "grogan.dev", nil, nil)
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatal(res.Status)
	}
	if res.Header.Get("Location") != "https://grogan.dev/" {
		t.Fatalf("location=%s", res.Header.Get("Location"))
	}
	cleared := cookie(res, auth.CookieName)
	if cleared == nil {
		t.Fatal("missing clear cookie")
	}
	if cleared.MaxAge >= 0 {
		t.Fatalf("max-age=%d", cleared.MaxAge)
	}
	if cleared.Domain != "grogan.dev" {
		t.Fatalf("domain=%s", cleared.Domain)
	}
}

func TestJobHeartbeatUsesHostToken(t *testing.T) {
	ts, ll, rt, _ := testServer(t, false)
	client := noRedirect(ts)
	ws, err := ll.Create(context.Background(), "job")
	if err != nil {
		t.Fatal(err)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("not running")
	}

	res, err := client.Post(ts.URL+"/api/workspaces/"+ws.ID+"/job-heartbeat", "application/json", strings.NewReader(`{"running":true}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no token status=%d", res.StatusCode)
	}

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/workspaces/"+ws.ID+"/job-heartbeat", strings.NewReader(`{"running":true}`))
	req.Header.Set("Authorization", "Bearer wrong")
	req.Header.Set("Content-Type", "application/json")
	res, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("bad token status=%d", res.StatusCode)
	}

	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/api/workspaces/"+ws.ID+"/job-heartbeat", strings.NewReader(`{"running":true}`))
	req.Header.Set("Authorization", "Bearer host-token-test")
	req.Header.Set("Content-Type", "application/json")
	res, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	got, err := ll.Get(ws.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.JobRunning {
		t.Fatal("job should pin")
	}

	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/api/workspaces/"+ws.ID+"/job-heartbeat", strings.NewReader(`{"running":false}`))
	req.Header.Set("X-Nero-Host-Token", "host-token-test")
	req.Header.Set("Content-Type", "application/json")
	res, err = client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatal(res.Status)
	}
	got, err = ll.Get(ws.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.JobRunning {
		t.Fatal("job should unpin")
	}

	// Human heartbeat still needs a session.
	res, err = client.Post(ts.URL+"/api/workspaces/"+ws.ID+"/heartbeat", "application/json", strings.NewReader(`{"connected":true}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("human heartbeat status=%d", res.StatusCode)
	}
}

func TestUnauthedWorkspaceMutations(t *testing.T) {
	ts, _, _, _ := testServer(t, false)
	routes := []struct {
		method, path string
	}{
		{http.MethodGet, "/api/workspaces"},
		{http.MethodPost, "/api/workspaces"},
		{http.MethodPost, "/api/workspaces/x/wake"},
		{http.MethodPost, "/api/workspaces/x/stop"},
		{http.MethodPost, "/api/workspaces/x/heartbeat"},
	}
	for _, tc := range routes {
		req, err := http.NewRequest(tc.method, ts.URL+tc.path, strings.NewReader(`{}`))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		res, err := ts.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s %s status=%d", tc.method, tc.path, res.StatusCode)
		}
		want := `Bearer resource_metadata="https://nero.grogan.dev/auth.md"`
		if got := res.Header.Get("WWW-Authenticate"); got != want {
			t.Errorf("%s %s www-authenticate=%q", tc.method, tc.path, got)
		}
		res.Body.Close()
	}

	sealed, err := auth.Seal(auth.Session{
		UserID: "user_1",
		Email:  "z@grogan.dev",
		Exp:    time.Now().Add(-time.Minute).Unix(),
	}, testCookiePW)
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/workspaces", nil)
	req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: sealed})
	res, err := ts.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expired status=%d", res.StatusCode)
	}
}
