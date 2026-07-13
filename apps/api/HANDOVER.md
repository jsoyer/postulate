# cv-api — Handover Document

Machine-transfer handover. Last updated: 2026-03-10.

## État actuel

- **301 tests** passent (16 packages)
- **22 commits** en avance sur `origin/main` → à pusher
- Working tree propre, rien en cours

## Architecture

```
cv-api (pure Go, ~20 MB)     — port 3001 — JWT/API key auth, RBAC, CRUD, SSE, WS
cv-runner (Go+Python+TeX, ~4 GB) — port 3002 — exécution Make targets, AI providers
```

Clients autorisés : **cv-manager** (Next.js), **cv-tui-go** (Bubbletea), **cv-tui-rs** (Ratatui).

## Packages internes

| Package | Rôle |
|---|---|
| `internal/auth` | JWT, API keys, RBAC (admin/editor/viewer), sessions |
| `internal/config` | Env vars → Config struct |
| `internal/executor` | Semaphore, RunStreaming, WaitForSlot |
| `internal/handlers` | Tous les handlers HTTP (router.go central) |
| `internal/storage` | YAML CRUD, pagination curseur, FTS index, versioning notes |
| `internal/search` | Index inversé en mémoire, AND sémantique |
| `internal/cache` | Cache générique TTL (sync.RWMutex) |
| `internal/metrics` | Prometheus-compatible Registry (CounterVec, HistogramVec, Gauge) |
| `internal/middleware` | RequestID, Auth, RequireRole, CORS, Rate limit |
| `internal/audit` | Audit log file-based |
| `internal/runner` | Job runner, sanitizedEnv, aiCache |
| `internal/models` | Structs partagés |
| `internal/cvutil` | Utilitaires CV |

## RBAC

| Rôle | Accès |
|---|---|
| `viewer` | GET applications, GET themes, GET health — lecture seule |
| `editor` | + POST/PATCH applications, PUT notes, POST files, POST actions, SSE/WS |
| `admin` | + sessions, api-keys, audit-log, backup/restore, PUT settings |

- Login admin → JWT (cookie + Bearer)
- API keys editor → `API_KEYS` env (virgule-séparée)
- API keys viewer → `VIEWER_API_KEYS` env

## Endpoints principaux

```
POST   /api/login
GET    /api/logout
GET    /api/applications              viewer+
POST   /api/applications              editor+
PATCH  /api/applications              editor+  (bulk)
GET    /api/applications/{name}       viewer+
PATCH  /api/applications/{name}       editor+
DELETE /api/applications/{name}       editor+
GET    /api/applications/export       editor+  (?format=json|csv)
GET    /api/applications/{name}/preview   editor+  (?theme=...)
GET    /api/applications/{name}/health-audit   editor+
GET    /api/applications/{name}/health-audit/history  editor+
GET    /api/applications/{name}/notes/versions  editor+
GET    /api/applications/{name}/notes/versions/{file}  editor+
POST   /api/applications/{name}/actions/{target}  editor+
GET    /api/stream/{target}           editor+  (SSE)
GET    /api/themes                    viewer+
GET    /api/settings                  admin
PUT    /api/settings                  admin
GET    /api/sessions                  admin
DELETE /api/sessions/{id}             admin
GET    /api/api-keys                  admin
POST   /api/api-keys                  admin
DELETE /api/api-keys/{prefix}         admin
GET    /api/audit-log                 admin
GET    /api/backup                    admin
POST   /api/restore                   admin
GET    /api/dashboard                 editor+
GET    /api/search                    viewer+
GET    /api/stats                     viewer+
GET    /health                        public
GET    /metrics                       public
GET    /docs                          public  (Swagger UI)
GET    /docs/openapi.yml              public
WS     /ws/{target}                   editor+
```

## Variables d'environnement requises

```bash
CV_PATH=/path/to/cv-project      # OBLIGATOIRE
JWT_SECRET=<32+ chars>           # OBLIGATOIRE
ADMIN_PASSWORD=<strong>          # OBLIGATOIRE
```

### Optionnelles importantes

```bash
API_KEYS=key1,key2               # editors
VIEWER_API_KEYS=vkey1            # viewers
RUNNER_URL=http://cv-runner:3002
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
PORT=3001

# AI providers (cv-runner)
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
OLLAMA_URL=http://ollama:11434

# Notifications
DISCORD_WEBHOOK_URL=...
SLACK_WEBHOOK_URL=...

# Intégrations
NOTION_API_KEY=...
LINKEDIN_EMAIL=...
LINKEDIN_PASSWORD=...
```

## Dev local

```bash
# Prérequis
# - Docker ou Podman >= 4.2 (pour additional_contexts)
# - Go 1.24+
# - CV_PATH pointant vers le projet CV cloné

# Lancer les services
CV_PATH=/path/to/cv make dev         # docker-compose.dev.yml

# Tests
go test ./...

# Build binaires
make build

# Build images
make images

# Push images
make push
```

Dev credentials (docker-compose.dev.yml) :
- Admin : `admin` / `dev`
- API key editor : `dev-editor-key`
- API key viewer : `dev-viewer-key`
- Ports : cv-api `:3001`, cv-runner `:3002`

## SDK TypeScript

```
sdk/typescript/
  client.ts    — CvApiClient class, ~70 méthodes typées
  types.ts     — Tous les types (Application, Session, APIKeyInfo, …)
  README.md    — Quick start + référence complète
```

Usage :
```ts
import { CvApiClient } from './sdk/typescript/client'
const client = new CvApiClient('http://localhost:3001', 'dev-editor-key')
const apps = await client.listApplications({ limit: 20 })
for await (const event of client.streamAction('tailor', { app: 'Google SWE' })) {
  if (event.type === 'stdout') process.stdout.write(event.data)
}
```

## Fichiers clés

| Fichier | Description |
|---|---|
| `cmd/cv-api/main.go` | Entrypoint cv-api |
| `cmd/cv-runner/main.go` | Entrypoint cv-runner |
| `internal/handlers/router.go` | Enregistrement de toutes les routes |
| `internal/handlers/sse.go` | Handler SSE streaming |
| `internal/handlers/backup.go` | Backup tar.gz + restore multipart |
| `internal/auth/auth.go` | JWT, API keys, RBAC |
| `internal/auth/sessions.go` | Session store (en mémoire) |
| `internal/storage/storage.go` | CRUD YAML + pagination + FTS + versioning |
| `internal/search/index.go` | Index FTS inversé |
| `internal/metrics/metrics.go` | Registry Prometheus custom |
| `docs/openapi.yml` | Spec OpenAPI 3.1 |
| `docs/postman_collection.json` | Collection Postman v2.1 (15 dossiers) |
| `Dockerfile` | cv-api — golang:1.24-alpine + alpine:3.21 |
| `Dockerfile.runner` | cv-runner — golang:1.24-alpine + ubuntu |
| `docker-compose.yml` | Production (ghcr.io/jsoyer) |
| `docker-compose.dev.yml` | Dev avec hot-reload |
| `Makefile` | Targets: build, images, push, dev, test, help |
| `.goreleaser.yml` | Releases binaires multi-arch |
| `.github/workflows/` | CI, security scan, docker multi-arch, release |

## Ce qui reste à faire (ROADMAP)

### cv-api (nice to have, non bloquant)

- [ ] API versioning (`/api/v2/...`)
- [ ] SQLite metadata store (migration depuis YAML)
- [ ] Data migrations framework
- [ ] Load testing suite (k6)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Helm chart
- [ ] Contract tests (Pact) cv-api ↔ clients
- [ ] Theme service integration tests
- [ ] AI fallback chain tests

### Prochain chantier — **cv-manager** (frontend Next.js)

C'est la prochaine étape. Toutes les APIs nécessaires sont implémentées dans cv-api.

Fonctionnalités à implémenter dans cv-manager :
1. Auth (login/logout, gestion token JWT/cookie)
2. Dashboard (stats, health, AI provider status)
3. Liste applications avec filtres/pagination/recherche
4. Fiche application (édition, notes, fichiers)
5. Lancer des actions (tailor, apply, research…) avec streaming SSE live
6. Prévisualisation PDF (thèmes)
7. Audit CV (health score + historique)
8. Gestion admin (sessions, API keys, audit log, backup/restore)
9. Tableau de bord thèmes
10. Mode viewer (lecture seule)

SDK TypeScript disponible dans `sdk/typescript/` — à copier ou NPM-linker dans cv-manager.

## Setup nouvelle machine

```bash
# 1. Cloner
git clone https://github.com/jsoyer/cv-api
cd cv-api

# 2. Go 1.24
go version  # doit être >= 1.24

# 3. Tests
go test ./...  # doit afficher: 301 passed in 16 packages

# 4. Dev
CP CV_PATH=/path/to/your/cv-project
make dev   # ou: CV_PATH=... docker compose -f docker-compose.dev.yml up

# 5. Vérifier
curl http://localhost:3001/health
```

## Repos liés

| Repo | Description |
|---|---|
| `cv-api` | Ce repo — API backend |
| `cv` | Projet CV source (YAML + Makefile + Python) |
| `cv-manager` | Frontend Next.js (prochaine étape) |
| `cv-tui-go` | TUI Bubbletea |
| `cv-tui-rs` | TUI Ratatui |
