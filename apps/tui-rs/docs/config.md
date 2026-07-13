# Configuration

## Config file

The TUI reads its configuration from `~/.config/cv/config.toml`. This file is shared with cv-tui-go so the API connection only needs to be configured once.

### Creating the config

```bash
mkdir -p ~/.config/cv
cp config.example.toml ~/.config/cv/config.toml
# Edit with your API key and server URL
```

### Full reference

```toml
[api]
# cv-api server URL (required)
base_url = "http://localhost:3001"

# API key for authentication (required)
# Generate with: openssl rand -base64 32
api_key = "kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="

# Request timeout in seconds (default: 30)
timeout_secs = 30

[ui]
# Color theme (default: catppuccin-mocha)
# Options: catppuccin-mocha, dracula, nord
theme = "catppuccin-mocha"
```

## CLI flags

| Flag | Description | Default |
|------|-------------|---------|
| `--config` | Config file path | `~/.config/cv/config.toml` |
| `--version` | Print version and exit | -- |
| `--api-url` | Override API base URL | from config |
| `--api-key` | Override API key | from config |

CLI flags take precedence over config file values.

## Environment variables

Environment variables override the config file values. Useful for temporary testing or CI/CD environments.

| Variable | Description | Example |
|----------|-------------|---------|
| `CV_API_URL` | Override API base URL | `http://localhost:3001` |
| `CV_API_KEY` | Override API key | `my-secret-key` |
| `CV_TIMEOUT` | Override timeout in seconds | `60` |

### Usage examples

```bash
# Use custom API endpoint
CV_API_URL=http://staging.api.local CV_API_KEY=staging-key cv-rs

# Increase timeout for slow networks
CV_TIMEOUT=120 cv-rs

# Override just the key
CV_API_KEY=different-key cv-rs
```

Precedence: CLI flags > environment variables > config file.
