# API Contract

TypeScript interfaces for the cv-api endpoints that cv-web consumes.
The canonical source of truth for types is `src/lib/api-types.ts`.

## Types

```typescript
// ---- Application ----

type ApplicationStatus = "applied" | "interview" | "offer" | "rejected" | "ghosted"

interface Application {
  name: string
  company: string
  position: string
  status: ApplicationStatus
  created_at: string   // ISO 8601
  deadline?: string
  outcome?: string
  files?: Record<string, string>  // present only on GET /api/applications/{name}
}

interface CreateApplicationRequest {
  company: string
  position: string
  url?: string
}

// ---- Actions ----

interface ActionRequest {
  target: string
  application?: string
  args?: Record<string, string>
}

type ActionStatus = "running" | "completed" | "failed" | "cancelled"

interface ActionResult {
  job_id: string
  target: string
  status: ActionStatus
  exit_code: number
  stdout?: string
  stderr?: string
  duration_ms: number
}

// ---- WebSocket ----

type WsMessageType = "stdout" | "stderr" | "exit" | "error"

interface WsMessage {
  type: WsMessageType
  data: string
}

// ---- Targets ----

interface Target {
  name: string
  category: string
  description: string
  args?: string[]
}

// ---- Dashboard & Stats ----

interface DashboardData {
  total_applications: number
  by_status: Record<string, number>
  recent_applications: Application[]
}

interface TimelineEntry {
  date: string
  count: number
}

interface StatsData {
  funnel: Record<string, number>
  timeline: TimelineEntry[]
}

// ---- Settings ----

interface Settings {
  theme: string
  default_view: string
}

// ---- Auth ----

interface LoginRequest {
  username: string
  password: string
  totp?: string
}

interface LoginResponse {
  token: string
  expires_at: number  // Unix timestamp
}

// ---- Health ----

interface HealthResponse {
  status: "ok" | "degraded" | "down"
  version?: string
  uptime_seconds?: number
}

// ---- Errors ----

interface ApiErrorBody {
  code: number
  message: string
}
```

## Endpoints

### Data

| Method | Path | Query / Body | Response | Auth |
|--------|------|--------------|----------|------|
| `GET` | `/api/applications` | `?status=&sort=&order=` | `Application[]` | required |
| `GET` | `/api/applications/{name}` | — | `Application` (with `files`) | required |
| `POST` | `/api/applications` | `CreateApplicationRequest` | `Application` | required |
| `GET` | `/api/dashboard` | — | `DashboardData` | required |
| `GET` | `/api/stats` | — | `StatsData` | required |
| `GET` | `/api/settings` | — | `Settings` | required |
| `PUT` | `/api/settings` | `Settings` | `Settings` | required |
| `GET` | `/api/targets` | — | `Target[]` | required |

### Actions

| Method | Path | Body | Response | Auth |
|--------|------|------|----------|------|
| `POST` | `/api/actions/{target}` | `ActionRequest` | `ActionResult` (202) | required |
| `GET` | `/api/actions/{jobId}` | — | `ActionResult` | required |

The POST always returns 202 immediately; the client should poll GET or use the
WebSocket stream to observe completion.

### WebSocket

| Path | Protocol | Auth |
|------|----------|------|
| `/ws/actions/{target}` | Send `ActionRequest`, receive `WsMessage` stream | `?api_key=` query param |

The `api_key` query parameter is used instead of a header because browsers
cannot set custom headers on WebSocket connections.

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/api/auth/login` | `LoginRequest` | `LoginResponse` + `Set-Cookie` |
| `POST` | `/api/auth/logout` | — | 204 |

### Health

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `HealthResponse` |

### Error format

All error responses use this shape:

```json
{
  "code": 404,
  "message": "Application 'acme-2025-01' not found"
}
```

Standard HTTP status codes: `400`, `401`, `403`, `404`, `429`, `500`, `503`.

## Authentication

All endpoints (except `/health` and `/api/auth/login`) require the `X-API-Key`
header set to the value of the `CV_API_KEY` environment variable.

## Environment variables (cv-web)

| Variable | Description |
|----------|-------------|
| `CV_API_URL` | Base URL of the cv-api server (e.g. `http://localhost:3001`) |
| `CV_API_KEY` | Shared secret API key — generate with `openssl rand -base64 32` |
