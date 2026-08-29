package runtime

import (
	"testing"
)

func TestDeriveWorkspaceToken(t *testing.T) {
	a := DeriveWorkspaceToken("secret", "aaaaaaaaaaaaaaaa")
	b := DeriveWorkspaceToken("secret", "bbbbbbbbbbbbbbbb")
	a2 := DeriveWorkspaceToken("secret", "aaaaaaaaaaaaaaaa")
	if a == "" || b == "" {
		t.Fatal("empty derivation")
	}
	if a == b {
		t.Fatal("different workspaces must derive different tokens")
	}
	if a != a2 {
		t.Fatal("derivation must be deterministic")
	}
	if a == DeriveWorkspaceToken("other-secret", "aaaaaaaaaaaaaaaa") {
		t.Fatal("different secrets must derive different tokens")
	}
	if DeriveWorkspaceToken("", "aaaaaaaaaaaaaaaa") != "" || DeriveWorkspaceToken("secret", "") != "" {
		t.Fatal("empty inputs must yield empty token")
	}
}
