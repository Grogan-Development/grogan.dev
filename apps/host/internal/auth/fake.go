package auth

import (
	"context"
	"fmt"
	"sync"
)

// Fake is an in-memory WorkOS client for tests.
type Fake struct {
	mu       sync.Mutex
	Users    map[string]User
	Err      error
	LastCode string
}

func NewFake() *Fake {
	return &Fake{Users: make(map[string]User)}
}

func (f *Fake) AuthenticateWithCode(_ context.Context, code string) (User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.LastCode = code
	if f.Err != nil {
		return User{}, f.Err
	}
	u, ok := f.Users[code]
	if !ok {
		return User{}, fmt.Errorf("invalid authorization code")
	}
	return u, nil
}
