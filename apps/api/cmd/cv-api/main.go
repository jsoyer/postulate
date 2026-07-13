// cv-api is the HTTP/WebSocket API server for the CV management system.
//
// It wraps Make targets from the CV project with a secure REST API,
// providing authentication, rate limiting, and streaming output.
//
// Usage:
//
//	CV_PATH=/path/to/CV AUTH_SECRET=... AUTH_PASSWORD=... cv-api
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/config"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/handlers"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/storage"
)

func main() {
	// Structured logging to stdout
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	slog.Info("configuration loaded",
		"cv_path", cfg.CVPath,
		"port", cfg.Port,
		"targets", len(cfg.Targets),
		"max_concurrent", cfg.MaxConcurrent,
		"api_keys", len(cfg.APIKeys),
	)

	authProvider := auth.NewProvider(
		cfg.AuthSecret,
		cfg.AuthUsername,
		cfg.AuthPassword,
		cfg.TOTPSecret,
		cfg.APIKeys,
		cfg.ViewerAPIKeys,
		cfg.JWTExpiry,
	)

	store := storage.New(cfg.CVPath)

	reg := metrics.New()

	exec := executor.New(
		cfg.CVPath,
		cfg.Targets,
		cfg.MaxConcurrent,
		cfg.DefaultTimeout,
		cfg.MaxTimeout,
	)
	exec.WithMetrics(reg)

	auditLog := audit.New()

	// Expensive targets are configurable via EXPENSIVE_TARGETS env var (comma-separated).
	var expensiveTargets []string
	if et := os.Getenv("EXPENSIVE_TARGETS"); et != "" {
		for _, t := range strings.Split(et, ",") {
			if trimmed := strings.TrimSpace(t); trimmed != "" {
				expensiveTargets = append(expensiveTargets, trimmed)
			}
		}
	}

	router := handlers.NewRouter(handlers.RouterConfig{
		AuthProvider:     authProvider,
		Executor:         exec,
		Storage:          store,
		Audit:            auditLog,
		Metrics:          reg,
		AllowedOrigins:   cfg.AllowedOrigins,
		CookieDomain:     cfg.CookieDomain,
		CookieSecure:     cfg.CookieSecure,
		CVPath:           cfg.CVPath,
		Targets:          cfg.Targets,
		ExpensiveTargets: expensiveTargets,
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Minute, // long for streaming responses
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16, // 64 KB
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("cv-api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
