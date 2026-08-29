package runtime

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// derivationDomain separates workspace-token derivation from any other use
// of the host secret.
const derivationDomain = "nero-workspace-token:"

// DeriveWorkspaceToken binds a host secret to one workspace id: guests
// receive HMAC(secret, id) instead of the secret itself, so a token that
// leaks out of a workspace authorizes that workspace only — never
// job-heartbeat, proxy auth, or daemon access for any other workspace.
// Stateless on the host: validate by recomputing.
func DeriveWorkspaceToken(secret, workspaceID string) string {
	if secret == "" || workspaceID == "" {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(derivationDomain))
	mac.Write([]byte(workspaceID))
	return hex.EncodeToString(mac.Sum(nil))
}
