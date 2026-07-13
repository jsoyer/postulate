# cv-api Integration

This document describes how cv-manager communicates with cv-api and the conventions used throughout the codebase.

## Overview

cv-manager is a Next.js proxy frontend. It does not store application data itself — all persistent state lives in cv-api (backed by the CV project directory at `CV_PATH`). The Next.js API routes act as an authenticated relay: they receive browser requests, attach credentials, forward them to cv-api, and stream or return the response.

```
Browser  →  Next.js API routes  →  cv-api  →  CV_PATH (filesystem)
```

## Authentication

cv-api uses a static API key passed as the `X-API-Key` request header.

| Environment variable | Description                        | Required |
|----------------------|------------------------------------|----------|
| `CV_API_URL`         | Base URL of the cv-api instance    | Yes      |
| `CV_API_KEY`         | API key sent in every request      | Yes      |

Both variables must be set in `.env.local` before starting the dev server. The singleton client throws at construction time if either is missing.

## API Client

**`src/lib/api-client.ts`**

The `CvApiClient` class encapsulates all HTTP communication with cv-api. It is server-side only — never import it in client components.

```ts
import { getCvApiClient } from "@/lib/api-client"

const client = getCvApiClient()
const apps = await client.listApplications()
```

`getCvApiClient()` returns a lazy singleton constructed from env vars on first call. In tests, use `setCvApiClient(mockClient)` to inject a replacement.

Every request attaches the `X-API-Key` header automatically. Non-2xx responses are thrown as `ApiError` instances containing `statusCode` and `body` (see [Error Handling](#error-handling)).

## Proxy Pattern

Every `src/app/api/*` route is a thin proxy:

1. Parse and validate the incoming Next.js request.
2. Call the corresponding `CvApiClient` method.
3. Return the result as JSON (or stream it — see [SSE Streaming](#sse-streaming)).

No business logic lives in the proxy routes. This keeps cv-api as the single source of truth and means the Next.js layer can be replaced without touching application logic.

Example — `GET /api/applications` proxies to `CvApiClient.listApplications()`:

```ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const apps = await getCvApiClient().listApplications(searchParams.get("status") ?? undefined)
  return NextResponse.json(apps)
}
```

## SSE Streaming

**`POST /api/actions/stream`**

Long-running Make targets (tailor, score, prep, etc.) are executed via `CvApiClient.executeAction()`. Because cv-api returns the full result synchronously, the stream route re-emits stdout/stderr lines as Server-Sent Events to maintain backwards compatibility with the `ActionRunner` component.

Request body:

```json
{
  "target": "tailor",
  "application": "2026-02-databricks",
  "args": { "AI": "claude" }
}
```

SSE event format:

```
data: {"type":"stdout","line":"Tailoring CV..."}
data: {"type":"stderr","line":"Warning: ..."}
data: {"type":"done","code":0}
```

The client reads the stream with `EventSource` (or a `fetch` stream reader). The `ActionRunner` component in `src/components/ActionRunner.tsx` handles the consumer side.

## Settings Sync

**`GET/PUT /api/settings`** proxies directly to cv-api's settings endpoint. Settings are persisted in `CV_PATH/settings.json` by cv-api.

Fields managed server-side (synced to cv-api):

| Field           | Type     | Description                        |
|-----------------|----------|------------------------------------|
| `cvApiUrl`      | string   | Displayed in the UI only           |
| `cvApiKey`      | string   | Stored encrypted by cv-api         |
| `theme`         | string   | `"light"` or `"dark"`             |
| `default_ai`    | string   | Default AI provider                |
| `default_model` | string   | Model override (empty = default)   |

## Local-Only State

The following preferences are stored in `localStorage` and are never sent to cv-api:

| Key                  | Description                                           |
|----------------------|-------------------------------------------------------|
| `theme`              | Current UI theme (`"light"` / `"dark"`)              |
| `app-ai-provider`    | Per-application AI provider overrides (JSON object)  |
| `cv-health-score`    | Last CV health audit score (number)                  |
| `log-level`          | Browser console verbosity                            |

These values are read at component mount time with `localStorage.getItem` and written on user interaction. They survive page reloads but are scoped to the browser instance — they are not replicated across devices.

## Error Handling

`CvApiClient` throws `ApiError` for any non-2xx response. Proxy routes should catch it and propagate the original status code:

```ts
import { getCvApiClient, ApiError } from "@/lib/api-client"

try {
  const result = await getCvApiClient().executeAction(target, application)
  return NextResponse.json(result)
} catch (error) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.body.message }, { status: error.statusCode })
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}
```

`ApiError` shape:

```ts
class ApiError extends Error {
  statusCode: number   // HTTP status from cv-api
  body: {
    code: number       // machine-readable error code
    message: string    // human-readable message
  }
}
```

The `HealthBanner` component (`src/components/HealthBanner.tsx`) polls `GET /api/health` every 30 seconds and displays a dismissible banner when cv-api is unreachable. It links to `/setup` for first-run configuration.

## Environment Variable Reference

| Variable           | Default          | Description                                     |
|--------------------|------------------|-------------------------------------------------|
| `CV_API_URL`       | —                | Base URL of cv-api (required)                   |
| `CV_API_KEY`       | —                | API key for cv-api authentication (required)    |
| `AUTH_SECRET`      | `"weak_default"` | JWT signing secret — change in production       |
| `AUTH_USERNAME`    | `"jerome"`       | UI login username                               |
| `AUTH_PASSWORD`    | `"cvmanager"`    | UI login password                               |
| `AUTH_TOTP_SECRET` | —                | TOTP secret (optional, enables 2FA)             |
