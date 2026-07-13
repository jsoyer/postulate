// Package config handles application configuration from environment variables
// and YAML files. All sensitive values come from environment variables; the
// target allowlist is loaded from a YAML file on disk.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jsoyer/cv-api/internal/cvutil"
	"github.com/jsoyer/cv-api/internal/models"
)

// Config holds all application configuration.
type Config struct {
	// Server
	Port string

	// CV project path (required — storage reads/writes CV project files directly)
	CVPath string

	// Auth
	AuthSecret    string
	AuthUsername  string
	AuthPassword  string
	TOTPSecret    string
	APIKeys       []string
	ViewerAPIKeys []string
	JWTExpiry     time.Duration
	CookieDomain  string
	CookieSecure  bool

	// CORS
	AllowedOrigins []string

	// cv-runner delegation
	RunnerURL    string // e.g. http://cv-runner:3002
	RunnerSecret string // shared secret; sent as X-Runner-Secret

	// Execution limits
	MaxConcurrent  int
	DefaultTimeout time.Duration
	MaxTimeout     time.Duration

	// Target allowlist
	Targets []models.Target
}

// Load reads configuration from environment variables and the targets YAML file.
// It validates that all required values are present before returning.
func Load() (*Config, error) {
	cfg := &Config{
		Port:         envOr("PORT", "3001"),
		CVPath:       os.Getenv("CV_PATH"),
		AuthSecret:   os.Getenv("AUTH_SECRET"),
		AuthUsername: envOr("AUTH_USERNAME", "admin"),
		AuthPassword: os.Getenv("AUTH_PASSWORD"),
		TOTPSecret:   os.Getenv("AUTH_TOTP_SECRET"),
		CookieDomain: envOr("COOKIE_DOMAIN", "localhost"),
		CookieSecure: envOr("COOKIE_SECURE", "false") == "true",
		JWTExpiry:    7 * 24 * time.Hour,
		RunnerURL:      envOr("RUNNER_URL", "http://cv-runner:3002"),
		RunnerSecret:   os.Getenv("RUNNER_SECRET"),
		MaxConcurrent:  envInt("MAX_CONCURRENT", 3),
		DefaultTimeout: envDuration("DEFAULT_TIMEOUT", 5*time.Minute),
		MaxTimeout:     envDuration("MAX_TIMEOUT", 30*time.Minute),
	}

	if keys := os.Getenv("API_KEYS"); keys != "" {
		for _, k := range strings.Split(keys, ",") {
			if trimmed := strings.TrimSpace(k); trimmed != "" {
				cfg.APIKeys = append(cfg.APIKeys, trimmed)
			}
		}
	}

	if keys := os.Getenv("VIEWER_API_KEYS"); keys != "" {
		for _, k := range strings.Split(keys, ",") {
			if trimmed := strings.TrimSpace(k); trimmed != "" {
				cfg.ViewerAPIKeys = append(cfg.ViewerAPIKeys, trimmed)
			}
		}
	}

	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		for _, o := range strings.Split(origins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				cfg.AllowedOrigins = append(cfg.AllowedOrigins, trimmed)
			}
		}
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation: %w", err)
	}

	targetsFile := envOr("TARGETS_FILE", "config/targets.yml")
	targets, err := cvutil.LoadTargets(targetsFile)
	if err != nil {
		return nil, fmt.Errorf("load targets from %s: %w", targetsFile, err)
	}
	cfg.Targets = targets

	return cfg, nil
}

func (c *Config) validate() error {
	if c.CVPath == "" {
		return fmt.Errorf("CV_PATH is required")
	}
	info, err := os.Stat(c.CVPath)
	if err != nil {
		return fmt.Errorf("CV_PATH %q: %w", c.CVPath, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("CV_PATH %q is not a directory", c.CVPath)
	}
	if c.AuthSecret == "" {
		return fmt.Errorf("AUTH_SECRET is required (min 32 chars)")
	}
	if len(c.AuthSecret) < 32 {
		return fmt.Errorf("AUTH_SECRET must be at least 32 characters")
	}
	if c.AuthPassword == "" {
		return fmt.Errorf("AUTH_PASSWORD is required")
	}
	if c.RunnerSecret == "" {
		return fmt.Errorf("RUNNER_SECRET is required (min 32 chars)")
	}
	if len(c.RunnerSecret) < 32 {
		return fmt.Errorf("RUNNER_SECRET must be at least 32 characters")
	}
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil && d > 0 {
			return d
		}
	}
	return fallback
}
