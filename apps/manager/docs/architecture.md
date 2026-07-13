# Architecture

## System overview

The CV management system is a multi-repository project with a shared API backend.

```
┌──────────────────────────────────────────────────────────┐
│                    CV (cv-core)                          │
│  Python scripts + Makefile + YAML CVs + applications/    │
│  Source of truth for all data and AI pipelines            │
└───────────────────────┬──────────────────────────────────┘
                        │ exec.Command("make", target, args...)
                        │ filesystem reads (applications/, *.yml)
                ┌───────▼───────┐
                │   cv-api      │
                │  Go HTTP/WS   │
                │  port 3001    │
                └──┬─────┬────┬─┘
                   │     │    │
         ┌─────────▼┐ ┌─▼────▼────┐
         │  cv-web   │ │  cv-tui-* │
         │  Next.js  │ │  Go/Rust  │
         │  :3000    │ │  terminal │
         └──────────┘ └───────────┘
```

## Repositories

| Repo | Language | Purpose | Connects to |
|------|----------|---------|-------------|
| [CV](https://github.com/jsoyer/CV) | Python/Make | Core data, AI scripts, YAML CVs | -- (source of truth) |
| [cv-api](https://github.com/jsoyer/cv-api) | Go | HTTP/WS API server, auth, execution | CV (filesystem + exec) |
| [cv-web](https://github.com/jsoyer/cv-manager) | TypeScript | Web frontend (this repo) | cv-api (HTTP) |
| [cv-tui-go](https://github.com/jsoyer/cv-tui-go) | Go | Bubbletea terminal UI | cv-api (HTTP/WS) |
| [cv-tui-rs](https://github.com/jsoyer/cv-tui-rs) | Rust | Ratatui terminal UI | cv-api (HTTP/WS) |

## Data flow

### Current state (before migration)

```
cv-web (Next.js)
    │
    ├── API routes → execFile("make", target) → CV project
    └── lib/cv-data.ts → filesystem reads → CV project
```

The web app directly accesses the CV project filesystem and executes Make targets via `execFile`. This means:
- cv-web must run on the same machine as the CV project
- Shell execution logic is implemented in TypeScript
- No other client can reuse the execution layer

### Target state (after migration)

```
cv-web (Next.js)
    │
    └── API client → HTTP/WS → cv-api → CV project
```

The web app becomes a pure frontend. All filesystem access and Make execution is handled by cv-api.

## Authentication model

### Web clients (cv-web)

1. User logs in via `/api/auth/login` on cv-api
2. cv-api returns JWT in httpOnly cookie (7-day expiry)
3. All cv-web requests include the cookie automatically
4. cv-web manages its own session layer for SSR pages

### TUI clients (cv-tui-go, cv-tui-rs)

1. User generates an API key via `openssl rand -base64 32`
2. API key is added to cv-api's `API_KEYS` env var
3. TUI stores the key in `~/.config/cv/config.toml`
4. Every request includes `X-API-Key` header

### Security boundaries

```
Layer 1: Network    → Caddy (TLS) or localhost only
Layer 2: Auth       → JWT cookie or API key
Layer 3: Allowlist  → Only configured Make targets
Layer 4: Execution  → exec.Command (no shell interpolation)
Layer 5: Validation → Application name regex, path traversal prevention
Layer 6: Limits     → Rate limiting, concurrency cap, per-target timeouts
```

## Docker deployment

```
┌──────────────────────────────────────────┐
│               Docker Compose             │
│                                          │
│  ┌─────────┐   ┌─────────┐   ┌───────┐ │
│  │ cv-web   │   │ cv-api  │   │ Caddy │ │
│  │ :3000    │──>│ :3001   │<──│ :443  │ │
│  │ internal │   │ internal│   │ public│ │
│  └─────────┘   └────┬────┘   └───────┘ │
│                      │                   │
│                 ┌────▼────┐              │
│                 │ CV vol  │              │
│                 │ (ro)    │              │
│                 └─────────┘              │
└──────────────────────────────────────────┘
```

Only Caddy exposes ports to the outside. cv-web and cv-api communicate on an internal Docker network.
