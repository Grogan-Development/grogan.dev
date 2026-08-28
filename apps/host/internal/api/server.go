package api

import (
	"context"
	"encoding/json"
	"errors"
	"html"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/landing"
)

type Server struct {
	cfg config.Config
	ll  *landlord.Landlord
	log *slog.Logger
}

func New(cfg config.Config, ll *landlord.Landlord, log *slog.Logger) *Server {
	if log == nil {
		log = slog.Default()
	}
	return &Server{cfg: cfg, ll: ll, log: log}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /{$}", s.landing)
	mux.Handle("GET /api/workspaces", s.authed(s.list))
	mux.Handle("POST /api/workspaces", s.authed(s.create))
	mux.Handle("POST /api/workspaces/{id}/wake", s.authed(s.wake))
	mux.Handle("POST /api/workspaces/{id}/stop", s.authed(s.stop))
	mux.Handle("POST /api/workspaces/{id}/heartbeat", s.authed(s.heartbeat))
	return mux
}

func (s *Server) authed(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.cfg.DevBypass {
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
	url := s.cfg.AuthKitURL
	if url == "" {
		url = "#"
	}
	body := strings.ReplaceAll(landing.HTML, "{{WORKOS_AUTHKIT_URL}}", html.EscapeString(url))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = io.WriteString(w, body)
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
