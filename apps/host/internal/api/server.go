package api

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"nero-host/authmd"
	"nero-host/internal/auth"
	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/landing"
)

const afterLoginURL = "https://nero.grogan.dev/"
const afterLogoutURL = "https://grogan.dev/"

type Server struct {
	cfg    config.Config
	ll     *landlord.Landlord
	workos auth.Client
	log    *slog.Logger
}

func New(cfg config.Config, ll *landlord.Landlord, workos auth.Client, log *slog.Logger) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{cfg: cfg, ll: ll, workos: workos, log: log}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /{$}", s.landing)
	mux.HandleFunc("GET /auth.md", s.authMD)
	mux.HandleFunc("GET /auth/login", s.login)
	mux.HandleFunc("GET /auth/callback", s.callback)
	mux.HandleFunc("GET /auth/logout", s.logout)
	mux.Handle("GET /api/workspaces", s.authed(s.list))
	mux.Handle("POST /api/workspaces", s.authed(s.create))
	mux.Handle("POST /api/workspaces/{id}/wake", s.authed(s.wake))
	mux.Handle("POST /api/workspaces/{id}/stop", s.authed(s.stop))
	mux.Handle("POST /api/workspaces/{id}/heartbeat", s.authed(s.heartbeat))
	mux.HandleFunc("POST /api/workspaces/{id}/job-heartbeat", s.jobHeartbeat)
	return mux
}

func (s *Server) authed(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.DevBypass {
			next(w, r)
			return
		}
		sess, err := auth.FromRequest(r, s.cfg.CookiePassword)
		if err != nil || !s.cfg.EmailAllowed(sess.Email) {
			writeErr(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next(w, r)
	})
}

func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) landing(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, landing.HTML)
}

func (s *Server) authMD(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	_, _ = io.WriteString(w, authmd.Markdown)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if s.cfg.WorkOSClientID == "" {
		writeErr(w, http.StatusInternalServerError, "workos not configured")
		return
	}
	origin, err := auth.RedirectOrigin(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid host")
		return
	}
	state, err := auth.RandomState()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "state")
		return
	}
	verifier, challenge, err := auth.RandomPKCE()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "pkce")
		return
	}
	redirectURI := origin + "/auth/callback"
	loc, err := auth.AuthorizationURL(s.cfg.AuthKitURL, s.cfg.WorkOSClientID, redirectURI, state, challenge)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "authkit url")
		return
	}
	http.SetCookie(w, auth.StateCookie(state, r))
	http.SetCookie(w, auth.PKCECookie(verifier, r))
	http.Redirect(w, r, loc, http.StatusFound)
}

func (s *Server) callback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if _, err := auth.RedirectOrigin(r); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid host")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		writeErr(w, http.StatusBadRequest, "missing code")
		return
	}
	if err := auth.CheckState(r); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid state")
		return
	}
	verifier, err := auth.PKCEVerifier(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid pkce")
		return
	}
	if s.workos == nil {
		writeErr(w, http.StatusInternalServerError, "workos not configured")
		return
	}
	user, err := s.workos.AuthenticateWithCode(r.Context(), code, verifier)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	if !s.cfg.DevBypass && !s.cfg.EmailAllowed(user.Email) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	sealed, err := auth.Seal(auth.Session{UserID: user.ID, Email: user.Email}, s.cfg.CookiePassword)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "session")
		return
	}
	auth.ClearStateCookie(w)
	auth.ClearPKCECookie(w)
	http.SetCookie(w, auth.SessionCookie(sealed, r))
	http.Redirect(w, r, afterLoginURL, http.StatusFound)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	auth.ClearStateCookie(w)
	auth.ClearPKCECookie(w)
	http.SetCookie(w, auth.ClearSessionCookie(r))
	http.Redirect(w, r, afterLogoutURL, http.StatusFound)
}

func (s *Server) list(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"workspaces": s.ll.List()})
}

type createBody struct {
	Name string `json:"name"`
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	var body createBody
	if err := decodeOptional(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	ws, err := s.ll.Create(context.Background(), body.Name)
	if err != nil {
		if errors.Is(err, landlord.ErrInvalidName) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, ws)
}

func (s *Server) wake(w http.ResponseWriter, r *http.Request) {
	ws, err := s.ll.Wake(context.Background(), r.PathValue("id"))
	if err != nil {
		writeLandlordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

func (s *Server) stop(w http.ResponseWriter, r *http.Request) {
	ws, err := s.ll.Stop(context.Background(), r.PathValue("id"))
	if err != nil {
		writeLandlordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

type heartbeatBody struct {
	Connected    *bool `json:"connected"`
	AgentWorking *bool `json:"agentWorking"`
	JobRunning   *bool `json:"jobRunning"`
}

func (s *Server) heartbeat(w http.ResponseWriter, r *http.Request) {
	var body heartbeatBody
	if err := decodeOptional(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	ws, err := s.ll.Heartbeat(r.PathValue("id"), landlord.Heartbeat{
		Connected:    body.Connected,
		AgentWorking: body.AgentWorking,
		JobRunning:   body.JobRunning,
	})
	if err != nil {
		writeLandlordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

type jobHeartbeatBody struct {
	Running    *bool `json:"running"`
	JobRunning *bool `json:"jobRunning"`
}

func (s *Server) jobHeartbeat(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.DevBypass && !hostTokenOK(r, s.cfg.HostToken) {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body jobHeartbeatBody
	if err := decodeOptional(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	running := true
	switch {
	case body.Running != nil:
		running = *body.Running
	case body.JobRunning != nil:
		running = *body.JobRunning
	}
	ws, err := s.ll.Heartbeat(r.PathValue("id"), landlord.Heartbeat{JobRunning: &running})
	if err != nil {
		writeLandlordErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, ws)
}

func hostTokenOK(r *http.Request, token string) bool {
	if token == "" {
		return false
	}
	got := ""
	if a := r.Header.Get("Authorization"); len(a) >= 7 && strings.EqualFold(a[:7], "bearer ") {
		got = strings.TrimSpace(a[7:])
	}
	if got == "" {
		got = r.Header.Get("X-Nero-Host-Token")
	}
	return hmac.Equal([]byte(got), []byte(token))
}

func writeLandlordErr(w http.ResponseWriter, err error) {
	if errors.Is(err, landlord.ErrNotFound) {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	writeErr(w, http.StatusInternalServerError, err.Error())
}

func decodeOptional(r *http.Request, v any) error {
	if r.Body == nil {
		return nil
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
