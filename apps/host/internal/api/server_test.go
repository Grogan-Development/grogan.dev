package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

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
	cfg := config.Config{
		DevBypass:      bypass,
		AuthKitURL:     "https://authkit.example/start",
		WorkOSClientID: "client_test",
		CookiePassword: testCookiePW,
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
	st := cookie(res, auth.StateCookieName)
	if st == nil || st.Value != q.Get("state") {
		t.Fatalf("state cookie=%v", st)
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
	if st == nil {
		t.Fatal("no state cookie")
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
	cbRes, err := client.Do(cb)
	if err != nil {
		t.Fatal(err)
	}
	defer cbRes.Body.Close()
	if cbRes.StatusCode != http.StatusFound {
		t.Fatal(cbRes.Status)
	}
	if cbRes.Header.Get("Location") != "https://nero.grogan.dev/" {
		t.Fatalf("location=%s", cbRes.Header.Get("Location"))
	}
	if wo.LastCode != "ok" {
		t.Fatalf("code=%s", wo.LastCode)
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

	res, err := client.Get(ts.URL + "/auth/callback")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing code status=%d", res.StatusCode)
	}

	loginRes, err := client.Get(ts.URL + "/auth/login")
	if err != nil {
		t.Fatal(err)
	}
	loginRes.Body.Close()
	st := cookie(loginRes, auth.StateCookieName)
	loc, _ := url.Parse(loginRes.Header.Get("Location"))
	state := loc.Query().Get("state")

	badState, _ := http.NewRequest(http.MethodGet, ts.URL+"/auth/callback?code=ok&state=nope", nil)
	badState.AddCookie(st)
	res, err = client.Do(badState)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad state status=%d", res.StatusCode)
	}

	badCode, _ := http.NewRequest(http.MethodGet, ts.URL+"/auth/callback?code=nope&state="+url.QueryEscape(state), nil)
	badCode.AddCookie(st)
	res, err = client.Do(badCode)
	if err != nil {
		t.Fatal(err)
	}
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
	loginRes, err := client.Get(ts.URL + "/auth/login")
	if err != nil {
		t.Fatal(err)
	}
	loginRes.Body.Close()
	st := cookie(loginRes, auth.StateCookieName)
	loc, _ := url.Parse(loginRes.Header.Get("Location"))
	cb, _ := http.NewRequest(http.MethodGet, ts.URL+"/auth/callback?code=ok&state="+url.QueryEscape(loc.Query().Get("state")), nil)
	cb.AddCookie(st)
	cbRes, err := client.Do(cb)
	if err != nil {
		t.Fatal(err)
	}
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
