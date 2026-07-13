# Architecture

## System Overview

The CV management system is a distributed application where cv-api serves as the central hub for all Make target execution. It implements a clear separation of concerns: the CV project holds data and logic, cv-api handles HTTP/WebSocket exposure and resource management, and clients (web, TUI) are pure presentation layers.

```
┌──────────────────────────────────────────────────────┐
│            CV (cv-core)                              │
│  Python scripts + Makefile + YAML + applications/    │
│  Source of truth: data, AI pipelines, computations   │
└──────────────────┬───────────────────────────────────┘
                   │
      ┌────────────▼─────────────┐
      │ exec.Command("make", ...) │
      │ filesystem reads/writes   │
      │ timeout & context cancel  │
      └────────────┬─────────────┘
                   │
       ┌───────────▼────────────┐
       │    cv-api (this)       │
       │  Go HTTP/WebSocket     │
       │  Authentication        │
       │  Rate limiting         │
       │  Job management        │
       │  Streaming             │
       └───┬────────┬────────┬──┘
           │        │        │
    ┌──────▼┐  ┌────▼────┐  │
    │cv-web │  │cv-tui-* │  │ External clients
    │Next.js│  │Go/Rust  │  │ (bots, integrations)
    └───────┘  └─────────┘  │
                             └──────────────────────┐
                                                    │
                   ┌───────────────────────────────┴───┐
                   │ Pure presentation layers          │
                   │ No direct CV filesystem access    │
                   │ All execution through cv-api      │
                   └───────────────────────────────────┘
```

## Design Principles

### Single Execution Surface

Only cv-api executes Make targets. This design ensures:

- **Centralized Control**: One place to audit, rate-limit, and secure all Make invocations
- **Uniform Resource Management**: All jobs share a global concurrency limit and timeout enforcement
- **Consistent Logging**: All executions logged uniformly for debugging and compliance
- **Easy Scaling**: Add more API instances in front of a shared CV filesystem (read-only or with locking)

### Defense in Depth

Security is layered, not binary. Each layer is independent and provides value even if others fail.

### Stateless HTTP

cv-api is stateless (except for in-memory job tracking). This allows:

- Horizontal scaling (multiple cv-api instances)
- Easy deployment (no persistent storage required)
- Simple restart/recovery (only in-flight jobs are lost)

### Clients are Thin

Clients (cv-web, cv-tui-*) are thin presentation layers:

- No direct filesystem access
- No direct Make invocation
- All business logic delegated to cv-api
- Authentication/authorization enforced server-side

---

## Package Structure

```
cv-api/
├── cmd/cv-api/
│   └── main.go              Initialize config, set up services, start server
│
├── internal/
│   ├── auth/
│   │   ├── auth.go          JWT validation, API key validation, TOTP verification
│   │   └── auth_test.go     Authentication tests
│   │
│   ├── config/
│   │   └── config.go        Load env vars, parse targets.yml, validate config
│   │
│   ├── executor/
│   │   ├── executor.go      Make target execution, job tracking, timeouts
│   │   └── executor_test.go Execution tests
│   │
│   ├── handlers/
│   │   ├── router.go        Route setup, middleware chain
│   │   ├── auth.go          /api/auth/* handlers
│   │   ├── applications.go  /api/applications/* handlers
│   │   ├── actions.go       /api/actions/* handlers
│   │   ├── ws.go            WebSocket upgrade and streaming
│   │   ├── stats.go         /api/stats, /api/dashboard handlers
│   │   ├── settings.go      /api/settings handlers
│   │   ├── health.go        /health handler
│   │   ├── respond.go       Response helpers (JSON encoding)
│   │   └── handlers_test.go Integration tests
│   │
│   ├── middleware/
│   │   └── middleware.go    Auth, rate limiting, CORS, logging, security headers
│   │
│   ├── models/
│   │   └── models.go        Request/response types, target config
│   │
│   ├── storage/
│   │   └── storage.go       Read applications/, parse YAML, read files
│   │
│   └── ...
│
├── pkg/cvtypes/
│   └── types.go             Exported types for TUI clients (shared with cv-tui-go)
│
├── config/
│   ├── targets.example.yml  Template for target allowlist
│   └── targets.yml          (user-created) Allowed Make targets
│
├── caddy/
│   └── Caddyfile            Reverse proxy config for production HTTPS
│
├── docs/
│   ├── api.md               Full API reference
│   ├── auth.md              Authentication flows
│   ├── architecture.md      This file
│   ├── deployment.md        Production setup
│   ├── security.md          Threat model & security practices
│   └── development.md       Developer guide
│
├── Dockerfile               Multi-stage production image
├── docker-compose.yml       Local development environment
├── Makefile                 Build commands
├── go.mod / go.sum          Dependencies
└── README.md                Project overview
```

## Key Packages

### `auth` — Authentication & Authorization

Implements JWT and API key validation with optional TOTP 2FA.

**Responsibilities**:
- Validate login credentials (username/password)
- Issue JWT tokens with configurable expiry
- Validate JWT tokens (HS256 only, algorithm check)
- Validate API keys (constant-time comparison)
- Verify TOTP codes (time-based OTP, ±1 step tolerance)
- Extract credentials from requests (header, cookie, query param)

**Key Functions**:
- `ValidateLogin()` — Check username/password/TOTP
- `IssueJWT()` — Create signed JWT token
- `ValidateJWT()` — Parse and verify JWT
- `ValidateAPIKey()` — Check API key against allowlist
- `ExtractCredentials()` — Find auth in request

**Security**:
- Constant-time comparison for passwords and keys (prevents timing attacks)
- HS256 only (algorithm confusion prevention)
- httpOnly cookies (XSS protection)
- SameSite=Strict (CSRF protection)

### `config` — Configuration Loading

Loads and validates all configuration from environment variables and YAML.

**Responsibilities**:
- Load environment variables (with fallbacks)
- Parse `config/targets.yml` (target allowlist)
- Validate required values (CV_PATH, AUTH_SECRET, etc.)
- Initialize timeout limits and rate limits

**Validation**:
- CV_PATH must exist and be a directory
- AUTH_SECRET must be ≥32 characters
- AUTH_PASSWORD must be provided
- targets.yml must define at least one target

### `executor` — Make Target Execution

Safely runs Make targets with comprehensive security and resource controls.

**Responsibilities**:
- Execute Make targets via `exec.CommandContext` (no shell)
- Track job lifecycle (running → completed/failed/cancelled)
- Enforce per-target timeouts
- Enforce global concurrency limits (semaphore)
- Validate application names (path traversal prevention)
- Stream stdout/stderr output
- Store job results for polling

**Key Functions**:
- `Execute()` — Start a Make target, acquire semaphore, set timeout, capture output
- `Status()` — Retrieve job result (blocking if still running)
- `Stream()` — Get line-by-line output stream for WebSocket

**Security**:
- `exec.Command` with separate arguments (no shell interpolation)
- Working directory locked to CV_PATH
- Application names validated against `[a-zA-Z0-9._-]` regex
- No `..` in names (path traversal prevention)
- Per-target timeout enforcement via `context.WithTimeout`
- Global semaphore (default 3 concurrent jobs)

**Concurrency**:
- Uses `sync.RWMutex` for job tracking
- Semaphore channel for global concurrency control
- Context cancellation for timeout enforcement

### `handlers` — HTTP Request Handling

Implements all HTTP endpoints and WebSocket streaming.

**Route Groups**:

1. **Public** (no auth):
   - `GET /health` — Liveness probe

2. **Auth Routes** (rate-limited):
   - `POST /api/auth/login` — Authenticate
   - `POST /api/auth/logout` — Clear session

3. **Protected** (JWT/API key required):
   - Applications: List, get detail, create
   - Actions: Execute target, poll job, list targets
   - Analytics: Dashboard, stats
   - Settings: Get, update

4. **WebSocket**:
   - `WS /ws/actions/{target}` — Stream output

**Key Handlers**:
- `AuthHandler` — Login/logout
- `ApplicationsHandler` — Application CRUD
- `ActionsHandler` — Target execution
- `StatsHandler` — Analytics
- `WSHandler` — WebSocket streaming
- `SettingsHandler` — User preferences

### `middleware` — Request Processing

Applies cross-cutting concerns to all requests.

**Middleware Chain** (in order):
1. `SecurityHeaders` — Add security headers (X-Frame-Options, etc.)
2. `CORS` — Handle cross-origin requests
3. `Logger` — Log all requests
4. `RateLimit` — Per-IP rate limiting (10 req/s)
5. `RequestSize` — Limit body size (1 MB)
6. `Auth` — Validate credentials (protected routes only)
7. `LoginRateLimit` — Separate limit for login (5 attempts/min)

### `storage` — Filesystem Access

Reads applications/ directory and parses YAML files.

**Responsibilities**:
- List applications from `CV_PATH/applications/`
- Read application metadata (meta.yml)
- Read application files (job.txt, cv-tailored.yml, etc.)
- Parse YAML safely
- Validate application names

**Thread Safety**: Read-only operations, immutable data, suitable for concurrent access.

---

## Request Lifecycle

### Polling Workflow (POST then GET)

```
Client                              cv-api                 CV project
  │                                  │                          │
  │ POST /api/actions/{target}        │                          │
  │ { application, args }             │                          │
  │─────────────────────────────────>│                          │
  │                                  │ Authenticate             │
  │                                  │ Validate target          │
  │                                  │ Check allowlist          │
  │                                  │ Acquire semaphore        │
  │                                  │                          │
  │ 202 { job_id, status }           │ exec.Command("make", ...) │
  │<─────────────────────────────────│────────────────────────>│
  │                                  │                          │
  │ (client does other things)       │ (job running)            │
  │                                  │ (collecting output)      │
  │                                  │                          │
  │ GET /api/actions/jobs/{job_id}   │ stdout/stderr stream     │
  │────────────────────────────────>│<────────────────────────│
  │                                  │                          │
  │ (job still running)              │ (still collecting)       │
  │ 200 { status: "running" }        │                          │
  │<─────────────────────────────────│                          │
  │                                  │                          │
  │ (wait and retry)                 │ (process completes)      │
  │                                  │ Release semaphore        │
  │                                  │ Store results            │
  │                                  │                          │
  │ GET /api/actions/jobs/{job_id}   │                          │
  │────────────────────────────────>│                          │
  │ 200 { status: "completed",       │                          │
  │       stdout, exit_code: 0 }     │                          │
  │<─────────────────────────────────│                          │
```

### WebSocket Streaming Workflow

```
Client                              cv-api                 CV project
  │                                  │                          │
  │ WS /ws/actions/{target}           │                          │
  │ (with token or cookie)            │                          │
  │─────────────────────────────────>│                          │
  │                                  │ Authenticate             │
  │                                  │ Validate target          │
  │                                  │ 101 Upgrade             │
  │<─────────────────────────────────│                          │
  │                                  │                          │
  │ { application, args }             │                          │
  │─────────────────────────────────>│                          │
  │                                  │ Check allowlist          │
  │                                  │ Acquire semaphore        │
  │                                  │ exec.Command("make", ...) │
  │                                  │────────────────────────>│
  │                                  │                          │
  │                                  │ (stdout line)            │
  │ {"type":"stdout","data":"..."}   │                          │
  │<─────────────────────────────────│<────────────────────────│
  │                                  │ (stdout line)            │
  │ {"type":"stdout","data":"..."}   │                          │
  │<─────────────────────────────────│<────────────────────────│
  │                                  │                          │
  │                                  │ (stderr line)            │
  │ {"type":"stderr","data":"..."}   │                          │
  │<─────────────────────────────────│<────────────────────────│
  │                                  │                          │
  │                                  │ (process exits)          │
  │ {"type":"exit","data":"0"}       │                          │
  │<─────────────────────────────────│                          │
  │                                  │ Release semaphore        │
  │                                  │                          │
  │ (close connection)               │                          │
  │─────────────────────────────────>│                          │
```

---

## Data Flow Diagrams

### Read Flow (e.g., GET /api/applications)

```
HTTP Request
    │
    ├─> Middleware
    │   ├─ CORS headers
    │   ├─ Rate limit check
    │   └─ Auth validation
    │
    ├─> Handler (applicationsHandler.List)
    │   └─ Extract query params
    │
    ├─> Storage.ListApplications()
    │   ├─ Read applications/ directory
    │   ├─ Parse meta.yml for each app
    │   └─ Validate names
    │
    ├─> Sort & filter in-memory
    │
    └─> HTTP Response (JSON array)
        └─ 200 OK
```

### Write Flow (e.g., POST /api/actions/{target})

```
HTTP Request (with auth)
    │
    ├─> Middleware
    │   ├─ Auth validation
    │   └─ Rate limit check
    │
    ├─> Handler (actionsHandler.Execute)
    │   ├─ Validate target in allowlist
    │   ├─ Validate required args
    │   └─ Validate application name
    │
    ├─> Executor.Execute()
    │   ├─ Acquire semaphore (with timeout)
    │   │   └─ 429 if queue full
    │   │
    │   ├─ Create job context
    │   │   └─ Set timeout (default 120s)
    │   │
    │   ├─> exec.CommandContext("make", target, args...)
    │   │   ├─ Set working directory to CV_PATH
    │   │   └─ Capture stdout/stderr
    │   │
    │   ├─ Goroutine: Read output stream
    │   │   └─ Buffer stdout/stderr
    │   │
    │   ├─ Wait for process exit or timeout
    │   │
    │   ├─ Store job result (in-memory)
    │   │
    │   └─ Release semaphore
    │
    └─> HTTP Response (202 Accepted)
        └─ { job_id, target, status: "running" }
```

### Stream Flow (WebSocket)

```
WebSocket Upgrade
    │
    ├─> Auth check (cookie or token)
    │
    ├─> Validate target + arguments
    │
    ├─> Executor.Stream()
    │   ├─ Acquire semaphore
    │   ├─ Start process
    │   └─ Create output channel
    │
    ├─> Goroutine: Read from process stdout/stderr
    │   └─ Send line → channel (per-line buffering)
    │
    ├─> Goroutine: Read from channel, send to client
    │   └─ JSON encode and write to WebSocket
    │
    ├─ (on process exit)
    │   ├─ Send {"type":"exit","data":"0"}
    │   └─ Release semaphore
    │
    └─> Close connection
```

---

## Security Architecture

### Layer 1: Network

- cv-api runs behind Caddy reverse proxy in production
- Caddy terminates TLS (cvapi itself doesn't need TLS)
- Internal Docker network between services (not exposed)
- No direct external access to cv-api port 3001

### Layer 2: Authentication

- **JWT**: Web clients authenticate via username/password, receive JWT in httpOnly cookie
- **API Key**: TUI clients use static keys in `X-API-Key` header
- **2FA**: Optional TOTP code during login
- **Constant-time comparison**: Passwords and keys compared safely to prevent timing attacks

### Layer 3: Authorization

- **Target Allowlist**: Only targets in `config/targets.yml` can execute
- **Per-target arguments**: Required arguments validated per target
- **No implicit permissions**: Default deny, only listed targets allowed

### Layer 4: Execution Safety

- **No shell**: `exec.Command` with separate args (no `sh -c`)
- **Working directory**: Locked to CV_PATH, no `cd` to other directories
- **Path validation**: Application names must match `[a-zA-Z0-9._-]` (no `..`, no `/`)
- **Timeouts**: Per-target timeout (default 120s, enforced via context cancellation)
- **Concurrency limits**: Max 3 concurrent jobs (prevents resource exhaustion)

### Layer 5: Input Validation

- **Request size**: Max 1 MB body (prevents DoS via large payloads)
- **Query parameters**: Validated for type and length
- **Application names**: Path traversal prevention (no `..`, no `/`)
- **JSON parsing**: Strict, fails on unknown fields

### Layer 6: Rate Limiting

- **Per-IP**: 10 req/s (prevents brute force)
- **Login**: 5 attempts/min per IP (prevents password guessing)
- **Per-token**: 30 req/s (prevents authenticated abuse)
- **Concurrency**: Max 3 jobs (prevents resource exhaustion)

---

## Concurrency Model

### Job Tracking

- In-memory map (`jobs map[string]*Job`) protected by `sync.RWMutex`
- Each job has a unique UUID (v4) for identification
- Job lifecycle: created → running → completed/failed/cancelled

### Semaphore-Based Concurrency

```go
sem chan struct{} // buffered channel with capacity=MaxConcurrent

// Before execution
select {
case sem <- struct{}{}: // acquire
    defer func() { <-sem }() // release
case <-ctx.Done(): // timeout or cancelled
    return fmt.Errorf("queue timeout")
}
```

This ensures:
- Only N jobs run concurrently (default 3)
- Jobs wait in queue if limit reached
- Queue wait is bounded by timeout

### Timeout Enforcement

```go
ctx, cancel := context.WithTimeout(ctx, targetTimeout)
defer cancel()

cmd := exec.CommandContext(ctx, "make", target, args...)
err := cmd.Run()
// If timeout, ctx.Done() signals and command killed
```

Per-target timeouts are enforced via context cancellation. If timeout is exceeded:
1. Context signals Done()
2. Command receives SIGKILL
3. Goroutines stop reading output
4. Job marked as failed

### Goroutine Patterns

1. **Main Request Goroutine** (HTTP handler)
   - Validates input
   - Acquires semaphore
   - Starts job
   - Returns immediately (202)

2. **Execution Goroutine** (executor)
   - Runs `exec.CommandContext`
   - Collects stdout/stderr
   - Handles timeout/cancellation

3. **Stream Goroutines** (WebSocket)
   - Read from process stdout/stderr
   - Write to output channel
   - Send JSON to client

All goroutines are launched as fire-and-forget with proper cleanup (deferred releases).

---

## Error Handling Strategy

### Categories

1. **Configuration Errors** (startup)
   - Missing CV_PATH → Exit with clear message
   - Invalid targets.yml → Exit with parse error
   - Low AUTH_SECRET → Exit with validation error

2. **Request Validation Errors** (400)
   - Missing required fields → 400 + message
   - Invalid target name → 400 + message
   - Path traversal attempt → 400 + message

3. **Authentication Errors** (401)
   - Invalid credentials → 401 + "Invalid credentials"
   - Expired token → 401 + "Token expired"
   - Missing auth → 401 + "No credentials"

4. **Authorization Errors** (403)
   - Target not in allowlist → 403 + "Not in allowlist"
   - Insufficient permissions → 403 + message

5. **Rate Limit Errors** (429)
   - Per-IP limit → 429 + Retry-After header
   - Per-token limit → 429 + Retry-After header
   - Queue full → 429 + message

6. **Execution Errors** (5xx)
   - Process failed (exit code ≠0) → Job status, stored in job result
   - Timeout → Job status: failed, duration includes timeout
   - Signal killed (SIGKILL) → Job status: cancelled

### Logging

All errors logged with context:
```json
{"level":"ERROR","msg":"auth validation failed","error":"invalid TOTP code","ip":"127.0.0.1"}
{"level":"ERROR","msg":"target not in allowlist","target":"dangerous","user":"api-key-user"}
```

---

## Dependency Graph

```
cmd/main
  ├─ config.Load()
  │   └─ targets.yml (YAML file)
  │
  ├─ auth.NewProvider()
  │   └─ JWT library, TOTP library
  │
  ├─ executor.New()
  │   └─ CV_PATH (filesystem)
  │
  ├─ storage.New()
  │   └─ CV_PATH (filesystem)
  │
  └─ handlers.NewRouter()
      ├─ Chi router framework
      ├─ auth.Provider
      ├─ executor.Executor
      └─ storage.Storage
```

All dependencies are passed via constructor injection (no global state).

---

## Performance Characteristics

- **Request Overhead**: ~1ms per request (JSON parsing, auth check, routing)
- **Job Startup**: ~50ms (fork/exec overhead)
- **Streaming**: Real-time, line-buffered (suitable for live output)
- **Memory**: ~10 MB baseline + job buffers (10 MB per running job for stdout/stderr)
- **Scaling**: Horizontal scaling possible (stateless, shared CV filesystem)

---

## Future Enhancements

- [ ] WebAuthn/Passkeys support for passwordless login
- [ ] Job persistence (database storage for completed jobs)
- [ ] Metrics export (Prometheus)
- [ ] Request tracing (OpenTelemetry)
- [ ] Multi-user support (per-user allowlists)
- [ ] Job scheduling (cron-like targets)
- [ ] Webhooks (notify on job completion)

