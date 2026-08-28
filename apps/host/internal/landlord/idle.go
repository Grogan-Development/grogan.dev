package landlord

import (
	"time"
)

const (
	DisconnectGrace = 5 * time.Minute
	ZombieGrace     = 20 * time.Minute
)

// shouldIdleStop implements the two clocks from workspace-lifecycle.md:
// connected UI / agent turn / registered job pin the workspace;
// 5 min after last UI disconnect; 20 min with no heartbeat (zombie tab or stale guest).
func shouldIdleStop(ws *Workspace, now time.Time) bool {
	if ws.State != StateRunning {
		return false
	}
	heartbeatAge := now.Sub(ws.LastHeartbeat)
	keep := ws.Connected || ws.AgentWorking || ws.JobRunning
	if keep {
		return heartbeatAge >= ZombieGrace
	}
	if !ws.LastDisconnect.IsZero() {
		return now.Sub(ws.LastDisconnect) >= DisconnectGrace
	}
	return heartbeatAge >= ZombieGrace
}
