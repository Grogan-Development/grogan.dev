package landlord

// Host packing for grid-01 (187 GiB, no swap). Locked by PLAN.md:
// refuse/queue if awake_count*64GiB + 24GiB > 187GiB (~2 awake).
const (
	HostMemGiB     = 187
	HostReserveGiB = 24
	WSHardGiB      = 64
)

func CanAdmit(awakeCount int) bool {
	return (awakeCount+1)*WSHardGiB+HostReserveGiB <= HostMemGiB
}

func MaxAwake() int {
	return (HostMemGiB - HostReserveGiB) / WSHardGiB
}
