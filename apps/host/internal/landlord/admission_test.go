package landlord

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"nero-host/internal/runtime"
)

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
