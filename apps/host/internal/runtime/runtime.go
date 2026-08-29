package runtime

import "context"

type WorkspaceSpec struct {
	ID   string
	Name string
}

type ContainerInfo struct {
	ID      string
	Name    string
	Running bool
}

// Runtime is ZFS + Docker. Tests use Fake so they do not shell out.
type Runtime interface {
	CreateDataset(ctx context.Context, id string) error
	DestroyDataset(ctx context.Context, id string) error
	CreateContainer(ctx context.Context, spec WorkspaceSpec) error
	StartContainer(ctx context.Context, id string) error
	StopContainer(ctx context.Context, id string) error
	InspectContainer(ctx context.Context, id string) (ContainerInfo, error)
	ListContainers(ctx context.Context) ([]ContainerInfo, error)
	ApplyCgroup(ctx context.Context, id string) error
}
