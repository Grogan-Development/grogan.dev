package landlord

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"nero-host/internal/runtime"
)

var errDockerDown = errors.New("docker down")

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func newTest(t *testing.T) (*Landlord, *runtime.Fake, *FakeClock) {
	t.Helper()
	clk := NewFakeClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	rt := runtime.NewFake()
	return New(rt, clk, discardLogger()), rt, clk
}

func TestCanAdmitTwoNotThree(t *testing.T) {
	if MaxAwake() != 2 {
		t.Fatalf("MaxAwake=%d want 2", MaxAwake())
	}
	if !CanAdmit(0) || !CanAdmit(1) {
		t.Fatal("should admit first two")
	}
	if CanAdmit(2) {
		t.Fatal("third 64GiB workspace must queue")
	}
}

func TestCreateStartsUntilCapacityThenFIFO(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)

	a, err := l.Create(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	b, err := l.Create(ctx, "b")
	if err != nil {
		t.Fatal(err)
	}
	c, err := l.Create(ctx, "c")
	if err != nil {
		t.Fatal(err)
	}
	d, err := l.Create(ctx, "d")
	if err != nil {
		t.Fatal(err)
	}

	if a.State != StateRunning || b.State != StateRunning {
		t.Fatalf("a,b want running got %s %s", a.State, b.State)
	}
	if c.State != StateQueued || d.State != StateQueued {
		t.Fatalf("c,d want queued got %s %s", c.State, d.State)
	}
	if c.QueuePosition != 1 || d.QueuePosition != 2 {
		t.Fatalf("queue positions c=%d d=%d", c.QueuePosition, d.QueuePosition)
	}
	if rt.Running(c.ID) || rt.Running(d.ID) {
		t.Fatal("queued containers must not start")
	}
	if got := l.Queue(); len(got) != 2 || got[0] != c.ID || got[1] != d.ID {
		t.Fatalf("queue=%v", got)
	}

	if _, err := l.Stop(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	c2, _ := l.Get(c.ID)
	d2, _ := l.Get(d.ID)
	if c2.State != StateRunning {
		t.Fatalf("FIFO head c should start, got %s", c2.State)
	}
	if d2.State != StateQueued || d2.QueuePosition != 1 {
		t.Fatalf("d should remain queued pos=1, got %s pos=%d", d2.State, d2.QueuePosition)
	}
	if rt.Running(a.ID) {
		t.Fatal("a should be stopped")
	}
	if !rt.Running(b.ID) || !rt.Running(c.ID) {
		t.Fatal("b and c should be running")
	}

	if _, err := l.Stop(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	d3, _ := l.Get(d.ID)
	if d3.State != StateRunning {
		t.Fatalf("d should start after b stop, got %s", d3.State)
	}
	if len(l.Queue()) != 0 {
		t.Fatalf("queue should be empty, got %v", l.Queue())
	}
}

func TestWakeQueuesBehindCreate(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	a, _ := l.Create(ctx, "a")
	b, _ := l.Create(ctx, "b")
	c, _ := l.Create(ctx, "c")
	if c.State != StateQueued {
		t.Fatal(c.State)
	}
	if _, err := l.Stop(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	stopped, _ := l.Get(c.ID)
	if stopped.State != StateStopped {
		t.Fatal(stopped.State)
	}

	w, err := l.Wake(ctx, c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if w.State != StateQueued || w.QueuePosition != 1 {
		t.Fatalf("wake of third should queue, got %s pos=%d", w.State, w.QueuePosition)
	}
	if rt.Running(c.ID) {
		t.Fatal("must not start")
	}

	again, _ := l.Wake(ctx, c.ID)
	if again.QueuePosition != 1 || len(l.Queue()) != 1 {
		t.Fatalf("duplicate wake must not re-enqueue: pos=%d q=%v", again.QueuePosition, l.Queue())
	}

	if _, err := l.Stop(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	c2, _ := l.Get(c.ID)
	if c2.State != StateRunning {
		t.Fatalf("wake FIFO should start c, got %s", c2.State)
	}
	if !rt.Running(b.ID) {
		t.Fatal("b still running")
	}
}

func TestStopQueuedPromotesNext(t *testing.T) {
	ctx := context.Background()
	l, _, _ := newTest(t)
	a, _ := l.Create(ctx, "a")
	_, _ = l.Create(ctx, "b")
	c, _ := l.Create(ctx, "c")
	d, _ := l.Create(ctx, "d")
	if _, err := l.Stop(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	d2, _ := l.Get(d.ID)
	if d2.State != StateQueued || d2.QueuePosition != 1 {
		t.Fatalf("d should be sole queued, got %s pos=%d", d2.State, d2.QueuePosition)
	}
	if _, err := l.Stop(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	d3, _ := l.Get(d.ID)
	if d3.State != StateRunning {
		t.Fatalf("d should start, got %s", d3.State)
	}
}

func TestCreatePersistsDatasetWhenQueued(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	_, _ = l.Create(ctx, "a")
	_, _ = l.Create(ctx, "b")
	c, _ := l.Create(ctx, "c")
	if !rt.Datasets[c.ID] {
		t.Fatal("dataset must exist while queued")
	}
	if _, ok := rt.Containers[c.ID]; !ok {
		t.Fatal("container must exist while queued")
	}
	if rt.Running(c.ID) {
		t.Fatal("must be stopped")
	}
}

func TestInvalidNameRejected(t *testing.T) {
	ctx := context.Background()
	l, _, _ := newTest(t)
	for _, name := range []string{"foo|bar", "has space", "slash/name", "a,b"} {
		if _, err := l.Create(ctx, name); err != ErrInvalidName {
			t.Fatalf("name %q: err=%v", name, err)
		}
	}
	if _, err := l.Create(ctx, "ok._-Name1"); err != nil {
		t.Fatal(err)
	}
}

func TestRestoreFailsWhenListFails(t *testing.T) {
	l, rt, _ := newTest(t)
	rt.ListErr = errDockerDown
	if err := l.Restore(context.Background()); err == nil {
		t.Fatal("expected list error")
	}
}

func TestRestoreRoundTripAndOverBudget(t *testing.T) {
	ctx := context.Background()
	clk := NewFakeClock(time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC))
	rt := runtime.NewFake()
	rt.Seed("aa", "alpha", true)
	rt.Seed("bb", "beta", true)
	rt.Seed("cc", "foo|bar", true) // pipe in stored name must not affect Running
	l := New(rt, clk, discardLogger())
	if err := l.Restore(ctx); err != nil {
		t.Fatal(err)
	}
	var running, queued int
	for _, ws := range l.List() {
		switch ws.State {
		case StateRunning:
			running++
			if !rt.Running(ws.ID) {
				t.Fatalf("%s map running but docker stopped", ws.ID)
			}
		case StateQueued:
			queued++
			if rt.Running(ws.ID) {
				t.Fatalf("%s queued but docker still running", ws.ID)
			}
		}
	}
	if running != 2 {
		t.Fatalf("running=%d want 2", running)
	}
	if queued != 1 {
		t.Fatalf("queued extras=%d want 1", queued)
	}
	cc, err := l.Get("cc")
	if err != nil {
		t.Fatal(err)
	}
	if cc.Name != "foo|bar" {
		t.Fatalf("name round-trip %q", cc.Name)
	}

	l2 := New(rt, clk, discardLogger())
	if err := l2.Restore(ctx); err != nil {
		t.Fatal(err)
	}
	var running2 int
	for _, ws := range l2.List() {
		if ws.State == StateRunning {
			running2++
		}
	}
	if running2 != 2 {
		t.Fatalf("second restore running=%d", running2)
	}
}

func TestStartCLIErrorInspectRunningCountsTowardAdmission(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	rt.StartErr = errors.New("cli timeout after daemon start")

	a, err := l.Create(ctx, "a")
	if err != nil {
		t.Fatalf("inspect running should record start: %v", err)
	}
	if a.State != StateRunning {
		t.Fatalf("state=%s", a.State)
	}
	if !rt.Running(a.ID) {
		t.Fatal("docker side is running")
	}

	b, err := l.Create(ctx, "b")
	if err != nil {
		t.Fatal(err)
	}
	if b.State != StateRunning {
		t.Fatalf("b state=%s", b.State)
	}
	c, err := l.Create(ctx, "c")
	if err != nil {
		t.Fatal(err)
	}
	if c.State != StateQueued {
		t.Fatalf("third must queue, got %s", c.State)
	}
	if rt.Running(c.ID) {
		t.Fatal("must not start a third 64GiB workspace")
	}
}

func TestCreateInspectFailCountsAsRunning(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	rt.InspectErr = errors.New("inspect fail after start")

	a, err := l.Create(ctx, "a")
	if err != nil {
		t.Fatalf("inspect-fail after start must still occupy a slot: %v", err)
	}
	if a.State != StateRunning {
		t.Fatalf("state=%s want running (do not under-count)", a.State)
	}
	b, err := l.Create(ctx, "b")
	if err != nil {
		t.Fatal(err)
	}
	if b.State != StateRunning {
		t.Fatalf("b state=%s", b.State)
	}
	c, err := l.Create(ctx, "c")
	if err != nil {
		t.Fatal(err)
	}
	if c.State != StateQueued {
		t.Fatalf("third must queue, got %s", c.State)
	}
}

func TestDrainQueueStartFailureDoesNotBusyLoop(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	a, err := l.Create(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Create(ctx, "b"); err != nil {
		t.Fatal(err)
	}
	c, err := l.Create(ctx, "c")
	if err != nil {
		t.Fatal(err)
	}
	if c.State != StateQueued {
		t.Fatal(c.State)
	}

	rt.StartBlocked = errors.New("broken image")
	done := make(chan error, 1)
	go func() {
		_, err := l.Stop(ctx, a.ID)
		done <- err
	}()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("drainQueue busy-looped under opMu")
	}

	got, _ := l.Get(c.ID)
	if got.State != StateQueued {
		t.Fatalf("c should remain queued for next pass, got %s", got.State)
	}
	if rt.Running(c.ID) {
		t.Fatal("c must not have started")
	}
	if q := l.Queue(); len(q) != 1 || q[0] != c.ID {
		t.Fatalf("queue=%v", l.Queue())
	}
	// opMu released: a subsequent API call must complete
	if _, err := l.Get(a.ID); err != nil {
		t.Fatal(err)
	}
}

func TestStopInspectFailureKeepsRunning(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	a, err := l.Create(ctx, "a")
	if err != nil {
		t.Fatal(err)
	}
	rt.InspectErr = errors.New("inspect deadline")
	if _, err := l.Stop(ctx, a.ID); err == nil {
		t.Fatal("expected inspect error")
	}
	got, _ := l.Get(a.ID)
	if got.State != StateRunning {
		t.Fatalf("must not flip to stopped on inspect failure, got %s", got.State)
	}
}

// When adoption pushes the landlord over budget, the demoted workspace is an
// unpinned one (longest-unpinned first) - never a workspace in active use.
func TestEnforceBudgetDemotesUnpinnedFirst(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)

	a, err := l.Create(ctx, "pinned")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Heartbeat(a.ID, Heartbeat{Connected: boolPtr(true)}); err != nil {
		t.Fatal(err)
	}
	b, err := l.Create(ctx, "unpinned")
	if err != nil {
		t.Fatal(err)
	}
	if !rt.Running(a.ID) || !rt.Running(b.ID) {
		t.Fatalf("both should run: a=%v b=%v", rt.Running(a.ID), rt.Running(b.ID))
	}

	// An externally started container is adopted on the next tick, pushing
	// the count to three against a budget of two.
	rt.Seed("0123456789abcdef", "external", true)
	clk.Advance(time.Second)
	l.ReconcileIdle(ctx)

	if !rt.Running(a.ID) {
		t.Fatal("the pinned workspace must survive demotion")
	}
	if rt.Running(b.ID) {
		t.Fatal("the unpinned workspace must be demoted first")
	}
	ext, err := l.Get("0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	_ = ext
}
