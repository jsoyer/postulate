# cv-tui-rs

High-performance terminal UI for the CV management system, built with [Ratatui](https://ratatui.rs/). Connects to [cv-api](https://github.com/jsoyer/cv-api) for all backend operations.

## Features

- Dashboard with application stats and recent activity
- Applications list with filtering and sorting
- Kanban board (Applied / Interview / Offer / Rejected / Ghosted)
- Action runner with real-time streaming output (WebSocket)
- Pipeline funnel visualization
- Quick-launch actions from detail view (Tailor, Review, Build, ATS Score, Prep, Audit)
- CV health audit with metrics and analysis
- Create new applications inline with dialog form
- TTL response caching (60s apps/dashboard/stats, 300s targets)
- Exponential backoff retry logic (3 attempts)
- Environment variable configuration overrides
- Vim-style keybindings throughout
- Catppuccin Mocha theme (with Dracula and Nord alternatives)
- Tiny binary (~5 MB), instant startup

## Installation

```bash
# Cargo install
cargo install --git https://github.com/jsoyer/cv-tui-rs.git

# From source
git clone https://github.com/jsoyer/cv-tui-rs.git
cd cv-tui-rs && make build
```

See [docs/installation.md](docs/installation.md) for more options.

## Configuration

```bash
mkdir -p ~/.config/cv
cp config.example.toml ~/.config/cv/config.toml
```

Edit `~/.config/cv/config.toml`:

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key-here"

[ui]
theme = "catppuccin-mocha"
```

This config file is shared with [cv-tui-go](https://github.com/jsoyer/cv-tui-go).

Configuration can be overridden with environment variables:

```bash
CV_API_URL=http://custom.server:3001 CV_API_KEY=custom-key CV_TIMEOUT=60 cv-rs
```

See [docs/config.md](docs/config.md) for all options.

## Key navigation

| Key | Action |
|-----|--------|
| `1`-`6` | Switch views |
| `j`/`k` | Navigate up/down |
| `h`/`l` | Navigate left/right (kanban) |
| `Enter` | Select/open |
| `/` | Filter |
| `n` | New application |
| `r` | Run action |
| `t` | Tailor (detail view) |
| `v` | Review (detail view) |
| `b` | Build (detail view) |
| `s` | ATS Score (detail view) |
| `p` | Prep interview (detail view) |
| `a` | Audit (detail view) |
| `?` | Help |
| `q` | Quit |

See [docs/keybindings.md](docs/keybindings.md) for the full reference.

## Documentation

- [Quick Start](docs/quickstart.md) - Get up and running in 5 minutes
- [Installation](docs/installation.md) - Detailed installation options
- [Configuration](docs/config.md) - Configure API, theme, and environment
- [Keybindings](docs/keybindings.md) - Complete keyboard reference
- [Features](docs/features.md) - Guide to quick actions, audit, and more
- [API Reference](docs/api.md) - API client, caching, retry logic
- [Architecture](docs/architecture.md) - How cv-tui-rs is built
- [Troubleshooting](docs/troubleshooting.md) - Fix common issues

## Screenshots

<!-- TODO: add screenshots -->

## Architecture

```
cv-api (Go HTTP server)        Backend — executes Make targets
    |
    +--- cv-tui-rs (this repo) TUI client via HTTP/WebSocket
    +--- cv-tui-go             TUI client (Go alternative)
    +--- cv-web                Web frontend (Next.js)
```

The TUI never accesses the filesystem or Makefile directly. All operations go through the cv-api HTTP/WebSocket interface.

## Development

```bash
# Prerequisites: Rust 1.85+, cv-api running on localhost:3001

# Check
make check

# Run
make run

# Build release
make build

# Test
make test

# Lint
make lint
```

## Performance

Compared to cv-tui-go:

| Metric | cv-tui-rs | cv-tui-go |
|--------|-----------|-----------|
| Binary size | ~5 MB | ~15 MB |
| Startup time | <10 ms | ~30 ms |
| Memory (idle) | ~3 MB | ~10 MB |

Both provide the same features and UX. Choose based on your preference.

## Related repositories

| Repo | Description |
|------|-------------|
| [cv-api](https://github.com/jsoyer/cv-api) | Go HTTP API server |
| [cv-tui-go](https://github.com/jsoyer/cv-tui-go) | Bubbletea terminal UI (Go) |
| [cv-web](https://github.com/jsoyer/cv-manager) | Next.js web frontend |
| [CV](https://github.com/jsoyer/CV) | Core project (YAML, Makefile, Python) |
