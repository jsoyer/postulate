// cv-runner is the execution backend for the CV management system.
//
// It receives job requests from cv-api over the internal Docker network
// and executes Make targets against the CV project directory. It is not
// exposed to external clients — only cv-api may communicate with it via
// the shared RUNNER_SECRET header.
//
// Usage:
//
//	RUNNER_SECRET=... CV_PATH=/cv cv-runner
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/jsoyer/cv-api/internal/runner"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := loadConfig()
	if err != nil {
		slog.Error("failed to load configuration", "error", err)
		os.Exit(1)
	}

	slog.Info("cv-runner starting",
		"port", cfg.port,
		"cv_path", cfg.cvPath,
		"max_concurrent", cfg.maxConcurrent,
		"targets_file", cfg.targetsFile,
	)

	store, err := runner.NewJobStore(runner.JobStoreConfig{
		CVPath:        cfg.cvPath,
		MaxConcurrent: cfg.maxConcurrent,
		TargetsFile:   cfg.targetsFile,
	})
	if err != nil {
		slog.Error("failed to create job store", "error", err)
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           runner.Router(cfg.secret, store),
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Minute, // long for SSE streaming responses
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16, // 64 KB
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		slog.Info("cv-runner listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}

	slog.Info("cv-runner stopped")
}

type config struct {
	port          string
	secret        string
	cvPath        string
	maxConcurrent int
	targetsFile   string
}

func loadConfig() (*config, error) {
	cfg := &config{
		port:          envOr("RUNNER_PORT", "3002"),
		secret:        os.Getenv("RUNNER_SECRET"),
		cvPath:        os.Getenv("CV_PATH"),
		maxConcurrent: envInt("MAX_CONCURRENT", 3),
		targetsFile:   envOr("TARGETS_FILE", "config/targets.yml"),
	}

	if cfg.secret == "" {
		return nil, fmt.Errorf("RUNNER_SECRET is required")
	}
	if len(cfg.secret) < 32 {
		return nil, fmt.Errorf("RUNNER_SECRET must be at least 32 characters")
	}
	if cfg.cvPath == "" {
		return nil, fmt.Errorf("CV_PATH is required")
	}
	info, err := os.Stat(cfg.cvPath)
	if err != nil {
		return nil, fmt.Errorf("CV_PATH %q: %w", cfg.cvPath, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("CV_PATH %q is not a directory", cfg.cvPath)
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
