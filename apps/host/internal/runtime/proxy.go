package runtime

import (
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"
)

const socketPerm = 0o660

// socketDirPerm lets the caddy group traverse to the sockets (r-x for group);
// the tmpfiles drop-in (deploy/tmpfiles/nero-host.conf) creates it at boot.
const socketDirPerm = 0o750

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
	// Self-heal an existing dir too: a reboot with UMask=0077 (or a stray
	// root mkdir) leaves it 0700 and Caddy can never traverse to the sockets.
	if err := os.Chmod(h.dir, socketDirPerm); err != nil {
		return err
	}
	path := SocketPath(h.dir, id)
	_ = os.Remove(path)
	ln, err := net.Listen("unix", path)
	if err != nil {
		return err
	}
	if err := tightenSocket(path); err != nil {
		_ = ln.Close()
		_ = os.Remove(path)
		return err
	}
	h.m[id] = &boundProxy{ln: ln, port: port}
	go serveUnixProxy(ln, HostDial(port))
	return nil
}

// chownToCaddy hands the socket to the caddy group. Injectable so tests can
// run without root or a caddy user (the landlord runs as root in prod).
var chownToCaddy = func(path string) error {
	g, err := user.LookupGroup("caddy")
	if err != nil {
		return fmt.Errorf("caddy group lookup failed; workspace sockets would be unreachable: %w", err)
	}
	gid, err := strconv.Atoi(g.Gid)
	if err != nil {
		return fmt.Errorf("caddy gid: %w", err)
	}
	if err := os.Chown(path, 0, gid); err != nil {
		return fmt.Errorf("chown %s: %w", path, err)
	}
	return nil
}

// tightenSocket makes the socket usable by Caddy and treats every failure as
// a bind failure: a socket Caddy cannot connect to is a silent 502 for all
// of the workspace's routes, which is far worse than a loud wake error.
func tightenSocket(path string) error {
	if err := os.Chmod(path, socketPerm); err != nil {
		return fmt.Errorf("chmod %s: %w", path, err)
	}
	return chownToCaddy(path)
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
			// A transient accept error (EMFILE under load, ECONNABORTED) must
			// not kill the proxy permanently; only a closed listener ends it.
			if errors.Is(err, net.ErrClosed) {
				return
			}
			if isTransientAccept(err) {
				time.Sleep(5 * time.Millisecond)
				continue
			}
			return
		}
		go proxyConn(c, target)
	}
}

func isTransientAccept(err error) bool {
	var ne net.Error
	if errors.As(err, &ne) {
		return ne.Timeout()
	}
	var oe *os.SyscallError
	if errors.As(err, &oe) {
		return errors.Is(oe.Err, syscall.EMFILE) ||
			errors.Is(oe.Err, syscall.ENFILE) ||
			errors.Is(oe.Err, syscall.ECONNABORTED)
	}
	return false
}

type closeWriter interface {
	CloseWrite() error
}

func closeWrite(c net.Conn) {
	if cw, ok := c.(closeWriter); ok {
		_ = cw.CloseWrite()
		return
	}
	_ = c.Close()
}

func proxyConn(c net.Conn, target string) {
	defer c.Close()
	u, err := net.DialTimeout("tcp", target, 5*time.Second)
	if err != nil {
		return
	}
	defer u.Close()
	done := make(chan struct{})
	go func() {
		_, _ = io.Copy(u, c)
		closeWrite(u)
		close(done)
	}()
	_, _ = io.Copy(c, u)
	closeWrite(c)
	<-done
}
