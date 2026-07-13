package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func writeConfig(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatalf("write temp config: %v", err)
	}
	return path
}

func TestLoadDefaults(t *testing.T) {
	// No file, no env vars → default base_url but no api_key → error.
	t.Setenv("CV_API_URL", "")
	t.Setenv("CV_API_KEY", "")

	nonExistent := filepath.Join(t.TempDir(), "does-not-exist.toml")
	_, err := Load(nonExistent)
	if err == nil {
		t.Fatal("expected error because api_key is required")
	}
}

func TestLoadFromFile(t *testing.T) {
	t.Parallel()

	path := writeConfig(t, `
[api]
base_url = "http://localhost:3001"
api_key  = "my-secret-key"
timeout  = "60s"

[ui]
theme = "dracula"
date_format = "01/02/2006"
`)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.API.BaseURL != "http://localhost:3001" {
		t.Errorf("base_url: got %q", cfg.API.BaseURL)
	}
	if cfg.API.APIKey != "my-secret-key" {
		t.Errorf("api_key: got %q", cfg.API.APIKey)
	}
	if cfg.API.TimeoutDuration() != 60*time.Second {
		t.Errorf("timeout: got %v", cfg.API.TimeoutDuration())
	}
	if cfg.UI.Theme != "dracula" {
		t.Errorf("theme: got %q", cfg.UI.Theme)
	}
}

func TestLoadEnvOverride(t *testing.T) {
	// Write a file with one URL, then override with env.
	path := writeConfig(t, `
[api]
base_url = "http://file-url:3001"
api_key  = "file-key"
`)

	t.Setenv("CV_API_URL", "http://localhost:9999")
	t.Setenv("CV_API_KEY", "env-key")

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.API.BaseURL != "http://localhost:9999" {
		t.Errorf("expected env URL override, got %q", cfg.API.BaseURL)
	}
	if cfg.API.APIKey != "env-key" {
		t.Errorf("expected env key override, got %q", cfg.API.APIKey)
	}
}

func TestLoadMissingAPIKey(t *testing.T) {
	t.Parallel()

	path := writeConfig(t, `
[api]
base_url = "http://localhost:3001"
`)

	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for missing api_key")
	}
}

func TestLoadTimeout_DefaultFallback(t *testing.T) {
	t.Parallel()

	path := writeConfig(t, `
[api]
base_url = "http://localhost:3001"
api_key  = "key"
timeout  = "not-a-duration"
`)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Bad duration should fall back to 30s.
	if cfg.API.TimeoutDuration() != 30*time.Second {
		t.Errorf("expected 30s default, got %v", cfg.API.TimeoutDuration())
	}
}

func TestLoadLocalhostHTTP(t *testing.T) {
	t.Parallel()

	// localhost with plain http must not return an error (no insecure flag needed).
	path := writeConfig(t, `
[api]
base_url = "http://localhost:3001"
api_key  = "key"
`)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("http://localhost should be allowed without insecure flag: %v", err)
	}
	if cfg.API.BaseURL != "http://localhost:3001" {
		t.Errorf("unexpected base_url: %q", cfg.API.BaseURL)
	}
}

func TestLoadUIDefaults(t *testing.T) {
	t.Parallel()

	// File only sets api section; UI should receive defaults.
	path := writeConfig(t, `
[api]
base_url = "http://localhost:3001"
api_key  = "key"
`)

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.UI.Theme != "catppuccin-mocha" {
		t.Errorf("expected default theme catppuccin-mocha, got %q", cfg.UI.Theme)
	}
	if cfg.UI.DateFormat != "2006-01-02" {
		t.Errorf("expected default date_format 2006-01-02, got %q", cfg.UI.DateFormat)
	}
}

func TestDefaultPath(t *testing.T) {
	t.Parallel()

	p := DefaultPath()
	if p == "" {
		t.Fatal("DefaultPath returned empty string")
	}
	if filepath.Base(p) != "config.toml" {
		t.Errorf("expected path to end with config.toml, got %q", p)
	}
}

// TestLoadInsecureFlag verifies that a remote http:// URL is rejected unless
// insecure = true is set.
func TestLoadInsecureFlag(t *testing.T) {
	t.Parallel()

	// Without insecure flag → error for remote HTTP.
	path := writeConfig(t, `
[api]
base_url = "http://remote-host.example.com:3001"
api_key  = "key"
`)
	_, err := Load(path)
	if err == nil {
		t.Fatal("expected error for remote http:// without insecure flag")
	}

	// With insecure = true → success (only a warning printed to stderr).
	path2 := writeConfig(t, `
[api]
base_url  = "http://remote-host.example.com:3001"
api_key   = "key"
insecure  = true
`)
	cfg, err := Load(path2)
	if err != nil {
		t.Fatalf("expected success with insecure=true, got: %v", err)
	}
	if !cfg.API.Insecure {
		t.Error("expected Insecure field to be true")
	}
}
