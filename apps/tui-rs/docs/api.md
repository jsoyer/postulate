# API Client Reference

The cv-tui-rs TUI communicates exclusively with the [cv-api](https://github.com/jsoyer/cv-api) backend via HTTP and WebSocket.

## Configuration

Configure the API connection in `~/.config/cv/config.toml`:

```toml
[api]
base_url = "http://localhost:3001"
api_key = "your-api-key-here"
timeout_secs = 30
```

Or override with environment variables:

```bash
CV_API_URL=http://custom.server:3001 \
CV_API_KEY=custom-key \
CV_TIMEOUT=60 \
cv-rs
```

## Features

### TTL Caching

The API client caches responses to reduce network calls:

| Endpoint | TTL |
|----------|-----|
| `GET /api/applications` | 60s |
| `GET /api/dashboard` | 60s |
| `GET /api/stats` | 60s |
| `GET /api/targets` | 300s |

Manual cache invalidation isn't needed — stale data is automatically refreshed after expiry.

### Retry Logic

Failed API calls are automatically retried up to 3 times with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: After 500ms
- Attempt 3: After 1s
- Attempt 4: After 2s

Only transient errors (network timeouts, 5xx responses) trigger retries. 4xx errors fail immediately.

### WebSocket Streaming

Action execution streams output in real-time via WebSocket connection to `ws://api-url/api/actions/:action-name`

## Endpoints

### Health Check

**Endpoint**: `GET /api/health`

Check if the API server is running. Called on startup and periodically.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T12:34:56Z"
}
```

### List Applications

**Endpoint**: `GET /api/applications`

Get all CV applications.

**Response**:
```json
{
  "applications": [
    {
      "name": "acme-software-engineer",
      "company": "Acme Corp",
      "position": "Software Engineer",
      "status": "applied",
      "url": "https://jobs.acme.com/posts/se-001",
      "created_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

**Cache**: 60 seconds

### Get Application

**Endpoint**: `GET /api/applications/:name`

Get details for a specific application.

**Response**:
```json
{
  "name": "acme-software-engineer",
  "company": "Acme Corp",
  "position": "Software Engineer",
  "status": "applied",
  "url": "https://jobs.acme.com/posts/se-001",
  "created_at": "2026-03-01T10:00:00Z",
  "meta": {
    "tags": ["startup", "remote"],
    "salary_range": "$150k-$180k",
    "notes": "Initial contact made on 2026-03-02"
  }
}
```

### Create Application

**Endpoint**: `POST /api/applications`

Create a new CV application.

**Request**:
```json
{
  "company": "Acme Corp",
  "position": "Software Engineer",
  "url": "https://jobs.acme.com/posts/se-001"
}
```

**Response**: Same as Get Application

**Headers**: `Authorization: Bearer {api_key}`

### Get Dashboard

**Endpoint**: `GET /api/dashboard`

Get summary statistics for the dashboard view.

**Response**:
```json
{
  "total_applications": 42,
  "applications_by_status": {
    "applied": 15,
    "interview": 8,
    "offer": 2,
    "rejected": 12,
    "ghosted": 5
  },
  "recent_activity": [
    {
      "application": "acme-software-engineer",
      "action": "status_changed",
      "to_status": "interview",
      "timestamp": "2026-03-10T14:30:00Z"
    }
  ]
}
```

**Cache**: 60 seconds

### Get Statistics

**Endpoint**: `GET /api/stats`

Get detailed statistics for the stats view.

**Response**:
```json
{
  "total_applications": 42,
  "applications_by_status": { ... },
  "applications_by_company": {
    "Acme Corp": 5,
    "TechCorp": 3,
    ...
  },
  "average_response_time_days": 7,
  "success_rate_percent": 15
}
```

**Cache**: 60 seconds

### List Targets

**Endpoint**: `GET /api/targets`

Get available action targets (actions that can be executed).

**Response**:
```json
{
  "targets": [
    {
      "name": "tailor",
      "description": "Tailor CV for this position",
      "timeout_secs": 30
    },
    {
      "name": "review",
      "description": "Review CV for this position",
      "timeout_secs": 60
    },
    {
      "name": "build",
      "description": "Build artifacts (PDF, HTML)",
      "timeout_secs": 45
    },
    {
      "name": "score",
      "description": "Score against job description (ATS)",
      "timeout_secs": 30
    },
    {
      "name": "prep",
      "description": "Generate interview prep notes",
      "timeout_secs": 60
    },
    {
      "name": "audit",
      "description": "Run CV health audit",
      "timeout_secs": 120
    }
  ]
}
```

**Cache**: 300 seconds

### Execute Action

**Endpoint**: `POST /api/actions/:action-name`

Trigger an action (non-streaming, waits for completion).

**Request**:
```json
{
  "application": "acme-software-engineer"
}
```

**Response**:
```json
{
  "action": "tailor",
  "application": "acme-software-engineer",
  "status": "completed",
  "output": "CV tailored successfully",
  "duration_secs": 5,
  "timestamp": "2026-03-10T15:00:00Z"
}
```

### Stream Action (WebSocket)

**Endpoint**: `GET ws://api-url/api/actions/:action-name/stream`

Stream action output in real-time.

**Request** (after connection):
```json
{
  "application": "acme-software-engineer"
}
```

**Messages** (each line is a separate WebSocket text message):
```
Starting tailor...
Processing CV...
Generating tailored version...
Tailoring complete!
```

**Connection**: Stays open until action completes, then sends close frame.

## Error Handling

### Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Application not found",
  "code": "NOT_FOUND",
  "timestamp": "2026-03-10T15:00:00Z"
}
```

**HTTP Status Codes**:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (missing/invalid API key) |
| 404 | Not found (application doesn't exist) |
| 429 | Rate limited (too many requests) |
| 500 | Server error (temporary) |
| 503 | Service unavailable |

### Client Behavior

- **4xx errors**: Fail immediately, display error message
- **5xx errors**: Retry with exponential backoff
- **Network timeouts**: Retry with backoff
- **WebSocket disconnect**: Show error, allow manual retry

## Security

### Authentication

All requests include the API key in the `Authorization` header:

```
Authorization: Bearer {api_key}
```

The API key is read from:
1. `~/.config/cv/config.toml` (default)
2. `CV_API_KEY` environment variable (override)
3. CLI flag `--api-key` (highest priority)

Never commit API keys to version control. Use environment variables in CI/CD.

### TLS/HTTPS

For production deployments, always use HTTPS:

```bash
CV_API_URL=https://api.example.com cv-rs
```

Self-signed certificates are supported by setting `RUSTLS_CERTIFICATE_COMPRESSION=false` if needed.

## Performance Notes

### Caching Benefits

With TTL caching enabled, typical workflows don't require API calls:

- Viewing applications list: 1 call per 60 seconds
- Viewing dashboard: 1 call per 60 seconds
- Navigation: 0 calls (uses cached data)

This reduces API load by ~95% for typical usage patterns.

### Rate Limiting

The cv-api server may implement rate limiting. If you hit it, back off and retry. The client does this automatically.

### Timeout Configuration

Default timeout is 30 seconds. For slow networks or servers, increase it:

```bash
CV_TIMEOUT=120 cv-rs
```

## Troubleshooting

### "Connection refused"

The API server is not running or the URL is incorrect.

```bash
# Check the configured URL
cat ~/.config/cv/config.toml

# Test connectivity
curl http://localhost:3001/api/health

# Override the URL
CV_API_URL=http://correct-host:3001 cv-rs
```

### "Unauthorized"

The API key is missing or invalid.

```bash
# Check the configured key
cat ~/.config/cv/config.toml

# Verify with curl
curl -H "Authorization: Bearer YOUR_KEY" http://localhost:3001/api/health

# Override the key
CV_API_KEY=your-valid-key cv-rs
```

### "Request timeout"

The API server is too slow or unreachable.

```bash
# Increase timeout
CV_TIMEOUT=120 cv-rs

# Check server health
curl -v http://localhost:3001/api/health
```

## Integration Testing

To test the API client locally without a full cv-api server:

```bash
# Use the mock server (requires cv-api repo)
cd /path/to/cv-api
make mock-server

# In another terminal
cv-rs
```

Or test specific endpoints:

```bash
# Health check
curl http://localhost:3001/api/health

# List applications
curl -H "Authorization: Bearer test-key" \
  http://localhost:3001/api/applications
```
