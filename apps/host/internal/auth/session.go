package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	CookieName      = "wos-session"
	StateCookieName = "wos-state"
	sessionTTL      = 7 * 24 * time.Hour
	stateTTL        = 10 * time.Minute
)

var (
	ErrNoSession      = errors.New("no session")
	ErrBadSession     = errors.New("invalid session")
	ErrExpired        = errors.New("session expired")
	ErrState          = errors.New("invalid state")
	ErrCookiePassword = errors.New("cookie password required")
)

type Session struct {
	UserID string `json:"uid"`
	Email  string `json:"email"`
	Exp    int64  `json:"exp"`
}

func RandomState() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func Seal(s Session, password string) (string, error) {
	if password == "" {
		return "", ErrCookiePassword
	}
	if s.Exp == 0 {
		s.Exp = time.Now().Add(sessionTTL).Unix()
	}
	plain, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(sessionKey(password))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	out := gcm.Seal(nonce, nonce, plain, nil)
	return base64.RawURLEncoding.EncodeToString(out), nil
}

func Unseal(blob, password string) (Session, error) {
	if password == "" {
		return Session{}, ErrCookiePassword
	}
	if blob == "" {
		return Session{}, ErrNoSession
	}
	raw, err := base64.RawURLEncoding.DecodeString(blob)
	if err != nil {
		return Session{}, ErrBadSession
	}
	block, err := aes.NewCipher(sessionKey(password))
	if err != nil {
		return Session{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return Session{}, err
	}
	ns := gcm.NonceSize()
	if len(raw) < ns {
		return Session{}, ErrBadSession
	}
	plain, err := gcm.Open(nil, raw[:ns], raw[ns:], nil)
	if err != nil {
		return Session{}, ErrBadSession
	}
	var s Session
	if err := json.Unmarshal(plain, &s); err != nil {
		return Session{}, ErrBadSession
	}
	if s.Exp > 0 && time.Now().Unix() >= s.Exp {
		return Session{}, ErrExpired
	}
	if s.UserID == "" {
		return Session{}, ErrBadSession
	}
	return s, nil
}

func FromRequest(r *http.Request, password string) (Session, error) {
	c, err := r.Cookie(CookieName)
	if err != nil || c.Value == "" {
		return Session{}, ErrNoSession
	}
	return Unseal(c.Value, password)
}

func SessionCookie(value string, r *http.Request) *http.Cookie {
	secure := isHTTPS(r)
	return &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		Domain:   cookieDomain(r.Host),
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
}

func StateCookie(state string, r *http.Request) *http.Cookie {
	return &http.Cookie{
		Name:     StateCookieName,
		Value:    state,
		Path:     "/",
		MaxAge:   int(stateTTL.Seconds()),
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	}
}

func ClearStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     StateCookieName,
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
}

func CheckState(r *http.Request) error {
	c, err := r.Cookie(StateCookieName)
	if err != nil || c.Value == "" {
		return ErrState
	}
	got := r.URL.Query().Get("state")
	if got == "" || !hmac.Equal([]byte(c.Value), []byte(got)) {
		return ErrState
	}
	return nil
}

func sessionKey(password string) []byte {
	sum := sha256.Sum256([]byte(password))
	return sum[:]
}

func isHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func cookieDomain(host string) string {
	h := host
	if name, _, err := net.SplitHostPort(host); err == nil {
		h = name
	}
	h = strings.TrimSuffix(strings.ToLower(h), ".")
	if h == "grogan.dev" || strings.HasSuffix(h, ".grogan.dev") {
		return "grogan.dev"
	}
	return ""
}
