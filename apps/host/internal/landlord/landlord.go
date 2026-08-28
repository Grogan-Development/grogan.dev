package landlord

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"sort"
	"sync"
	"time"
	"unicode/utf8"

	"nero-host/internal/runtime"
)

var (
	ErrNotFound    = errors.New("workspace not found")
	ErrInvalidName = errors.New("invalid name")
)

type State string

const (
	StateStopped State = "stopped"
	StateRunning State = "running"
	StateQueued  State = "queued"
)

type Workspace struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	State          State     `json:"state"`
	CreatedAt      time.Time `json:"createdAt"`
	Connected      bool      `json:"connected"`
	AgentWorking   bool      `json:"agentWorking"`
	JobRunning     bool      `json:"jobRunning"`
	LastHeartbeat  time.Time `json:"lastHeartbeat"`
	LastDisconnect time.Time `json:"-"`
	QueuePosition  int       `json:"queuePosition,omitempty"`
}

type Heartbeat struct {
	Connected    *bool
	AgentWorking *bool
	JobRunning   *bool
}

type Landlord struct {
	mu         sync.Mutex
	rt         runtime.Runtime
	clock      Clock
	log        *slog.Logger
	workspaces map[string]*Workspace
	queue      []string
}

func New(rt runtime.Runtime, clock Clock, log *slog.Logger) *Landlord {
	if clock == nil {
		clock = RealClock{}
	}
	if log == nil {
		log = slog.Default()
	}
	return &Landlord{
		rt:         rt,
		clock:      clock,
		log:        log,
		workspaces: make(map[string]*Workspace),
	}
}

func (l *Landlord) Restore(ctx context.Context) error {
	list, err := l.rt.ListContainers(ctx)
	if err != nil {
		l.log.Warn("restore skipped", "err", err)
		return nil
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.clock.Now()
	for _, c := range list {
		if c.ID == "" {
			continue
		}
		name := c.Name
		if name == "" {
			name = "workspace-" + c.ID
		}
		st := StateStopped
		if c.Running {
			st = StateRunning
		}
		l.workspaces[c.ID] = &Workspace{
			ID:            c.ID,
			Name:          name,
			State:         st,
			CreatedAt:     now,
			LastHeartbeat: now,
		}
	}
	l.log.Info("restored workspaces", "n", len(l.workspaces))
	return nil
}

func (l *Landlord) Create(ctx context.Context, name string) (Workspace, error) {
	if err := validateName(name); err != nil {
		return Workspace{}, err
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	id := l.unusedID()
	if name == "" {
		name = "workspace-" + id[:4]
	}
	now := l.clock.Now()
	ws := &Workspace{
		ID:            id,
		Name:          name,
		State:         StateStopped,
		CreatedAt:     now,
		LastHeartbeat: now,
	}
	if err := l.rt.CreateDataset(ctx, id); err != nil {
		return Workspace{}, err
	}
	if err := l.rt.CreateContainer(ctx, runtime.WorkspaceSpec{ID: id, Name: name}); err != nil {
		_ = l.rt.DestroyDataset(ctx, id)
		return Workspace{}, err
	}
	l.workspaces[id] = ws
	if err := l.admitOrQueueLocked(ctx, ws); err != nil {
		return Workspace{}, err
	}
	l.log.Info("workspace created", "id", id, "state", ws.State)
	return l.viewLocked(ws), nil
}

func (l *Landlord) Wake(ctx context.Context, id string) (Workspace, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	ws, ok := l.workspaces[id]
	if !ok {
		return Workspace{}, ErrNotFound
	}
	if ws.State == StateRunning || ws.State == StateQueued {
		return l.viewLocked(ws), nil
	}
	if err := l.admitOrQueueLocked(ctx, ws); err != nil {
		return Workspace{}, err
	}
	l.log.Info("workspace wake", "id", id, "state", ws.State)
	return l.viewLocked(ws), nil
}

func (l *Landlord) Stop(ctx context.Context, id string) (Workspace, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.stopLocked(ctx, id)
}

func (l *Landlord) Heartbeat(id string, hb Heartbeat) (Workspace, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	ws, ok := l.workspaces[id]
	if !ok {
		return Workspace{}, ErrNotFound
	}
	now := l.clock.Now()
	if hb.Connected != nil {
		was := ws.Connected
		ws.Connected = *hb.Connected
		if was && !ws.Connected {
			ws.LastDisconnect = now
		}
		if ws.Connected {
			ws.LastDisconnect = time.Time{}
		}
	}
	if hb.AgentWorking != nil {
		ws.AgentWorking = *hb.AgentWorking
	}
	if hb.JobRunning != nil {
		ws.JobRunning = *hb.JobRunning
	}
	ws.LastHeartbeat = now
	return l.viewLocked(ws), nil
}

func (l *Landlord) Get(id string) (Workspace, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	ws, ok := l.workspaces[id]
	if !ok {
		return Workspace{}, ErrNotFound
	}
	return l.viewLocked(ws), nil
}

func (l *Landlord) List() []Workspace {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]Workspace, 0, len(l.workspaces))
	for _, ws := range l.workspaces {
		out = append(out, l.viewLocked(ws))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].ID < out[j].ID
		}
		return out[i].CreatedAt.Before(out[j].CreatedAt)
	})
	return out
}

func (l *Landlord) Queue() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	out := make([]string, len(l.queue))
	copy(out, l.queue)
	return out
}

func (l *Landlord) ReconcileIdle(ctx context.Context) []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.clock.Now()
	var ids []string
	for id, ws := range l.workspaces {
		if shouldIdleStop(ws, now) {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	var stopped []string
	for _, id := range ids {
		if _, err := l.stopLocked(ctx, id); err != nil {
			l.log.Warn("idle stop failed", "id", id, "err", err)
			continue
		}
		stopped = append(stopped, id)
		l.log.Info("idle stop", "id", id)
	}
	return stopped
}

func (l *Landlord) admitOrQueueLocked(ctx context.Context, ws *Workspace) error {
	if l.canAdmitLocked() {
		return l.startLocked(ctx, ws)
	}
	ws.State = StateQueued
	l.enqueueLocked(ws.ID)
	l.log.Info("workspace queued", "id", ws.ID, "position", l.queuePositionLocked(ws.ID))
	return nil
}

func (l *Landlord) startLocked(ctx context.Context, ws *Workspace) error {
	if err := l.rt.StartContainer(ctx, ws.ID); err != nil {
		return err
	}
	ws.State = StateRunning
	ws.LastHeartbeat = l.clock.Now()
	l.removeFromQueueLocked(ws.ID)
	return nil
}

func (l *Landlord) stopLocked(ctx context.Context, id string) (Workspace, error) {
	ws, ok := l.workspaces[id]
	if !ok {
		return Workspace{}, ErrNotFound
	}
	l.removeFromQueueLocked(id)
	if ws.State == StateRunning {
		if err := l.rt.StopContainer(ctx, id); err != nil {
			return Workspace{}, err
		}
	}
	ws.State = StateStopped
	ws.Connected = false
	ws.AgentWorking = false
	ws.JobRunning = false
	l.drainQueueLocked(ctx)
	return l.viewLocked(ws), nil
}

func (l *Landlord) drainQueueLocked(ctx context.Context) {
	for len(l.queue) > 0 && l.canAdmitLocked() {
		id := l.queue[0]
		l.queue = l.queue[1:]
		ws := l.workspaces[id]
		if ws == nil || ws.State != StateQueued {
			continue
		}
		if err := l.startLocked(ctx, ws); err != nil {
			l.log.Warn("queued start failed", "id", id, "err", err)
			ws.State = StateStopped
			continue
		}
		l.log.Info("queued workspace started", "id", id)
	}
}

func (l *Landlord) canAdmitLocked() bool {
	awake := 0
	for _, ws := range l.workspaces {
		if ws.State == StateRunning {
			awake++
		}
	}
	return CanAdmit(awake)
}

func (l *Landlord) enqueueLocked(id string) {
	for _, q := range l.queue {
		if q == id {
			return
		}
	}
	l.queue = append(l.queue, id)
}

func (l *Landlord) removeFromQueueLocked(id string) {
	dst := l.queue[:0]
	for _, q := range l.queue {
		if q != id {
			dst = append(dst, q)
		}
	}
	l.queue = dst
}

func (l *Landlord) queuePositionLocked(id string) int {
	for i, q := range l.queue {
		if q == id {
			return i + 1
		}
	}
	return 0
}

func (l *Landlord) viewLocked(ws *Workspace) Workspace {
	v := *ws
	v.QueuePosition = l.queuePositionLocked(ws.ID)
	return v
}

func (l *Landlord) unusedID() string {
	for {
		id := newID()
		if _, ok := l.workspaces[id]; !ok {
			return id
		}
	}
}

func newID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}

func validateName(name string) error {
	if name == "" {
		return nil
	}
	if utf8.RuneCountInString(name) > 64 {
		return ErrInvalidName
	}
	for _, r := range name {
		if r == '/' || r == '\x00' {
			return ErrInvalidName
		}
	}
	return nil
}
