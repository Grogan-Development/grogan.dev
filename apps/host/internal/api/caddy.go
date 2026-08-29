package api

import (
	"errors"
	"net/http"
	"net/url"
	"strings"

	"nero-host/internal/auth"
	"nero-host/internal/landlord"
	"nero-host/internal/runtime"
)

const (
	caddyAuthPath      = "/internal/caddy-auth"
	headerWorkspace    = "X-Nero-Workspace"
	headerDial         = "X-Nero-Dial"
	headerForwardedURI = "X-Forwarded-Uri"
)

func (s *Server) caddyAuth(w http.ResponseWriter, r *http.Request) {
	if !auth.RemoteLoopback(r) {
		writeErr(w, http.StatusForbidden, "forbidden")
		return
	}
	if !s.cfg.DevBypass {
		sess, err := auth.FromRequest(r, s.cfg.CookiePassword)
		if err != nil || !s.cfg.EmailAllowed(sess.Email) {
			writeWorkspaceUnauthorized(w)
			return
		}
	}
	id := workspaceIDFromCaddy(r)
	if id == "" {
		writeErr(w, http.StatusNotFound, "workspace not found")
		return
	}
	addr, err := s.ll.DialAddr(id)
	if err != nil {
		if errors.Is(err, landlord.ErrNotFound) {
			writeErr(w, http.StatusNotFound, err.Error())
			return
		}
		if errors.Is(err, landlord.ErrNotRunning) {
			writeErr(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	if s.cfg.AccessToken != "" {
		w.Header().Set("Authorization", "Bearer "+s.cfg.AccessToken)
	}
	w.Header().Set(headerDial, addr)
	w.WriteHeader(http.StatusNoContent)
}

func workspaceIDFromCaddy(r *http.Request) string {
	if id := runtimeValidID(r.Header.Get(headerWorkspace)); id != "" {
		return id
	}
	if id := workspaceIDFromURI(r.Header.Get(headerForwardedURI)); id != "" {
		return id
	}
	if c, err := r.Cookie(runtime.WSCookieName); err == nil {
		return runtimeValidID(c.Value)
	}
	return ""
}

func workspaceIDFromURI(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	path := raw
	if u, err := url.Parse(raw); err == nil && u.Path != "" {
		path = u.Path
	} else if i := strings.IndexAny(raw, "?#"); i >= 0 {
		path = raw[:i]
	}
	path = strings.TrimPrefix(path, "/")
	parts := strings.Split(path, "/")
	if len(parts) >= 2 && parts[0] == "w" {
		return runtimeValidID(parts[1])
	}
	return ""
}

func runtimeValidID(id string) string {
	id = strings.ToLower(strings.TrimSpace(id))
	if !runtime.ValidWorkspaceID(id) {
		return ""
	}
	return id
}
