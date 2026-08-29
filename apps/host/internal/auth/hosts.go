package auth

import (
	"errors"
	"net"
	"net/http"
	"strings"
)

var ErrRedirectHost = errors.New("redirect host not allowed")

var allowedRedirectHosts = map[string]bool{
	"grogan.dev":      true,
	"www.grogan.dev":  true,
	"nero.grogan.dev": true,
}

func NormalizeHost(host string) string {
	host = strings.ToLower(strings.TrimSpace(strings.TrimSuffix(host, ".")))
	if host == "" {
		return ""
	}
	h, port, err := net.SplitHostPort(host)
	if err != nil {
		return host
	}
	if port != "80" && port != "443" {
		return host
	}
	return h
}

func AllowedRedirectHost(host string) bool {
	return allowedRedirectHosts[NormalizeHost(host)]
}

func RedirectOrigin(r *http.Request) (string, error) {
	host := NormalizeHost(r.Host)
	if !allowedRedirectHosts[host] {
		return "", ErrRedirectHost
	}
	return "https://" + host, nil
}

func RemoteLoopback(r *http.Request) bool {
	host := r.RemoteAddr
	if h, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
