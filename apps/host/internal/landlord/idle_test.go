package landlord

import (
	"context"
	"testing"
	"time"
)

func boolPtr(v bool) *bool { return &v }

func TestIdleZombieTab20Min(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	if _, err := l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true)}); err != nil {
		t.Fatal(err)
	}

	clk.Advance(19 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 {
		t.Fatalf("too early: %v", n)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("should still run")
	}

	clk.Advance(2 * time.Minute)
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 1 || stopped[0] != ws.ID {
		t.Fatalf("stopped=%v", stopped)
	}
	got, _ := l.Get(ws.ID)
	if got.State != StateStopped || rt.Running(ws.ID) {
		t.Fatal("zombie tab should docker stop")
	}
}

func TestIdleDisconnect5Min(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true)})
	clk.Advance(time.Minute)
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false)})

	clk.Advance(4 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 {
		t.Fatalf("disconnect grace not over: %v", n)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("should still run")
	}

	clk.Advance(2 * time.Minute)
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 1 || stopped[0] != ws.ID {
		t.Fatalf("stopped=%v", stopped)
	}
}

func TestIdleJobKeepsAwakeAfterDisconnect(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true), JobRunning: boolPtr(true)})
	clk.Advance(time.Minute)
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false), JobRunning: boolPtr(true)})

	clk.Advance(10 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 {
		t.Fatalf("job should pin: %v", n)
	}
	if !rt.Running(ws.ID) {
		t.Fatal("job keep-awake")
	}

	clk.Advance(15 * time.Minute) // last heartbeat 25 min ago
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 1 {
		t.Fatalf("stale job heartbeat should stop: %v", stopped)
	}
}

func TestIdleAgentWorkingPins(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false), AgentWorking: boolPtr(true)})
	clk.Advance(10 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 || !rt.Running(ws.ID) {
		t.Fatalf("agent turn should pin, stopped=%v running=%v", n, rt.Running(ws.ID))
	}
}

func TestIdleNeverConnected5Min(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")

	clk.Advance(4 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 {
		t.Fatalf("too early: %v", n)
	}
	clk.Advance(2 * time.Minute)
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 1 || rt.Running(ws.ID) {
		t.Fatalf("unpinned (never connected) → stop after 5m, stopped=%v", stopped)
	}
}

func TestIdleGraceStartsWhenLastPinDrops(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true), JobRunning: boolPtr(true)})
	clk.Advance(time.Minute)
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false), JobRunning: boolPtr(true)})
	clk.Advance(10 * time.Minute)
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false), JobRunning: boolPtr(false)})

	clk.Advance(4 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 || !rt.Running(ws.ID) {
		t.Fatalf("grace after last pin drop, stopped=%v", n)
	}
	clk.Advance(2 * time.Minute)
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 1 {
		t.Fatalf("should stop 5m after job ended, got %v", stopped)
	}
}

func TestIdleStopAdmitsQueued(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	a, _ := l.Create(ctx, "a")
	_, _ = l.Create(ctx, "b")
	c, _ := l.Create(ctx, "c")
	if c.State != StateQueued {
		t.Fatal(c.State)
	}

	clk.Advance(6 * time.Minute)
	stopped := l.ReconcileIdle(ctx)
	if len(stopped) != 2 {
		t.Fatalf("both awake should idle-stop, got %v", stopped)
	}
	c2, _ := l.Get(c.ID)
	if c2.State != StateRunning || !rt.Running(c.ID) {
		t.Fatalf("idle stop should drain FIFO, c state=%s running=%v", c2.State, rt.Running(c.ID))
	}
	a2, _ := l.Get(a.ID)
	if a2.State != StateStopped {
		t.Fatal(a2.State)
	}
}

func TestHeartbeatReconnectClearsDisconnectTimer(t *testing.T) {
	ctx := context.Background()
	l, rt, clk := newTest(t)
	ws, _ := l.Create(ctx, "a")
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true)})
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(false)})
	clk.Advance(4 * time.Minute)
	_, _ = l.Heartbeat(ws.ID, Heartbeat{Connected: boolPtr(true)})
	clk.Advance(4 * time.Minute)
	if n := l.ReconcileIdle(ctx); len(n) != 0 || !rt.Running(ws.ID) {
		t.Fatalf("reconnect should cancel 5m timer: %v", n)
	}
}

func TestReconcileReappliesCgroup(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	ws, _ := l.Create(ctx, "a")
	before := rt.CgroupApplyCount()
	l.ReconcileIdle(ctx)
	if rt.CgroupApplyCount() <= before {
		t.Fatal("idle tick should re-apply memory.high")
	}
	if !rt.Running(ws.ID) {
		t.Fatal("still running")
	}
}

func TestReconcileNoticesExitedGuest(t *testing.T) {
	ctx := context.Background()
	l, rt, _ := newTest(t)
	a, _ := l.Create(ctx, "a")
	_, _ = l.Create(ctx, "b")
	c, _ := l.Create(ctx, "c")
	if c.State != StateQueued {
		t.Fatal(c.State)
	}
	if err := rt.StopContainer(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	l.ReconcileIdle(ctx)
	a2, _ := l.Get(a.ID)
	if a2.State != StateStopped {
		t.Fatalf("exited guest should be stopped, got %s", a2.State)
	}
	c2, _ := l.Get(c.ID)
	if c2.State != StateRunning || !rt.Running(c.ID) {
		t.Fatalf("slot should drain to c, state=%s running=%v", c2.State, rt.Running(c.ID))
	}
}
