package runtime

import (
	"context"
	"fmt"
	"sync"
)

type FakeContainer struct {
	ID      string
	Name    string
	Running bool
}

type Fake struct {
	mu         sync.Mutex
	Datasets   map[string]bool
	Containers map[string]*FakeContainer
	Starts     []string
	Stops      []string
}

func NewFake() *Fake {
	return &Fake{
		Datasets:   make(map[string]bool),
		Containers: make(map[string]*FakeContainer),
	}
}

func (f *Fake) CreateDataset(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.Datasets[id] {
		return fmt.Errorf("dataset exists: %s", id)
	}
	f.Datasets[id] = true
	return nil
}

func (f *Fake) DestroyDataset(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.Datasets, id)
	return nil
}

func (f *Fake) CreateContainer(_ context.Context, spec WorkspaceSpec) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.Containers[spec.ID]; ok {
		return fmt.Errorf("container exists: %s", spec.ID)
	}
	f.Containers[spec.ID] = &FakeContainer{ID: spec.ID, Name: spec.Name}
	return nil
}

func (f *Fake) StartContainer(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.Containers[id]
	if !ok {
		return fmt.Errorf("no container: %s", id)
	}
	c.Running = true
	f.Starts = append(f.Starts, id)
	return nil
}

func (f *Fake) StopContainer(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.Containers[id]
	if !ok {
		return fmt.Errorf("no container: %s", id)
	}
	c.Running = false
	f.Stops = append(f.Stops, id)
	return nil
}

func (f *Fake) ListContainers(_ context.Context) ([]ContainerInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]ContainerInfo, 0, len(f.Containers))
	for _, c := range f.Containers {
		out = append(out, ContainerInfo{ID: c.ID, Name: c.Name, Running: c.Running})
	}
	return out, nil
}

func (f *Fake) Running(id string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.Containers[id]
	return ok && c.Running
}

func (f *Fake) StartedCount(id string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, s := range f.Starts {
		if s == id {
			n++
		}
	}
	return n
}
