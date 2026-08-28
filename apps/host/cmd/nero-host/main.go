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
	"nero-host/internal/config"
	"nero-host/internal/landlord"
	"nero-host/internal/runtime"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	cfg := config.FromEnv()

	rt := runtime.NewDocker(cfg.GuestImage, cfg.ZFSPool, cfg.MountRoot)
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
		Handler:           api.New(cfg, ll, log).Handler(),
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
