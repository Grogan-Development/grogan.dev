package landlord

import (
	"time"
)

const (
	DisconnectGrace = 5 * time.Minute
	ZombieGrace     = 20 * time.Minute
)

func pinned(ws *Workspace) bool {
	return ws.Connected || ws.AgentWorking || ws.JobRunning
}

// shouldIdleStop: ZombieGrace only while a keep-awake bit is set but heartbeats
// are stale. DisconnectGrace starts when the workspace becomes unpinned
// (no session AND no agent AND no job), including never-connected.
func shouldIdleStop(ws *Workspace, now time.Time) bool {
	if ws.State != StateRunning {
		return false
	}
	if pinned(ws) {
		return now.Sub(ws.LastHeartbeat) >= ZombieGrace
	}
	since := ws.UnpinnedAt
	if since.IsZero() {
		since = ws.CreatedAt
	}
	return now.Sub(since) >= DisconnectGrace
}

func (ws *Workspace) touchUnpinned(now time.Time) {
	if pinned(ws) {
		ws.UnpinnedAt = time.Time{}
		return
	}
	if ws.UnpinnedAt.IsZero() {
		ws.UnpinnedAt = now
	}
}
