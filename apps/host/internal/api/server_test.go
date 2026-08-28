package api

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/internal/runtime"
)

func testServer(t *testing.T, bypass bool) (*httptest.Server, *landlord.Landlord, *runtime.Fake) {
	t.Helper()
	rt := runtime.NewFake()
	clk := landlord.NewFakeClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	ll := landlord.New(rt, clk, slog.New(slog.NewTextHandler(io.Discard, nil)))
	cfg := config.Config{
		DevBypass:  bypass,
		AuthKitURL: "https://authkit.example/start",
	}
	srv := New(cfg, ll, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	return ts, ll, rt
}

func TestHealthz(t *testing.T) {
	ts, _, _ := testServer(t, false)
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
	ts, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/api/workspaces")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d", res.StatusCode)
	}
}

func TestLandingPortalHref(t *testing.T) {
	ts, _, _ := testServer(t, false)
	res, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(b), `href="https://authkit.example/start"`) {
		t.Fatalf("portal href missing: %s", b)
	}
}

func TestCreateListWakeStopHeartbeat(t *testing.T) {
	ts, _, rt := testServer(t, true)
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
	ts, _, _ := testServer(t, true)
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
	ts, _, _ := testServer(t, true)
	res, err := http.Post(ts.URL+"/api/workspaces/nope/wake", "application/json", http.NoBody)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 404 {
		t.Fatal(res.Status)
	}
}
