# cv-tui-rs Documentation

Complete documentation for cv-tui-rs, a high-performance terminal UI for CV management.

## Getting Started

### For New Users
Start here to get up and running:
- **[Quick Start](quickstart.md)** - Get running in 5 minutes (installation, config, basic usage)
- **[Installation](installation.md)** - Detailed installation methods (Cargo, binary, source)
- **[Configuration](config.md)** - Set up API connection, theme, and environment variables

### First Steps
1. Install cv-tui-rs ([Installation guide](installation.md))
2. Configure API connection ([Configuration guide](config.md))
3. Learn keyboard shortcuts ([Quick Start](quickstart.md))
4. Explore features ([Features guide](features.md))

## Using cv-tui-rs

### Key References
- **[Keybindings](keybindings.md)** - Complete keyboard reference for all views
- **[Features Guide](features.md)** - In-depth guide to each feature:
  - Quick-launch actions (Tailor, Review, Build, Score, Prep, Audit)
  - CV health audit with scoring
  - Create application dialog
  - Real-time caching and retry logic
  - Environment-based configuration
  - WebSocket streaming

### Common Workflows
See [Features Guide](features.md) for detailed workflows:
- Running actions from detail view
- Analyzing CV health with audit
- Creating and tracking new applications
- Optimizing performance with caching

## Understanding cv-tui-rs

### Developer Resources
- **[Architecture](architecture.md)** - How cv-tui-rs is built:
  - Event loop and async patterns
  - Module structure and responsibilities
  - Cache design and TTL values
  - Retry and backoff strategy
  - Adding new features

- **[API Reference](api.md)** - HTTP/WebSocket API client documentation:
  - All 9 API endpoints
  - Response caching details
  - Retry logic and backoff
  - WebSocket streaming
  - Error handling
  - Security and authentication

### Troubleshooting
- **[Troubleshooting Guide](troubleshooting.md)** - Solutions to common problems:
  - Connection refused
  - Unauthorized errors
  - Timeout issues
  - Empty applications list
  - Action runner failures
  - UI glitching
  - Performance problems
  - Advanced debugging

## Quick Navigation

### Views
1. **Dashboard** (`1`) - Overview of application pipeline
2. **Applications** (`2`) - List of all CV applications
3. **Kanban** (`3`) - Pipeline visualization (Applied → Offer → Rejected)
4. **Actions** (`4`) - Run and monitor Make targets
5. **Stats** (`5`) - Detailed statistics and analytics

### Detail View Actions
From any application detail view:
- `t` - Tailor CV for this job
- `v` - Review CV feedback
- `b` - Build artifacts (PDF, HTML)
- `s` - Score against job (ATS)
- `p` - Prep for interview
- `a` - Audit CV health

### Global Keys
- `n` - New application (dialog)
- `/` - Filter/search
- `?` - Help overlay
- `q` - Quit
- `Esc` - Back/cancel

## Features

### Quick-Launch Actions
From the detail view, press any of these keys to execute actions:

| Key | Action | Purpose |
|-----|--------|---------|
| `t` | Tailor | Customize CV for this job |
| `v` | Review | Get feedback on CV |
| `b` | Build | Generate CV artifacts |
| `s` | Score | Rate against job (ATS) |
| `p` | Prep | Generate interview notes |
| `a` | Audit | Run health audit |

### CV Health Audit
Run comprehensive audit on your CV with scoring across:
- Quantification (use of metrics)
- Action verbs (variety and strength)
- Repetition (overused words)
- Completeness (all sections present)
- Duplicates (near-duplicate bullets)

Score: 0-100, with metrics for each dimension.

### Create Application Dialog
Press `n` to quickly add new applications:
- Company name (required)
- Job title (required)
- Job URL (optional)

Fields automatically saved to cv-api.

### Responsive Caching
Automatic TTL cache reduces API calls:
- Applications: 60s
- Dashboard: 60s
- Stats: 60s
- Targets: 300s

Manual refresh with `R` key.

### Environment Configuration
Override settings without editing config files:

```bash
CV_API_URL=http://staging.api.local \
CV_API_KEY=staging-key \
CV_TIMEOUT=120 \
cv-rs
```

Useful for staging/production switching, CI/CD, and debugging.

## Configuration

### Config File
Location: `~/.config/cv/config.toml`

```toml
[api]
base_url = "http://localhost:3001"
api_key = "your-api-key-here"
timeout_secs = 30

[ui]
theme = "catppuccin-mocha"
```

Shared with cv-tui-go for consistent experience.

### Themes
Available themes:
- `catppuccin-mocha` (default)
- `dracula`
- `nord`

Edit `~/.config/cv/config.toml` to change.

### Environment Variables
Highest priority for configuration:
- `CV_API_URL` - Override base URL
- `CV_API_KEY` - Override API key
- `CV_TIMEOUT` - Override timeout (seconds)

**Precedence**: CLI flags > environment variables > config file > defaults

## API Client Features

### TTL Caching
Responses cached with automatic expiration:
- Reduces network calls by 95%
- Transparent to user
- Manual refresh with `R` key

### Exponential Backoff Retry
Failed requests automatically retried:
- 3 attempts total
- Delays: 500ms, 1s, 2s
- Only retries transient errors
- 4xx errors fail immediately

### WebSocket Streaming
Real-time action output:
- Streams results line-by-line
- Falls back to HTTP polling if needed
- Handles large outputs gracefully
- Cancellable with Ctrl+C

## Performance

Binary size: ~5 MB
Startup time: <10 ms
Memory (idle): ~3 MB

Compared to cv-tui-go:
- 3x smaller binary
- 3x faster startup
- 3x lower memory

Both provide identical features. Choose based on preference.

## Troubleshooting Quick Links

Common issues and solutions:

| Issue | Solution |
|-------|----------|
| "Connection refused" | Check if cv-api is running, verify URL |
| "Unauthorized" | Verify API key in config or env |
| "Request timeout" | Increase CV_TIMEOUT environment variable |
| Empty app list | Check cv-api has applications, clear filter |
| Actions not running | Verify Make targets exist, check logs |
| Keybinding not working | Check you're in correct view, try alternate key |
| UI corruption | Resize terminal, check TERM setting |

See [Troubleshooting Guide](troubleshooting.md) for detailed solutions.

## Architecture Overview

```
Terminal Input
    ↓
Event Loop (crossterm + tokio + mpsc)
    ↓
Action Processing (app state machine)
    ↓
API Client (HTTP/WebSocket with cache + retry)
    ↓
cv-api (Go backend server)
    ↓
Makefile targets (CV, templating, processing)
    ↓
Artifacts (PDF, HTML, scores, audit results)
    ↓
Terminal Output (Ratatui rendering)
```

See [Architecture](architecture.md) for detailed technical information.

## Integration

### With cv-api
cv-tui-rs is a frontend for [cv-api](https://github.com/jsoyer/cv-api):
- All operations go through HTTP/WebSocket
- No filesystem access from TUI
- Makefile execution on cv-api server
- Shared config with other clients

### With cv-tui-go
Alternative TUI implementation in Go:
- Same keybindings for easy switching
- Same config file (shared)
- Same features and UX
- Different performance characteristics

### With cv-web
Web frontend using Next.js:
- Same API backend (cv-api)
- Same Makefile integration
- Different UI paradigm (web vs terminal)

## Ecosystem

| Project | Role | Language |
|---------|------|----------|
| [cv-api](https://github.com/jsoyer/cv-api) | Backend HTTP server | Go |
| [cv-tui-rs](https://github.com/jsoyer/cv-tui-rs) | Terminal UI (this) | Rust |
| [cv-tui-go](https://github.com/jsoyer/cv-tui-go) | Terminal UI alternative | Go |
| [cv-web](https://github.com/jsoyer/cv-manager) | Web frontend | Next.js |
| [CV](https://github.com/jsoyer/CV) | Core project | YAML + Makefile + Python |

## Contributing

See main repository for contributing guidelines:
- [Contributing guide](https://github.com/jsoyer/cv-tui-rs/blob/main/CONTRIBUTING.md)
- [Issues](https://github.com/jsoyer/cv-tui-rs/issues)
- [Discussions](https://github.com/jsoyer/cv-tui-rs/discussions)

## Release Information

- **Current version**: 0.1.0
- **Latest release**: [GitHub Releases](https://github.com/jsoyer/cv-tui-rs/releases)
- **Active maintainer**: [@jsoyer](https://github.com/jsoyer)
- **Last updated**: March 2026

## Documentation Index

### User Documentation
- [Quick Start](quickstart.md) - 5-minute setup guide
- [Installation](installation.md) - Multiple installation methods
- [Configuration](config.md) - API, theme, and env setup
- [Keybindings](keybindings.md) - Complete keyboard reference
- [Features](features.md) - In-depth feature guides

### Developer Documentation
- [Architecture](architecture.md) - How it's built
- [API Reference](api.md) - API client documentation
- [Troubleshooting](troubleshooting.md) - Problem solving

### Meta
- [Documentation Update](../DOCUMENTATION_UPDATE.md) - What was updated
- [Main README](../README.md) - Project overview
- [Roadmap](../ROADMAP.md) - Future features

## Help & Support

### Getting Help
1. Check [Troubleshooting Guide](troubleshooting.md)
2. Search [existing issues](https://github.com/jsoyer/cv-tui-rs/issues)
3. Open new [issue](https://github.com/jsoyer/cv-tui-rs/issues/new)
4. Start [discussion](https://github.com/jsoyer/cv-tui-rs/discussions)

### Reporting Bugs
Include:
- Error message (exact text)
- Steps to reproduce
- Environment info (OS, terminal, Rust version)
- Debug output (`RUST_LOG=debug cv-rs`)

### Feature Requests
Open a GitHub discussion or issue with:
- Description of feature
- Use case and motivation
- Example workflow

## Thank You

Thank you for using cv-tui-rs! We hope it helps you land your dream job.

Happy job hunting! 🎯
