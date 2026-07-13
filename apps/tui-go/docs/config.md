# Configuration reference

## Security warnings

cv performs these checks at startup:

1. **Config file permissions:** If `~/.config/cv/config.toml` has world-readable permissions, a warning is printed.
2. **HTTP over non-localhost:** If `api.base_url` uses plain `http://` for a remote host (not localhost, 127.0.0.1, or ::1), a warning is printed because credentials would be sent in plaintext.

Example warning output:

```
warning: config file ~/.config/cv/config.toml is readable by others (mode 0644); consider: chmod 600 ~/.config/cv/config.toml
warning: api.base_url uses http:// for a remote host; credentials will be sent in clear text
```

These are warnings, not errors. The application will still start, but you should address these issues in a production environment.

## Config file location

```
~/.config/cv/config.toml
```

This file is shared between cv-tui-go and cv-tui-rs. Configuring the API connection once is sufficient for both clients.

### Security

For security, the config file should be readable only by the owner:

```bash
chmod 600 ~/.config/cv/config.toml
```

If the file is readable by others (mode `& 0o077 != 0`), cv will print a warning at startup:

```
warning: config file ~/.config/cv/config.toml is readable by others (mode 0644); consider: chmod 600 ~/.config/cv/config.toml
```

If the file does not exist at startup, built-in defaults are used where possible. `api.base_url` and `api.api_key` are required — the process exits with an error if either is missing after applying all overrides.

## Creating the config

```bash
mkdir -p ~/.config/cv
cp /path/to/cv-tui-go/config.example.toml ~/.config/cv/config.toml
$EDITOR ~/.config/cv/config.toml
```

## Full field reference

```toml
[api]
# URL of the cv-api server.
# Required. No trailing slash.
# Default: "http://localhost:3001"
base_url = "http://localhost:3001"

# API key sent in the X-API-Key header for HTTP requests,
# and as the `token` query parameter for WebSocket connections.
# Required.
# Generate a key with: openssl rand -base64 32
api_key = "kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="

# HTTP request timeout (Go duration string).
# Applied to all HTTP calls. WebSocket connections are not affected.
# Default: "30s"
timeout = "30s"

[ui]
# Colour theme for all views.
# Accepted values: catppuccin-mocha | dracula | nord
# Default: "catppuccin-mocha"
theme = "catppuccin-mocha"

# Date display format using Go's reference time layout.
# Reference: Mon Jan 2 15:04:05 MST 2006
# Default: "2006-01-02"
date_format = "2006-01-02"
```

## Environment variable overrides

Environment variables are applied after the config file is parsed and before validation.

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `CV_API_URL` | `api.base_url` | cv-api server URL |
| `CV_API_KEY` | `api.api_key` | API key |

Example:

```bash
CV_API_URL=https://cv.example.com CV_API_KEY=mysecret cv
```

## CLI flags

CLI flags are applied last and take the highest precedence.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--config` | string | `~/.config/cv/config.toml` | Path to the config file |
| `--version` | bool | — | Print version string and exit |
| `--health` or `health` (subcommand) | bool | — | Check API health and exit |
| `-v` or `--verbose` | bool | — | Enable verbose logging (prints config path and API URL to stderr) |

Examples:

```bash
# Check API health without launching the TUI
cv health
cv --health

# Launch with verbose output
cv --verbose
cv -v

# Use a custom config file
cv --config /path/to/config.toml

# Show version
cv --version
```

Note: `--api-url` and `--api-key` flags are not yet implemented. Use environment variables (`CV_API_URL`, `CV_API_KEY`) to override those fields at runtime.

## Precedence rules

```
CLI flags  >  environment variables  >  config file  >  built-in defaults
```

## Field types and formats

### Duration strings (`timeout`)

Go duration format. Examples: `"10s"`, `"1m30s"`, `"2m"`. Invalid values fall back to `30s`.

### Date format (`date_format`)

Uses Go's time layout. The reference time is `Mon Jan 2 15:04:05 MST 2006`. Common formats:

| Format string | Example output |
|---------------|----------------|
| `"2006-01-02"` | `2025-03-08` |
| `"02/01/2006"` | `08/03/2025` |
| `"Jan 2, 2006"` | `Mar 8, 2025` |

### Theme values

| Value | Description |
|-------|-------------|
| `catppuccin-mocha` | Dark, pastel palette (default) |
| `catppuccin-latte` | Light, pastel palette |
| `dracula` | Dark purple/pink palette |
| `nord` | Arctic, blue-toned palette |
| `solarized-dark` | Dark, warm palette |
| `solarized-light` | Light, warm palette |

Themes can also be selected at runtime using the theme picker modal (accessed via the theme setter in Application Detail or batch operations).

## Minimal working config

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key-here"
```

All other fields fall back to defaults.
