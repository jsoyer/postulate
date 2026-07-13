// Package config loads TUI configuration from TOML files and environment.
//
// Config file: ~/.config/cv/config.toml (shared with cv-tui-rs)
// Precedence: CLI flags > env vars > config file > defaults
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
)

// Config holds all TUI configuration.
type Config struct {
	API APIConfig `toml:"api"`
	UI  UIConfig  `toml:"ui"`
}

// APIConfig holds the cv-api connection settings.
type APIConfig struct {
	BaseURL  string `toml:"base_url"`
	APIKey   string `toml:"api_key"`
	Timeout  string `toml:"timeout"`
	Insecure bool   `toml:"insecure"` // allow http:// for non-localhost hosts
}

// TimeoutDuration parses the timeout string into a Duration.
func (a APIConfig) TimeoutDuration() time.Duration {
	if d, err := time.ParseDuration(a.Timeout); err == nil {
		return d
	}
	return 30 * time.Second
}

// UIConfig holds UI preferences.
type UIConfig struct {
	Theme      string `toml:"theme"`
	DateFormat string `toml:"date_format"`
}

// DefaultPath returns ~/.config/cv/config.toml.
func DefaultPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "cv", "config.toml")
}

// Load reads configuration from the given TOML file, then applies
// environment variable overrides.
func Load(path string) (*Config, error) {
	cfg := &Config{
		API: APIConfig{
			BaseURL: "http://localhost:3001",
			Timeout: "30s",
		},
		UI: UIConfig{
			Theme:      "catppuccin-mocha",
			DateFormat: "2006-01-02",
		},
	}

	if info, err := os.Stat(path); err == nil {
		if mode := info.Mode().Perm(); mode&0o077 != 0 {
			fmt.Fprintf(os.Stderr, "warning: config file %s is readable by others (mode %04o); consider: chmod 600 %s\n", path, mode, path)
		}
		if _, err := toml.DecodeFile(path, cfg); err != nil {
			return nil, fmt.Errorf("parse config: %w", err)
		}
	}

	// Environment variable overrides
	if v := os.Getenv("CV_API_URL"); v != "" {
		cfg.API.BaseURL = v
	}
	if v := os.Getenv("CV_API_KEY"); v != "" {
		cfg.API.APIKey = v
	}

	if cfg.API.BaseURL == "" {
		return nil, fmt.Errorf("api.base_url is required")
	}
	if cfg.API.APIKey == "" {
		return nil, fmt.Errorf("api.api_key is required (set in config or CV_API_KEY env var)")
	}

	if u, err := url.Parse(cfg.API.BaseURL); err == nil {
		host := strings.ToLower(u.Hostname())
		isLocal := host == "localhost" || host == "127.0.0.1" || host == "::1"
		if u.Scheme == "http" && !isLocal {
			if cfg.API.Insecure {
				fmt.Fprintf(os.Stderr, "warning: insecure http:// connection to remote host (insecure=true)\n")
			} else {
				return nil, fmt.Errorf("api.base_url uses http:// for a remote host; set api.insecure = true to allow this (credentials will be sent in clear text)")
			}
		}
	}

	return cfg, nil
}
