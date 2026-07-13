# API Reference

Base URL: `http://localhost:3001` (development) or `https://cv.example.com` (production)

## Overview

All endpoints except `/health` and `/api/auth/login` require authentication via:
- **JWT cookie** (`cv_session`) for web clients, or
- **X-API-Key header** for TUI clients

Request/response bodies are JSON. Timestamps are ISO 8601 format. Successful responses include 2xx status codes; errors include appropriate 4xx/5xx codes with error messages.

## Table of Contents

- [Health](#health)
- [Authentication](#authentication)
- [Applications](#applications)
- [Actions & Execution](#actions--execution)
- [Dashboard & Analytics](#dashboard--analytics)
- [Settings](#settings)
- [WebSocket Streaming](#websocket-streaming)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Health

### `GET /health`

Health check endpoint for liveness probes. No authentication required.

**Response** `200 OK`

```json
{
  "status": "ok"
}
```

Use this for Kubernetes liveness probes, container health checks, and load balancer health verification.

---

## Authentication

### `POST /api/auth/login`

Authenticate with username/password (and optional TOTP if 2FA is enabled) to receive a JWT session.

The JWT is returned in an httpOnly cookie (`cv_session`) and in the response body for client reference.

**Request Body**

```json
{
  "username": "jerome",
  "password": "your_password",
  "totp": "123456"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | yes | Login username (default: `admin`) |
| `password` | string | yes | Login password |
| `totp` | string | no | 6-digit TOTP code (required if `AUTH_TOTP_SECRET` is configured) |

**Response** `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": 1709913600
}
```

The `session` cookie is set with these properties:
- **httpOnly**: Not accessible via JavaScript (prevents XSS)
- **SameSite=Strict**: Not sent on cross-origin requests (prevents CSRF)
- **Secure**: Only sent over HTTPS (when behind Caddy/HTTPS)
- **7-day expiry**: Suitable for personal tools

All subsequent authenticated requests automatically include the cookie.

**Example**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jerome",
    "password": "changeme"
  }' \
  -c cookies.txt

# Subsequent requests include the cookie automatically
curl http://localhost:3001/api/applications \
  -b cookies.txt
```

**Errors**

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `unauthorized` | Invalid credentials | Wrong username/password |
| 401 | `unauthorized` | Invalid TOTP code | TOTP mismatch (if 2FA enabled) |
| 429 | `too_many_requests` | Rate limit exceeded | >5 login attempts/min from this IP |

---

### `POST /api/auth/logout`

Clear the session cookie. Subsequent requests will be unauthenticated.

**Request**: No body required.

**Response** `204 No Content`

No response body.

**Example**

```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -b cookies.txt
```

---

## Applications

Applications represent job applications in the CV system. Each application has a unique name, associated metadata, and related files (job description, tailored CV, etc.).

### `GET /api/applications`

List all job applications with optional filtering and sorting.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | — | Filter by status: `applied`, `interview`, `offer`, `rejected`, `ghosted` |
| `sort` | string | `created_at` | Sort field: `created_at`, `company`, `status` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Response** `200 OK`

```json
[
  {
    "name": "2024-03-company-x",
    "company": "Company X",
    "position": "Senior Engineer",
    "status": "interview",
    "created_at": "2024-03-01T10:00:00Z",
    "deadline": "2024-03-15T00:00:00Z",
    "outcome": ""
  },
  {
    "name": "2024-03-company-y",
    "company": "Company Y",
    "position": "Staff Engineer",
    "status": "applied",
    "created_at": "2024-02-28T14:30:00Z",
    "deadline": "2024-03-20T00:00:00Z",
    "outcome": ""
  }
]
```

**Example**

```bash
# List all applications
curl http://localhost:3001/api/applications \
  -H "X-API-Key: your_api_key"

# Filter by status
curl "http://localhost:3001/api/applications?status=interview" \
  -H "X-API-Key: your_api_key"

# Sort by company ascending
curl "http://localhost:3001/api/applications?sort=company&order=asc" \
  -H "X-API-Key: your_api_key"
```

---

### `GET /api/applications/{name}`

Retrieve full details of a single application, including all associated files.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Application name (e.g., `2024-03-company-x`) |

**Response** `200 OK`

```json
{
  "name": "2024-03-company-x",
  "company": "Company X",
  "position": "Senior Engineer",
  "status": "interview",
  "created_at": "2024-03-01T10:00:00Z",
  "deadline": "2024-03-15T00:00:00Z",
  "outcome": "",
  "files": {
    "meta.yml": "company: Company X\nposition: Senior Engineer\nstatus: interview\n...",
    "job.txt": "Job Description:\n\nResponsibilities:\n- Lead engineering...",
    "job.url": "https://example.com/jobs/123",
    "cv-tailored.yml": "YAML CV tailored for this application...",
    "prep.md": "# Interview Prep\n\n## Questions to Ask...",
    "research.md": "# Company Research\n\n## Overview..."
  }
}
```

The `files` object contains the raw content of all files associated with the application, keyed by filename.

**Example**

```bash
curl http://localhost:3001/api/applications/2024-03-company-x \
  -H "X-API-Key: your_api_key"
```

**Errors**

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 404 | `not_found` | Application not found | Application doesn't exist |
| 400 | `bad_request` | Invalid application name | Name contains invalid characters or `..` |

---

### `POST /api/applications`

Create a new application. This typically triggers the `apply` workflow Make target to fetch the job description.

**Request Body**

```json
{
  "company": "Company X",
  "position": "Senior Engineer",
  "url": "https://example.com/jobs/123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company` | string | yes | Company name |
| `position` | string | yes | Job position title |
| `url` | string | yes | Job posting URL |

**Response** `201 Created`

```json
{
  "name": "2024-03-company-x",
  "company": "Company X",
  "position": "Senior Engineer",
  "status": "applied",
  "created_at": "2024-03-01T10:00:00Z"
}
```

The application name is auto-generated from the company name and current date.

**Example**

```bash
curl -X POST http://localhost:3001/api/applications \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "company": "Company X",
    "position": "Senior Engineer",
    "url": "https://example.com/jobs/123"
  }'
```

**Errors**

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `bad_request` | Missing required fields | `company`, `position`, or `url` missing |
| 409 | `conflict` | Application already exists | Application name collision |

---

## Actions & Execution

Actions represent Make target executions. Clients can execute targets either by polling or via WebSocket streaming.

### `GET /api/targets`

List all allowed Make targets with descriptions and required arguments.

Used by clients to discover available actions and construct requests.

**Response** `200 OK`

```json
[
  {
    "name": "fetch",
    "category": "workflow",
    "description": "Fetch job description from a URL",
    "args": ["url"]
  },
  {
    "name": "tailor",
    "category": "workflow",
    "description": "AI-tailor CV for a specific application",
    "args": ["app"]
  },
  {
    "name": "ats-rank",
    "category": "workflow",
    "description": "Rank all applications by ATS score",
    "args": []
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Make target name (matches Makefile target) |
| `category` | string | Logical grouping (e.g., `workflow`, `cv`, `interview`, `salary`) |
| `description` | string | Human-readable description |
| `args` | array | Required arguments (names like `url`, `app`, `app1`, `app2`) |

**Example**

```bash
curl http://localhost:3001/api/targets \
  -H "X-API-Key: your_api_key"
```

---

### `POST /api/actions/{target}`

Execute a Make target and receive a job ID for polling.

This endpoint initiates execution and returns immediately with a job ID. Use the job ID to poll for results or stream via WebSocket.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `target` | string | Make target name (must be in allowlist) |

**Request Body**

```json
{
  "application": "2024-03-company-x",
  "args": {
    "url": "https://example.com/job/123"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `application` | string | no | Application name (required by some targets) |
| `args` | object | yes | Target arguments as key-value pairs |

**Response** `202 Accepted`

```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "target": "fetch",
  "status": "running"
}
```

The job ID can be used to poll for results via `GET /api/actions/jobs/{jobId}`.

**Example**

```bash
curl -X POST http://localhost:3001/api/actions/fetch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "args": {
      "url": "https://example.com/job/123"
    }
  }'
```

**Errors**

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 400 | `bad_request` | Missing required arguments | Required args not provided |
| 403 | `forbidden` | Target not in allowlist | Target not in `config/targets.yml` |
| 429 | `too_many_requests` | Max concurrent jobs exceeded | >3 jobs running (default limit) |
| 500 | `internal_error` | Executor unavailable | Unexpected server error |

---

### `GET /api/actions/jobs/{jobId}`

Poll for the status and results of a running or completed job.

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job ID from `POST /api/actions/{target}` |

**Response** `200 OK`

```json
{
  "job_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "target": "fetch",
  "status": "completed",
  "exit_code": 0,
  "stdout": "Job description fetched successfully from URL...\n",
  "stderr": "",
  "duration_ms": 2340
}
```

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | string | Unique job ID |
| `target` | string | Make target name |
| `status` | string | `running`, `completed`, `failed`, or `cancelled` |
| `exit_code` | number | Process exit code (0 for success) |
| `stdout` | string | Standard output (empty if still running) |
| `stderr` | string | Standard error output (empty if still running) |
| `duration_ms` | number | Total execution time in milliseconds |

**Status Values**

- `running`: Job is still executing
- `completed`: Job finished successfully (check `exit_code`)
- `failed`: Job exited with non-zero code
- `cancelled`: Job was cancelled or timed out

**Example**

```bash
# Poll for results (blocking)
curl http://localhost:3001/api/actions/jobs/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "X-API-Key: your_api_key"

# Polling strategy: call every 500ms until status != "running"
while true; do
  result=$(curl -s http://localhost:3001/api/actions/jobs/JOB_ID \
    -H "X-API-Key: your_api_key")
  status=$(echo $result | jq -r '.status')
  [ "$status" != "running" ] && break
  sleep 0.5
done
```

**Errors**

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 404 | `not_found` | Job not found | Job ID doesn't exist or expired |

---

## Dashboard & Analytics

### `GET /api/dashboard`

Aggregated dashboard data for quick overview of the job search pipeline.

**Response** `200 OK`

```json
{
  "total_applications": 42,
  "by_status": {
    "applied": 15,
    "interview": 8,
    "offer": 2,
    "rejected": 12,
    "ghosted": 5
  },
  "recent_applications": [
    {
      "name": "2024-03-company-x",
      "company": "Company X",
      "position": "Senior Engineer",
      "status": "interview",
      "created_at": "2024-03-01T10:00:00Z"
    }
  ]
}
```

---

### `GET /api/stats`

Detailed pipeline statistics and funnel metrics for analytics.

**Response** `200 OK`

```json
{
  "funnel": {
    "applied": 42,
    "interview": 18,
    "offer": 5,
    "accepted": 1
  },
  "timeline": [
    {"date": "2024-01", "count": 8},
    {"date": "2024-02", "count": 12},
    {"date": "2024-03", "count": 22}
  ]
}
```

---

## Settings

### `GET /api/settings`

Retrieve user preferences and settings.

**Response** `200 OK`

```json
{
  "theme": "dark",
  "default_view": "dashboard"
}
```

---

### `PUT /api/settings`

Update user preferences.

**Request Body**

```json
{
  "theme": "dark",
  "default_view": "applications"
}
```

**Response** `200 OK`

Same as `GET /api/settings` with updated values.

---

## WebSocket Streaming

### `WS /ws/actions/{target}`

Establish a WebSocket connection to stream Make target output in real-time.

This is the preferred method for long-running tasks, as it provides real-time feedback instead of polling.

**Connection Handshake**

WebSocket upgrade is protected by authentication:

```
WS /ws/actions/{target}?token=<jwt_or_api_key>
```

Or with session cookie (web clients):

```
WS /ws/actions/{target}
Cookie: cv_session=<jwt>
```

**Authentication Methods** (in order):

1. `token` query parameter (JWT or API key)
2. `cv_session` cookie (JWT)
3. `Authorization: Bearer` header (JWT)

**Example Connection**

```javascript
// Web client with session cookie
const ws = new WebSocket('ws://localhost:3001/ws/actions/fetch');

// TUI client with API key
const ws = new WebSocket('ws://localhost:3001/ws/actions/fetch?token=your_api_key');

ws.onopen = () => {
  // Send action request after connection
  ws.send(JSON.stringify({
    application: "2024-03-company-x",
    args: {
      url: "https://example.com/job/123"
    }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`[${msg.type}]: ${msg.data}`);
};

ws.onclose = () => console.log('Stream ended');
```

**Server Messages**

The server sends JSON messages, one per line:

```json
{"type":"stdout","data":"Fetching job description..."}
{"type":"stdout","data":"Parsing HTML..."}
{"type":"stderr","data":"Warning: timeout in 30s"}
{"type":"exit","data":"0"}
```

| Type | Data | Description |
|------|------|-------------|
| `stdout` | string | Standard output line from the Make target |
| `stderr` | string | Standard error line from the Make target |
| `exit` | string | Exit code when process terminates |
| `error` | string | API-level error (e.g., "target timeout exceeded") |

**Message Sequence**

A typical stream looks like:

1. Connection established (HTTP 101 Upgrade)
2. Client sends action request (JSON)
3. Server sends 0+ `stdout`/`stderr` messages
4. Server sends `exit` message with code
5. Connection closes

**Example Bash Usage**

```bash
#!/bin/bash

# Using websocat (install: brew install websocat)
echo '{"args":{"url":"https://example.com"}}' | \
  websocat -H "X-API-Key: your_api_key" \
  ws://localhost:3001/ws/actions/fetch
```

**Connection Lifetime**

The connection closes when:
- The Make process exits
- Target timeout is exceeded
- An error occurs
- Client closes the connection

Timeouts are per-target, configured in `config/targets.yml` (default 120s, max 600s).

---

## Error Handling

All error responses follow a consistent format:

```json
{
  "code": 403,
  "message": "Target 'dangerous-target' is not in the allowlist"
}
```

### Error Codes

| HTTP Code | Meaning | Common Causes |
|-----------|---------|---------------|
| 400 | Bad Request | Missing fields, invalid arguments, invalid application name |
| 401 | Unauthorized | Invalid credentials, expired token, missing authentication |
| 403 | Forbidden | Target not in allowlist, insufficient permissions |
| 404 | Not Found | Resource doesn't exist (application, job) |
| 409 | Conflict | Resource already exists (application) |
| 429 | Too Many Requests | Rate limit exceeded (per IP or per token) |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Executor overloaded or unavailable |

---

## Rate Limiting

Rate limits are enforced per IP and per token:

| Scope | Limit | Response |
|-------|-------|----------|
| Login attempts | 5/min per IP | 429 + `Retry-After` header |
| General API requests | 10/s per IP | 429 + `Retry-After` header |
| Authenticated requests | 30/s per token | 429 + `Retry-After` header |
| Concurrent Make jobs | 3 global (configurable) | 429 + message |

All 429 responses include a `Retry-After` header indicating seconds to wait before retrying.

**Example Retry Logic**

```bash
retry_with_backoff() {
  local max_attempts=5
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    response=$(curl -s -w "\n%{http_code}" "$@")
    code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$code" = "429" ]; then
      wait_time=$(echo "$body" | jq -r '.["Retry-After"]' // 1)
      sleep "$wait_time"
      ((attempt++))
    else
      echo "$body"
      return 0
    fi
  done

  echo "Max retries exceeded" >&2
  return 1
}

retry_with_backoff http://localhost:3001/api/applications
```

---

## Examples

### Complete Application Creation Workflow

```bash
#!/bin/bash

API_KEY="your_api_key"
API_BASE="http://localhost:3001"

# 1. Create application
echo "Creating application..."
app_response=$(curl -s -X POST "$API_BASE/api/applications" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "company": "Company X",
    "position": "Senior Engineer",
    "url": "https://example.com/jobs/123"
  }')

app_name=$(echo "$app_response" | jq -r '.name')
echo "Created: $app_name"

# 2. Execute fetch target
echo "Fetching job description..."
job_response=$(curl -s -X POST "$API_BASE/api/actions/fetch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "application": "'$app_name'",
    "args": {
      "url": "https://example.com/jobs/123"
    }
  }')

job_id=$(echo "$job_response" | jq -r '.job_id')
echo "Job ID: $job_id"

# 3. Poll for completion
echo "Waiting for job to complete..."
while true; do
  status_response=$(curl -s "$API_BASE/api/actions/jobs/$job_id" \
    -H "X-API-Key: $API_KEY")

  status=$(echo "$status_response" | jq -r '.status')
  echo "Status: $status"

  if [ "$status" != "running" ]; then
    exit_code=$(echo "$status_response" | jq -r '.exit_code')
    if [ "$exit_code" = "0" ]; then
      echo "Success!"
      echo "$status_response" | jq '.stdout'
    else
      echo "Failed with exit code $exit_code"
      echo "$status_response" | jq '.stderr'
    fi
    break
  fi

  sleep 1
done
```

### WebSocket Streaming with Python

```python
import asyncio
import json
import websockets

async def stream_action():
    uri = "ws://localhost:3001/ws/actions/tailor?token=your_api_key"

    async with websockets.connect(uri) as websocket:
        # Send action request
        request = {
            "application": "2024-03-company-x",
            "args": {}
        }
        await websocket.send(json.dumps(request))

        # Receive streaming messages
        async for message in websocket:
            msg = json.loads(message)
            msg_type = msg.get("type")
            data = msg.get("data")

            if msg_type == "stdout":
                print(f"[OUT] {data}")
            elif msg_type == "stderr":
                print(f"[ERR] {data}")
            elif msg_type == "exit":
                print(f"[EXIT] {data}")
                break

asyncio.run(stream_action())
```

