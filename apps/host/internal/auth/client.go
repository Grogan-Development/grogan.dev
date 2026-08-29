package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultAuthorizeURL = "https://api.workos.com/user_management/authorize"
const defaultAPIBase = "https://api.workos.com"

// User is the WorkOS User Management identity after a code exchange.
type User struct {
	ID    string
	Email string
}

// Client exchanges an AuthKit authorization_code for a user.
type Client interface {
	AuthenticateWithCode(ctx context.Context, code, codeVerifier string) (User, error)
}

// API is the WorkOS User Management HTTP client.
type API struct {
	APIKey   string
	ClientID string
	BaseURL  string
	HTTP     *http.Client
}

func NewAPI(apiKey, clientID string) *API {
	return &API{
		APIKey:   apiKey,
		ClientID: clientID,
		BaseURL:  defaultAPIBase,
		HTTP:     &http.Client{Timeout: 15 * time.Second},
	}
}

type authenticateRequest struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	GrantType    string `json:"grant_type"`
	Code         string `json:"code"`
	CodeVerifier string `json:"code_verifier,omitempty"`
}

type authenticateResponse struct {
	User struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	} `json:"user"`
}

func (c *API) AuthenticateWithCode(ctx context.Context, code, codeVerifier string) (User, error) {
	if code == "" {
		return User{}, fmt.Errorf("missing authorization code")
	}
	base := c.BaseURL
	if base == "" {
		base = defaultAPIBase
	}
	body, err := json.Marshal(authenticateRequest{
		ClientID:     c.ClientID,
		ClientSecret: c.APIKey,
		GrantType:    "authorization_code",
		Code:         code,
		CodeVerifier: codeVerifier,
	})
	if err != nil {
		return User{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(base, "/")+"/user_management/authenticate", bytes.NewReader(body))
	if err != nil {
		return User{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return User{}, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return User{}, fmt.Errorf("workos authenticate: %s", res.Status)
	}
	var parsed authenticateResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return User{}, err
	}
	if parsed.User.ID == "" {
		return User{}, fmt.Errorf("workos authenticate: empty user")
	}
	return User{ID: parsed.User.ID, Email: parsed.User.Email}, nil
}

// AuthorizationURL is the AuthKit hosted UI start (provider=authkit).
func AuthorizationURL(authKitURL, clientID, redirectURI, state, codeChallenge string) (string, error) {
	base := strings.TrimSpace(authKitURL)
	if base == "" {
		base = defaultAuthorizeURL
	}
	u, err := url.Parse(base)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid authkit url")
	}
	q := u.Query()
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("provider", "authkit")
	q.Set("state", state)
	if codeChallenge != "" {
		q.Set("code_challenge", codeChallenge)
		q.Set("code_challenge_method", "S256")
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// RandomPKCE returns an S256 verifier and challenge (RFC 7636).
func RandomPKCE() (verifier, challenge string, err error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(b[:])
	sum := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(sum[:])
	return verifier, challenge, nil
}
