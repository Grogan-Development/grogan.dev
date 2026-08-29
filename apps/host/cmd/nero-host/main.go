package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nero-host/internal/api"
	"nero-host/internal/auth"
	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/internal/runtime"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := config.FromEnv()
	if err := cfg.AuthReady(); err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	rt := runtime.NewDocker(runtime.DockerSettings{
		Image:          cfg.GuestImage,
		Pool:           cfg.ZFSPool,
		MountRoot:      cfg.MountRoot,
		HostToken:      cfg.HostToken,
		AccessToken:    cfg.AccessToken,
		ZaiAPIKey:      cfg.ZaiAPIKey,
		BasetenAPIKey:  cfg.BasetenAPIKey,
		OpenCodeAPIKey: cfg.OpenCodeAPIKey,
		LoomURL:        cfg.LoomURL,
		LoomToken:      cfg.LoomToken,
		SocketDir:      cfg.SocketDir,
	}, log)
	if !cfg.DevBypass && cfg.HostToken == "" {
		// Boot is allowed (auth surfaces still work), but every guest
		// keep-awake heartbeat will 401: workspaces idle-stop under live
		// turns and jobs. Say so loudly instead of failing silently later.
		log.Warn("NERO_HOST_TOKEN is empty: guest heartbeats will be rejected and workspaces will not stay awake")
	}
	ll := landlord.New(rt, landlord.RealClock{}, log)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := ll.Restore(ctx); err != nil {
		log.Error("restore", "err", err)
		os.Exit(1)
	}

	go func() {
		t := time.NewTicker(cfg.IdleTick)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				ll.ReconcileIdle(ctx)
			}
		}
	}()

	srv := &http.Server{
		Addr:              cfg.Listen,
		Handler:           api.New(cfg, ll, auth.NewAPI(cfg.WorkOSAPIKey, cfg.WorkOSClientID), log).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()

	log.Info("nero-host listening",
		"addr", cfg.Listen,
		"dev_bypass", cfg.DevBypass,
		"image", cfg.GuestImage,
		"pool", cfg.ZFSPool,
	)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
}
