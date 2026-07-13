# cv-tui-go

Terminal UI for the CV management system, built with [Bubbletea](https://github.com/charmbracelet/bubbletea). Connects to [cv-api](https://github.com/jsoyer/cv-api) for all backend operations — the TUI never touches the filesystem or Makefile directly.

<!-- TODO: add screenshot -->

## Architecture

```
+------------------+     HTTP / WebSocket     +------------------+     Make      +------------------+
|   cv-tui-go      | -----------------------> |     cv-api       | ------------> |       CV         |
|  (this repo)     |                          |  (Go HTTP server)|               | (YAML + Makefile)|
|  Bubbletea TUI   |                          |  :3001           |               |  Python scripts  |
+------------------+                          +------------------+               +------------------+
        |
        | shared config (~/.config/cv/config.toml)
        |
+------------------+
|   cv-tui-rs      |
|  (Ratatui TUI)   |
+------------------+

+------------------+     HTTP / REST          +------------------+
|   cv-web         | -----------------------> |     cv-api       |
|  (Next.js)       |                          |                  |
+------------------+                          +------------------+
```

Data flow: the TUI sends HTTP requests (GET/POST) and opens WebSocket connections to cv-api. cv-api translates these into Make target invocations against the CV project. Real-time output is streamed back over WebSocket.

## Features

| Feature | Description |
|---------|-------------|
| Dashboard | Application count, pipeline breakdown, and recent activity |
| Applications list | Filterable, scrollable list of all applications with status badges |
| Application detail | Full metadata, associated files, quick actions, and notes |
| Kanban board | Five-column board (Applied / Interview / Offer / Rejected / Ghosted) with keyboard card navigation |
| Action runner | Three-phase flow: select target, enter arguments, stream output via WebSocket |
| Audit view | Resume quality scoring, metrics analysis, and duplicate phrase detection |
| Pipeline stats | Horizontal funnel chart and monthly activity bar chart |
| Real-time streaming | WebSocket-based action output with live progress updates |
| Quick actions | Inline controls: tailor (t), review (v), build (b), score (s), prep (p), batch themes (B), notes (N) |
| Application notes | Per-application markdown notes stored locally |
| Theme picker | Switch themes without restarting (Catppuccin Mocha/Latte, Dracula, Nord, Solarized) |
| New app form | Create applications directly from the TUI |
| Vim-style navigation | `j`/`k`, `g`/`G`, `/` filter, `h`/`l` for column navigation |
| Security hardening | X-API-Key header auth, TLS 1.2+ enforcement, response size limits, config file permission warnings |
| Shared config | `~/.config/cv/config.toml` is read by both cv-tui-go and cv-tui-rs |

## Installation

### Homebrew (recommended for macOS / Linux)

```bash
brew install jsoyer/tap/cv
```

### go install

```bash
go install github.com/jsoyer/cv-tui-go/cmd/cv@latest
```

### Binary releases

Download pre-built binaries for Linux (amd64/arm64) and macOS (amd64/arm64) from the [GitHub Releases](https://github.com/jsoyer/cv-tui-go/releases) page.

See [docs/installation.md](docs/installation.md) for the full platform matrix and verification steps.

## Quick start

**Prerequisites:** Go 1.24+ (or a downloaded binary), and cv-api running and reachable.

```bash
# 1. Create the config directory
mkdir -p ~/.config/cv

# 2. Copy the example config
cp config.example.toml ~/.config/cv/config.toml

# 3. Set your API key and URL
$EDITOR ~/.config/cv/config.toml

# 4. Secure the config file
chmod 600 ~/.config/cv/config.toml

# 5. Verify the API is reachable
cv health

# 6. Launch
cv
```

## Configuration

The config file lives at `~/.config/cv/config.toml` and is shared with cv-tui-rs. For security, ensure the file has permissions `600` (readable only by the owner).

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key-here"
timeout  = "30s"

[ui]
theme       = "catppuccin-mocha"  # catppuccin-mocha | catppuccin-latte | dracula | nord | solarized-dark | solarized-light
date_format = "2006-01-02"        # Go time layout
```

Environment variable overrides and CLI flags are also supported. See [docs/config.md](docs/config.md) for the full reference including precedence rules.

### Security notes

- Configuration file should be readable only by the owner (`chmod 600 ~/.config/cv/config.toml`). cv warns at startup if the file is world-readable.
- API credentials are sent via the `X-API-Key` header (secure header, not query parameter) for HTTP requests.
- WebSocket connections enforce TLS 1.2 or higher when using secure endpoints.
- Using plain `http://` for remote hosts will trigger a security warning at startup.

## Keybindings

### Global

| Key | Action |
|-----|--------|
| `1` – `6` | Switch to view: Dashboard / Applications / Kanban / Actions / Stats / Audit |
| `Tab` | Cycle to the next view |
| `q` | Quit |
| `Ctrl+C` | Force quit |
| `?` | Toggle help overlay |
| `Esc` | Go back / cancel / close modal |

### Navigation (all views)

| Key | Action |
|-----|--------|
| `j` / `Down` | Move down |
| `k` / `Up` | Move up |
| `h` / `Left` | Move left (Kanban columns) |
| `l` / `Right` | Move right (Kanban columns) |
| `g` | Jump to top |
| `G` | Jump to bottom |
| `Enter` | Select / open |
| `/` | Start filter |
| `R` | Refresh data |

### Applications list

| Key | Action |
|-----|--------|
| `n` | New application (opens form modal) |
| `d` | Delete application (with confirmation) |
| `/` | Filter by company, position, or name |

### Application detail

| Key | Action |
|-----|--------|
| `t` | Tailor: generate CV with custom theme |
| `v` | Review: open action runner with review target |
| `b` | Build: generate application artifacts |
| `s` | Score: run ATS scoring |
| `p` | Prep: run interview prep |
| `B` | Batch: apply all themes and generate CVs |
| `N` | Notes: open notes editor for this application |
| `r` | Run: open action runner pre-filled with this application |
| `R` | Refresh detail |
| `Esc` / `q` | Back to list |

### Action runner

| Key | Action |
|-----|--------|
| `Enter` | Select target / confirm arguments / run |
| `Esc` | Cancel / go back one phase |
| `r` | Re-run the last action (after completion) |

### Audit view

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate applications |
| `Enter` | Audit selected application |
| `r` | Re-run audit (after completion) |
| `Esc` | Back to application list |

### Modals (forms and dialogs)

| Key | Action |
|-----|--------|
| `Tab` | Move to next field (New App form) |
| `Shift+Tab` | Move to previous field (New App form) |
| `Ctrl+S` | Save (Notes form) |
| `Esc` | Cancel / close modal |
| `Enter` | Submit (in forms) |

See [docs/keybindings.md](docs/keybindings.md) for the complete per-view reference.

## Views

| # | View | Description |
|---|------|-------------|
| 1 | Dashboard | Total count, per-status bar chart, 8 most recent applications |
| 2 | Applications | Scrollable table with date, status, company, position; inline `/` filter; quick actions in detail view |
| 3 | Kanban | Five-column board grouped by status; card navigation with `h`/`j`/`k`/`l` |
| 4 | Actions | Select a Make target, provide arguments, stream output via WebSocket |
| 5 | Stats | Horizontal funnel chart (percentage breakdown) and monthly activity chart |
| 6 | Audit | Resume quality scoring and metrics analysis for a selected application |

See [docs/views.md](docs/views.md) for a detailed description of each view.

## Development

**Prerequisites:** Go 1.24+, `golangci-lint`, `gofumpt`, `goreleaser`, and cv-api running on `localhost:3001`.

```bash
make run       # run from source
make build     # build ./cv binary
make test      # run tests with -race
make lint      # golangci-lint
make fmt       # gofumpt format
make deps      # go mod tidy + verify
make snapshot  # GoReleaser snapshot (local test)
make release   # GoReleaser release (requires GITHUB_TOKEN)
```

### Project structure

```
cv-tui-go/
├── cmd/cv/            # main package — flag parsing, wiring
├── internal/
│   ├── api/           # HTTP + WebSocket client for cv-api
│   │   ├── client.go  # base HTTP client, auth, error decoding
│   │   ├── models.go  # shared domain types (Application, Target, …)
│   │   ├── applications.go
│   │   └── actions.go
│   ├── config/        # TOML loader, env overrides, defaults
│   └── ui/
│       ├── app.go     # root Bubbletea model, tab bar, view routing
│       ├── common/    # shared styles (Catppuccin), keybindings, helpers
│       ├── dashboard/ # view 1
│       ├── apps/      # views 2 + detail (list.go, detail.go)
│       ├── kanban/    # view 3
│       ├── actions/   # view 4 — runner.go, WebSocket streaming
│       └── stats/     # view 5
├── docs/              # extended documentation
├── config.example.toml
├── .goreleaser.yml
└── Makefile
```

See [docs/architecture.md](docs/architecture.md) for the TEA message flow and API client design.

## Related repositories

| Repository | Description |
|------------|-------------|
| [cv-api](https://github.com/jsoyer/cv-api) | Go HTTP/WebSocket API server |
| [cv-tui-rs](https://github.com/jsoyer/cv-tui-rs) | Ratatui terminal UI (Rust alternative) |
| [cv-web](https://github.com/jsoyer/cv-manager) | Next.js web frontend |
| [CV](https://github.com/jsoyer/CV) | Core project — YAML data, Makefile, Python scripts |

## License

MIT
