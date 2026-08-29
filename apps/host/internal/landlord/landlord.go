package landlord

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
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
	ErrNotRunning  = errors.New("workspace not running")
)

// opTimeout covers docker stop -t 20 plus inspect. Detached from HTTP cancel
// so a dropped client cannot leave docker started with StateStopped.
const (
	opTimeout     = 60 * time.Second
	maxStartFails = 3
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
	UnpinnedAt     time.Time `json:"-"`
	StartFails     int       `json:"-"`
	QueuePosition  int       `json:"queuePosition,omitempty"`
}

type Heartbeat struct {
	Connected    *bool
	AgentWorking *bool
	JobRunning   *bool
}

type Landlord struct {
	opMu       sync.Mutex // serializes docker/zfs + packing transitions; never after mu
	mu         sync.Mutex // short: map/queue/heartbeat
	rt         runtime.Runtime
	clock      Clock
	log        *slog.Logger
	workspaces map[string]*Workspace
	queue      []string
	runtimeOK  bool
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
		runtimeOK:  true,
	}
}

func opContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), opTimeout)
}

func (l *Landlord) Restore(_ context.Context) error {
	l.opMu.Lock()
	defer l.opMu.Unlock()

	list, err := l.rtList()
	if err != nil {
		l.mu.Lock()
		l.runtimeOK = false
		l.mu.Unlock()
		return err
	}

	now := l.clock.Now()
	l.mu.Lock()
	l.runtimeOK = true
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
		ws := &Workspace{
			ID:            c.ID,
			Name:          name,
			State:         st,
			CreatedAt:     now,
			LastHeartbeat: now,
		}
		ws.touchUnpinned(now)
		l.workspaces[c.ID] = ws
	}
	l.mu.Unlock()
	l.enforceBudget()
	l.ensureProxies()
	l.log.Info("restored workspaces", "n", len(l.List()))
	return nil
}

func (l *Landlord) Create(_ context.Context, name string) (Workspace, error) {
	if err := validateName(name); err != nil {
		return Workspace{}, err
	}
	l.opMu.Lock()
	defer l.opMu.Unlock()

	l.mu.Lock()
	id := l.unusedID()
	l.mu.Unlock()
	if name == "" {
		name = "workspace-" + id[:4]
	}

	if err := l.rtCreateDataset(id); err != nil {
		return Workspace{}, err
	}
	if err := l.rtCreateContainer(runtime.WorkspaceSpec{ID: id, Name: name}); err != nil {
		_ = l.rtDestroyDataset(id)
		return Workspace{}, err
	}

	now := l.clock.Now()
	ws := &Workspace{
		ID:            id,
		Name:          name,
		State:         StateStopped,
		CreatedAt:     now,
		LastHeartbeat: now,
	}
	ws.touchUnpinned(now)
	l.mu.Lock()
	l.workspaces[id] = ws
	l.mu.Unlock()

	if err := l.tryStart(id); err != nil {
		return Workspace{}, err
	}
	l.log.Info("workspace created", "id", id)
	return l.Get(id)
}

func (l *Landlord) Wake(_ context.Context, id string) (Workspace, error) {
	l.opMu.Lock()
	defer l.opMu.Unlock()

	l.mu.Lock()
	ws, ok := l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return Workspace{}, ErrNotFound
	}
	if ws.State == StateRunning || ws.State == StateQueued {
		view := l.viewLocked(ws)
		l.mu.Unlock()
		return view, nil
	}
	l.mu.Unlock()

	if err := l.tryStart(id); err != nil {
		return Workspace{}, err
	}
	l.log.Info("workspace wake", "id", id)
	return l.Get(id)
}

func (l *Landlord) Stop(_ context.Context, id string) (Workspace, error) {
	l.opMu.Lock()
	defer l.opMu.Unlock()
	return l.stopOp(id, false)
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
	ws.touchUnpinned(now)
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

func (l *Landlord) ReconcileIdle(_ context.Context) []string {
	l.opMu.Lock()
	defer l.opMu.Unlock()

	if err := l.syncRuntime(); err != nil {
		l.log.Warn("runtime sync failed", "err", err)
		l.mu.Lock()
		l.runtimeOK = false
		l.mu.Unlock()
		return nil
	}
	l.mu.Lock()
	wasOK := l.runtimeOK
	l.runtimeOK = true
	l.mu.Unlock()
	if !wasOK {
		l.drainQueue()
	}

	l.reapplyCgroups()
	l.ensureProxies()

	now := l.clock.Now()
	l.mu.Lock()
	var ids []string
	for id, ws := range l.workspaces {
		if shouldIdleStop(ws, now) {
			ids = append(ids, id)
		}
	}
	l.mu.Unlock()
	sort.Strings(ids)

	var stopped []string
	for _, id := range ids {
		if _, err := l.stopOp(id, false); err != nil {
			l.log.Warn("idle stop failed", "id", id, "err", err)
			continue
		}
		stopped = append(stopped, id)
		l.log.Info("idle stop", "id", id)
	}
	return stopped
}

// tryStart assumes opMu is held. mu is not held across runtime calls.
// Inspect is the source of truth: a CLI timeout after docker has started
// still records running. Inspect failure does not flip to stopped.
func (l *Landlord) tryStart(id string) error {
	l.mu.Lock()
	ws, ok := l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return ErrNotFound
	}
	if ws.State == StateRunning {
		l.mu.Unlock()
		return nil
	}
	if !l.canAdmitLocked() {
		ws.State = StateQueued
		l.enqueueLocked(id)
		pos := l.queuePositionLocked(id)
		l.mu.Unlock()
		l.log.Info("workspace queued", "id", id, "position", pos)
		return nil
	}
	l.mu.Unlock()

	startErr := l.rtStart(id)
	if startErr != nil {
		l.log.Warn("docker start cli", "id", id, "err", startErr)
	}
	info, inspErr := l.rtInspect(id)
	// Inspect failure after a start attempt: do not leave a live container
	// counted as stopped (that under-counts and over-admits).
	live := inspErr != nil || info.Running
	if inspErr != nil {
		l.log.Warn("inspect after start failed; counting as running", "id", id, "err", inspErr)
	}
	if !live {
		l.mu.Lock()
		if w := l.workspaces[id]; w != nil && w.State != StateQueued {
			w.State = StateStopped
		}
		l.mu.Unlock()
		if startErr != nil {
			return startErr
		}
		return fmt.Errorf("container %s not running after start", id)
	}

	l.mu.Lock()
	ws, ok = l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return ErrNotFound
	}
	if !l.canAdmitLocked() {
		l.mu.Unlock()
		_ = l.rtStop(id)
		stopped, err := l.rtInspect(id)
		l.mu.Lock()
		if err == nil && !stopped.Running {
			if w := l.workspaces[id]; w != nil {
				w.State = StateQueued
				l.enqueueLocked(id)
			}
			l.mu.Unlock()
			return nil
		}
		// still running or inspect failed: count as running so we do not under-count
		ws = l.workspaces[id]
		if ws == nil {
			l.mu.Unlock()
			return ErrNotFound
		}
	}
	now := l.clock.Now()
	ws.State = StateRunning
	ws.StartFails = 0
	ws.LastHeartbeat = now
	if !pinned(ws) {
		ws.UnpinnedAt = now
	}
	l.removeFromQueueLocked(id)
	l.mu.Unlock()
	if err := l.rtEnsureProxy(id); err != nil {
		l.log.Warn("host socket bind failed", "id", id, "err", err)
		_ = l.rtStop(id)
		l.rt.CloseProxy(id)
		info, inspErr := l.rtInspect(id)
		l.mu.Lock()
		if w := l.workspaces[id]; w != nil && (inspErr == nil && !info.Running) {
			w.State = StateStopped
		}
		l.mu.Unlock()
		return err
	}
	return nil
}

// stopOp assumes opMu is held. queueAfter stops docker then FIFO-queues (restore extras).
func (l *Landlord) stopOp(id string, queueAfter bool) (Workspace, error) {
	l.mu.Lock()
	ws, ok := l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return Workspace{}, ErrNotFound
	}
	l.removeFromQueueLocked(id)
	wasRunning := ws.State == StateRunning
	l.mu.Unlock()

	if wasRunning {
		stopErr := l.rtStop(id)
		info, inspErr := l.rtInspect(id)
		if inspErr != nil {
			return Workspace{}, inspErr
		}
		if info.Running {
			if stopErr != nil {
				return Workspace{}, stopErr
			}
			return Workspace{}, fmt.Errorf("container %s still running after stop", id)
		}
		l.rt.CloseProxy(id)
	}

	l.mu.Lock()
	ws, ok = l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return Workspace{}, ErrNotFound
	}
	now := l.clock.Now()
	ws.Connected = false
	ws.AgentWorking = false
	ws.JobRunning = false
	ws.touchUnpinned(now)
	if queueAfter {
		ws.State = StateQueued
		l.enqueueLocked(id)
	} else {
		ws.State = StateStopped
	}
	view := l.viewLocked(ws)
	l.mu.Unlock()

	if !queueAfter {
		l.drainQueue()
	}
	return view, nil
}

func (l *Landlord) drainQueue() {
	for {
		l.mu.Lock()
		if len(l.queue) == 0 || !l.canAdmitLocked() {
			l.mu.Unlock()
			return
		}
		id := l.queue[0]
		l.queue = l.queue[1:]
		ws := l.workspaces[id]
		if ws == nil || ws.State != StateQueued {
			l.mu.Unlock()
			continue
		}
		l.mu.Unlock()
		if err := l.tryStart(id); err != nil {
			l.log.Warn("queued start failed", "id", id, "err", err)
			l.mu.Lock()
			if w := l.workspaces[id]; w != nil {
				w.StartFails++
				if w.StartFails >= maxStartFails {
					w.State = StateStopped
					l.removeFromQueueLocked(id)
					l.log.Warn("dropped from queue after start failures", "id", id, "fails", w.StartFails)
				} else if w.State == StateQueued {
					l.enqueueLocked(id)
				}
			}
			l.mu.Unlock()
			return
		}
	}
}

func (l *Landlord) syncRuntime() error {
	list, err := l.rtList()
	if err != nil {
		return err
	}
	seen := make(map[string]runtime.ContainerInfo, len(list))
	for _, c := range list {
		if c.ID != "" {
			seen[c.ID] = c
		}
	}

	now := l.clock.Now()
	l.mu.Lock()
	needDrain := false
	for id, c := range seen {
		if _, ok := l.workspaces[id]; ok {
			continue
		}
		name := c.Name
		if name == "" {
			name = "workspace-" + id
		}
		st := StateStopped
		if c.Running {
			st = StateRunning
		}
		ws := &Workspace{
			ID:            id,
			Name:          name,
			State:         st,
			CreatedAt:     now,
			LastHeartbeat: now,
		}
		ws.touchUnpinned(now)
		l.workspaces[id] = ws
		l.log.Info("adopted container", "id", id, "running", c.Running)
	}
	for id, ws := range l.workspaces {
		c, ok := seen[id]
		live := ok && c.Running
		if live {
			if ws.State != StateRunning {
				ws.State = StateRunning
				l.removeFromQueueLocked(id)
			}
			continue
		}
		if ws.State == StateRunning {
			ws.State = StateStopped
			ws.Connected = false
			ws.AgentWorking = false
			ws.JobRunning = false
			ws.touchUnpinned(now)
			needDrain = true
			l.log.Info("container exited", "id", id)
		}
	}
	l.mu.Unlock()

	l.enforceBudget()
	if needDrain {
		l.drainQueue()
	}
	return nil
}

func (l *Landlord) enforceBudget() {
	for {
		l.mu.Lock()
		var running []string
		for id, ws := range l.workspaces {
			if ws.State == StateRunning {
				running = append(running, id)
			}
		}
		sort.Strings(running)
		if len(running) <= MaxAwake() {
			l.mu.Unlock()
			return
		}
		id := running[len(running)-1]
		l.mu.Unlock()
		l.log.Info("stopping extra workspace to keep packing", "id", id)
		if _, err := l.stopOp(id, true); err != nil {
			l.log.Warn("demote failed", "id", id, "err", err)
			return
		}
	}
}

func (l *Landlord) reapplyCgroups() {
	for _, id := range l.runningIDs() {
		if err := l.rtApplyCgroup(id); err != nil {
			l.log.Warn("cgroup reapply failed", "id", id, "err", err)
		}
	}
}

func (l *Landlord) ensureProxies() {
	for _, id := range l.runningIDs() {
		if err := l.rtEnsureProxy(id); err != nil {
			l.log.Warn("host socket bind failed", "id", id, "err", err)
		}
	}
}

func (l *Landlord) runningIDs() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	var ids []string
	for id, ws := range l.workspaces {
		if ws.State == StateRunning {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids
}

func (l *Landlord) DialAddr(id string) (string, error) {
	l.mu.Lock()
	ws, ok := l.workspaces[id]
	if !ok {
		l.mu.Unlock()
		return "", ErrNotFound
	}
	if ws.State != StateRunning {
		l.mu.Unlock()
		return "", ErrNotRunning
	}
	l.mu.Unlock()
	addr, err := l.rt.DialAddr(id)
	if err != nil {
		return "", err
	}
	if addr == "" {
		return "", ErrNotRunning
	}
	return addr, nil
}

func (l *Landlord) rtStart(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.StartContainer(ctx, id)
}

func (l *Landlord) rtStop(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.StopContainer(ctx, id)
}

func (l *Landlord) rtInspect(id string) (runtime.ContainerInfo, error) {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.InspectContainer(ctx, id)
}

func (l *Landlord) rtList() ([]runtime.ContainerInfo, error) {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.ListContainers(ctx)
}

func (l *Landlord) rtApplyCgroup(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.ApplyCgroup(ctx, id)
}

func (l *Landlord) rtEnsureProxy(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.EnsureProxy(ctx, id)
}

func (l *Landlord) rtCreateDataset(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.CreateDataset(ctx, id)
}

func (l *Landlord) rtDestroyDataset(id string) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.DestroyDataset(ctx, id)
}

func (l *Landlord) rtCreateContainer(spec runtime.WorkspaceSpec) error {
	ctx, cancel := opContext()
	defer cancel()
	return l.rt.CreateContainer(ctx, spec)
}

func (l *Landlord) canAdmitLocked() bool {
	if !l.runtimeOK {
		return false
	}
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
		if !validNameRune(r) {
			return ErrInvalidName
		}
	}
	return nil
}

func validNameRune(r rune) bool {
	switch {
	case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		return true
	case r == '.' || r == '_' || r == '-':
		return true
	default:
		return false
	}
}
