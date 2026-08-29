package runtime

import (
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func shortSockDir(t *testing.T) string {
	t.Helper()
	// macOS sun_path is ~104 bytes; t.TempDir() is often longer.
	dir, err := os.MkdirTemp("/tmp", "nprx")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	return dir
}

func TestUnixProxyForwardsHTTP(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "ok")
	})
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: time.Second}
	go func() { _ = srv.Serve(ln) }()
	defer srv.Close()

	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	dir := shortSockDir(t)
	hub := newProxyHub(dir)
	id := "0123456789abcdef"
	if err := hub.bind(id, port); err != nil {
		t.Fatal(err)
	}
	defer hub.close(id)

	sock := SocketPath(dir, id)
	st, err := os.Stat(sock)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0o660 {
		t.Fatalf("perm=%o want 0660", st.Mode().Perm())
	}
	client := &http.Client{
		Transport: &http.Transport{
			Dial: func(network, addr string) (net.Conn, error) {
				return net.Dial("unix", sock)
			},
		},
		Timeout: 2 * time.Second,
	}
	res, err := client.Get("http://workspace/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || string(body) != "ok" {
		t.Fatalf("status=%d body=%q", res.StatusCode, body)
	}
}

func TestUnixProxyRebindSamePortIdempotent(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	_, port, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	hub := newProxyHub(shortSockDir(t))
	id := "0123456789abcdef"
	if err := hub.bind(id, port); err != nil {
		t.Fatal(err)
	}
	if err := hub.bind(id, port); err != nil {
		t.Fatal(err)
	}
	hub.close(id)
	if _, err := os.Stat(filepath.Join(hub.dir, id+".sock")); !os.IsNotExist(err) {
		t.Fatalf("socket should be gone: %v", err)
	}
}
