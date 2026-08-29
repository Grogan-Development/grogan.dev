package runtime

import (
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"
)

func SocketPath(dir, id string) string {
	return filepath.Join(dir, id+".sock")
}

func HostDial(port string) string {
	return net.JoinHostPort("127.0.0.1", port)
}

func ValidWorkspaceID(id string) bool {
	n := len(id)
	if n < 8 || n > 32 {
		return false
	}
	for i := 0; i < n; i++ {
		c := id[i]
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

type boundProxy struct {
	ln   net.Listener
	port string
}

type proxyHub struct {
	dir string
	mu  sync.Mutex
	m   map[string]*boundProxy
}

func newProxyHub(dir string) *proxyHub {
	if dir == "" {
		dir = DefaultSocketDir
	}
	return &proxyHub{dir: dir, m: make(map[string]*boundProxy)}
}

func (h *proxyHub) bind(id, port string) error {
	if !ValidWorkspaceID(id) {
		return fmt.Errorf("invalid workspace id")
	}
	if port == "" {
		return fmt.Errorf("empty host port")
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if cur, ok := h.m[id]; ok && cur.port == port {
		return nil
	}
	h.closeLocked(id)
	if err := os.MkdirAll(h.dir, 0o755); err != nil {
		return err
	}
	path := SocketPath(h.dir, id)
	_ = os.Remove(path)
	ln, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	if err := os.Chmod(path, 0o666); err != nil {
		_ = ln.Close()
		_ = os.Remove(path)
		return err
	}
	h.m[id] = &boundProxy{ln: ln, port: port}
	go serveUnixProxy(ln, HostDial(port))
	return nil
}

func (h *proxyHub) close(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.closeLocked(id)
}

func (h *proxyHub) closeLocked(id string) {
	p, ok := h.m[id]
	if !ok {
		return
	}
	_ = p.ln.Close()
	_ = os.Remove(SocketPath(h.dir, id))
	delete(h.m, id)
}

func serveUnixProxy(ln net.Listener, target string) {
	for {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		go proxyConn(c, target)
	}
}

func proxyConn(c net.Conn, target string) {
	defer c.Close()
	u, err := net.DialTimeout("tcp", target, 5*time.Second)
	if err != nil {
		return
	}
	defer u.Close()
	errc := make(chan struct{}, 2)
	go func() {
		_, _ = io.Copy(u, c)
		errc <- struct{}{}
	}()
	go func() {
		_, _ = io.Copy(c, u)
		errc <- struct{}{}
	}()
	<-errc
}
