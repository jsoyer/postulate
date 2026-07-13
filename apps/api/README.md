# cv-api

Production-ready Go HTTP/WebSocket/SSE API for the CV management system. The single execution surface for all CV operations — web clients, TUI clients, and external integrations connect exclusively through cv-api.

## Architecture

```
  Clients
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │ cv-manager  │  │  cv-tui-go   │  │  cv-tui-rs   │
  │  Next.js    │  │  Bubbletea   │  │   Ratatui    │
  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
         │ HTTPS           │ HTTPS            │ HTTPS
         └─────────────────┴─────────────────┘
                           │
                   ┌───────▼────────┐
                   │     Caddy      │  TLS · HTTP/3 (QUIC)
                   └───────┬────────┘
                           │ HTTP :3001
                   ┌───────▼────────┐
                   │    cv-api      │  Pure Go
                   │ Auth · RBAC    │  JWT / API key / TOTP
                   │ Routing · CRUD │  Prometheus · Audit log
                   │ SSE · WS       │  TTL cache · FTS search
                   └───┬────────────┘
                       │                      │
              REST+SSE │ HTTP :3002            │ filesystem (direct)
                       │                      │ applications/ meta.yml
               ┌───────▼────────┐             │
               │   cv-runner    │             │
               │ Go + Python    │             │
               │ Make + TeX Live│             │
               └───────┬────────┘             │
                       │ exec("make", ...)    │
               ┌───────▼──────────────────────▼──────┐
               │  CV project  (bind-mounted volume)  │
               │  Makefile · cv.yml · applications/  │
               └─────────────────────────────────────┘
```

| Service | Language | Role |
|---------|----------|------|
| **caddy** | — | TLS, HTTP/3, reverse proxy |
| **cv-api** | Go | Auth, RBAC, routing, application CRUD, FTS, sessions |
| **cv-runner** | Go + Python + Make + TeX Live | Make execution, job queue, streaming |
| **CV project** | Python / Make / LaTeX | Data source — mounted as volume, never containerised |

## Quick Start

### Docker / Podman

```bash
# 1. Clone and configure
git clone https://github.com/jsoyer/cv-api.git && cd cv-api
cp .env.example .env                     # edit with your values
cp config/targets.example.yml config/targets.yml

# 2. Fix CV project ownership (containers run as UID 1000)
chown -R 1000:1000 /path/to/your/CV

# 3. Start production stack
CV_PATH=/path/to/your/CV make compose            # Docker
CV_PATH=/path/to/your/CV make compose CONTAINER_TOOL=podman  # Podman

# 4. Verify
curl https://your-domain/health
```

### Development (hot-reload)

```bash
CV_PATH=/path/to/your/CV make dev               # Docker
CV_PATH=/path/to/your/CV make dev CONTAINER_TOOL=podman  # Podman
```

API at `http://localhost:3001` · Runner at `http://localhost:3002`

Dev credentials: `admin` / `dev` · API key: `dev-editor-key` · Viewer key: `dev-viewer-key`

### Local binary (no containers)

```bash
cp .env.example .env  # set CV_PATH, AUTH_SECRET, AUTH_PASSWORD, RUNNER_SECRET
make dev-local
```

## API Reference

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — runner status, AI providers, job queue depth |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/docs/openapi.yml` | OpenAPI 3.1 spec |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login → JWT cookie + token |
| `POST` | `/api/auth/logout` | Invalidate session |

### Applications (viewer+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/applications` | List with pagination, filtering, sorting |
| `GET` | `/api/applications/export` | Export all as JSON or CSV |
| `GET` | `/api/applications/{name}` | Get single application |
| `GET` | `/api/applications/{name}/notes` | Get notes |
| `GET` | `/api/applications/{name}/notes/versions` | List note versions |
| `GET` | `/api/applications/{name}/notes/versions/{file}` | Read specific version |
| `GET` | `/api/applications/{name}/files/{filename}` | Download file |
| `GET` | `/api/applications/{name}/skills-gap` | Skills gap analysis |
| `GET` | `/api/applications/{name}/health-audit` | CV quality scores |
| `GET` | `/api/applications/{name}/health-audit/history` | Score history |
| `GET` | `/api/applications/{name}/preview` | PDF preview (`?theme=tech-blue`) |

### Applications (editor+)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/applications` | Create application |
| `PATCH` | `/api/applications` | Bulk update |
| `PATCH` | `/api/applications/{name}` | Update application |
| `PUT` | `/api/applications/{name}/notes` | Update notes (versioned) |
| `POST` | `/api/applications/{name}/files` | Upload file |

### Actions (editor+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/targets` | List all 130 Make targets |
| `POST` | `/api/actions/{target}` | Execute target (sync, returns job) |
| `GET` | `/api/actions/jobs/{jobId}` | Poll job status |
| `GET` | `/api/stream/{target}` | **SSE streaming** — `?app=NAME&url=...` |
| `WS` | `/ws/actions/{target}` | WebSocket streaming |

### Intelligence (viewer+)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search` | Full-text search across applications |
| `GET` | `/api/themes` | List CV themes with usage counts |
| `GET` | `/api/dashboard` | Aggregated dashboard data |
| `GET` | `/api/stats` | Pipeline funnel stats |

### Settings

| Method | Path | Role | Description |
|--------|------|------|-------------|
| `GET` | `/api/settings` | viewer+ | Read settings |
| `PUT` | `/api/settings` | **admin** | Update settings |

### Admin only

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit-log` | Action audit trail |
| `GET` | `/api/backup` | Download tar.gz backup |
| `POST` | `/api/restore` | Restore from tar.gz backup |
| `GET` | `/api/sessions` | List active JWT sessions |
| `DELETE` | `/api/sessions/{id}` | Revoke session |
| `GET` | `/api/api-keys` | List API keys (prefix + role) |
| `POST` | `/api/api-keys` | Generate new API key |
| `DELETE` | `/api/api-keys/{prefix}` | Revoke API key |

## Authentication & RBAC

### Roles

| Role | Login | API key list |
|------|-------|-------------|
| `admin` | `AUTH_USERNAME` password login | — |
| `editor` | — | `API_KEYS` |
| `viewer` | — | `VIEWER_API_KEYS` |

The JWT issued at login always carries `admin` role. Roles are embedded in JWT claims and returned from API key validation — no database required.

### Credential methods

```bash
# API key (TUI clients, scripts)
curl -H "X-API-Key: your-key" http://localhost:3001/api/applications

# JWT cookie (web clients — set automatically after login)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Bearer token (WebSocket / SSE)
GET /api/stream/tailor?app=2024-03-google&token=<jwt>
```

### Streaming (SSE — recommended for web clients)

```typescript
// TypeScript SDK
const client = new CvApiClient('http://localhost:3001', 'your-api-key')

for await (const msg of client.streamAction('tailor', { application: '2024-03-google' })) {
  if (msg.type === 'stdout') console.log(msg.data)
  if (msg.type === 'exit') break
}
```

```bash
# Raw SSE
curl -N -H "X-API-Key: your-key" \
  "http://localhost:3001/api/stream/tailor?app=2024-03-google"
```

## Configuration

### Required

| Variable | Description |
|----------|-------------|
| `CV_PATH` | Path to CV project directory |
| `AUTH_SECRET` | JWT signing secret (min 32 chars) |
| `AUTH_PASSWORD` | Web login password |
| `RUNNER_SECRET` | Shared secret between cv-api and cv-runner (min 32 chars) |

### Auth

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_USERNAME` | `admin` | Web login username |
| `AUTH_TOTP_SECRET` | — | TOTP 2FA secret (base32) |
| `API_KEYS` | — | Comma-separated editor API keys |
| `VIEWER_API_KEYS` | — | Comma-separated viewer API keys |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Listen port |
| `ALLOWED_ORIGINS` | — | CORS origins (comma-separated) |
| `COOKIE_DOMAIN` | `localhost` | Cookie domain |
| `COOKIE_SECURE` | `false` | Require HTTPS for cookies |
| `TARGETS_FILE` | `config/targets.yml` | Targets allowlist path |
| `RUNNER_URL` | `http://cv-runner:3002` | cv-runner base URL |

### Execution

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT` | `3` | Max parallel Make jobs |
| `DEFAULT_TIMEOUT` | `5m` | Per-job timeout default |
| `MAX_TIMEOUT` | `30m` | Per-job timeout maximum |
| `EXPENSIVE_TARGETS` | `tailor,research,batch,interview-sim` | Cost-limited targets |

### AI Providers (forwarded to cv-runner)

| Variable | Provider |
|----------|----------|
| `GEMINI_API_KEY` | Google Gemini (default) |
| `ANTHROPIC_API_KEY` | Anthropic Claude |
| `OPENAI_API_KEY` | OpenAI |
| `MISTRAL_API_KEY` | Mistral |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Ollama (local) |

### Notifications & Integrations (forwarded to cv-runner)

`SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `LINKEDIN_ACCESS_TOKEN`, `NOTION_TOKEN`, `NOTION_DATABASE_ID`

## Podman Support

cv-api is fully compatible with Podman 4.x+:

```bash
# Build images
make image-api  CONTAINER_TOOL=podman
make image-runner CONTAINER_TOOL=podman CV_PATH=/path/to/CV

# Run dev stack
make dev CONTAINER_TOOL=podman CV_PATH=/path/to/CV

# Run production stack
make compose CONTAINER_TOOL=podman CV_PATH=/path/to/CV
```

Podman notes:
- `podman compose` is built-in since Podman 4.0 (no extra install needed)
- `--build-context` (used for `cv-runner` requirements.txt) requires Podman 4.2+
- Rootless Podman works — ensure host CV directory is owned by your UID

## Make Commands

```
make build          Build cv-api binary
make build-runner   Build cv-runner binary
make build-all      Build both binaries
make test           Run all tests (race + coverage)
make lint           Run golangci-lint
make fmt            Format with gofumpt
make deps           Tidy and verify modules
make clean          Remove binaries and cache

make image-api      Build cv-api Docker/Podman image
make image-runner   Build cv-runner image  (CV_PATH required)
make images         Build both images      (CV_PATH required)
make push           Build and push to GHCR (CV_PATH required)

make dev            Dev stack with hot-reload (CV_PATH required)
make compose        Production stack        (CV_PATH required)
make compose-down   Stop all services
make compose-logs   Follow logs
```

## Project Structure

```
cv-api/
├── cmd/
│   ├── cv-api/          Entry point — HTTP server
│   └── cv-runner/       Entry point — Make execution backend
├── internal/
│   ├── audit/           Circular-buffer audit log
│   ├── auth/            JWT · API keys · TOTP · RBAC · sessions
│   ├── cache/           Generic TTL in-memory cache
│   ├── config/          Config loading from env
│   ├── cvutil/          Shared utilities (ValidateAppName, LoadTargets)
│   ├── executor/        Make target execution + job store
│   ├── handlers/        HTTP handlers — all endpoints
│   ├── metrics/         Prometheus-compatible metrics (no external dep)
│   ├── middleware/       Auth · Rate limit · CORS · Request ID · RBAC
│   ├── models/          Request / response types
│   ├── runner/          cv-runner HTTP server and job execution
│   ├── search/          In-memory FTS inverted index
│   └── storage/         Filesystem CRUD — applications, notes, files
├── pkg/cvtypes/         Exported types for TUI clients
├── sdk/typescript/      TypeScript client SDK (types + CvApiClient)
├── config/
│   └── targets.example.yml  130 Make targets across 9 categories
├── docs/
│   ├── openapi.yml      OpenAPI 3.1 spec (served at /docs/openapi.yml)
│   └── postman_collection.json  Postman collection v2.1
├── caddy/Caddyfile      Reverse proxy config
├── .github/workflows/
│   ├── ci.yml           Test + lint on every push
│   ├── security.yml     Trivy + govulncheck
│   ├── docker.yml       Multi-arch image builds (amd64/arm64/armv7)
│   └── release.yml      GoReleaser on v* tags
├── Dockerfile           cv-api image (alpine:3.21, ~20 MB)
├── Dockerfile.runner    cv-runner image (texlive/texlive, ~4 GB)
├── docker-compose.yml   Production stack
├── docker-compose.dev.yml  Development stack with hot-reload
├── .goreleaser.yml      Release config
└── Makefile             All build, test, container commands
```

## TypeScript SDK

```typescript
import { CvApiClient } from './sdk/typescript/client'

const client = new CvApiClient('http://localhost:3001', 'your-api-key')

// Applications
const { data, totalCount } = await client.listApplications({ limit: 20, status: 'applied' })
const app = await client.getApplication('2024-03-google')

// Stream a Make target (SSE)
for await (const msg of client.streamAction('tailor', { application: '2024-03-google' })) {
  if (msg.type === 'stdout') process.stdout.write(msg.data + '\n')
  if (msg.type === 'exit') break
}

// Convenience methods
await client.tailorCV('2024-03-google')
await client.researchCompany('2024-03-google')
await client.prepInterview('2024-03-google')
await client.generateCoverLetter('2024-03-google')
```

See [sdk/typescript/README.md](sdk/typescript/README.md) for full reference.

## Related Repositories

| Repo | Language | Purpose |
|------|----------|---------|
| [CV](https://github.com/jsoyer/CV) | Python / Make / LaTeX | Core project — YAML CVs, Makefile, AI scripts |
| [cv-manager](https://github.com/jsoyer/cv-manager) | TypeScript / Next.js | Web frontend |
| [cv-tui-go](https://github.com/jsoyer/cv-tui-go) | Go / Bubbletea | Terminal UI |
| [cv-tui-rs](https://github.com/jsoyer/cv-tui-rs) | Rust / Ratatui | Terminal UI |
