# Development Guide

This guide covers setting up a development environment, understanding the codebase, and contributing to cv-api.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Running Tests](#running-tests)
- [Code Style & Conventions](#code-style--conventions)
- [Adding a New Endpoint](#adding-a-new-endpoint)
- [Adding a New Make Target](#adding-a-new-make-target)
- [Debugging](#debugging)
- [CI/CD Pipeline](#cicd-pipeline)

---

## Prerequisites

### System Requirements

- **OS**: Linux, macOS, or Windows (WSL2)
- **Go**: 1.24 or later
- **Make**: GNU Make 4.0+
- **Git**: For version control

### Verify Installation

```bash
go version      # Go 1.24+
make --version  # GNU Make 4.0+
git --version
```

### Optional Tools

For enhanced development experience:

```bash
# Code formatting and linting
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Better formatting
go install mvdan.cc/gofumpt@latest

# JSON queries (useful for testing API)
brew install jq

# API testing
brew install curl
brew install websocat  # For WebSocket testing
```

---

## Project Setup

### 1. Clone Repository

```bash
git clone https://github.com/jsoyer/cv-api.git
cd cv-api
```

### 2. Create Configuration

```bash
cp .env.example .env
cp config/targets.example.yml config/targets.yml
```

### 3. Edit .env

```bash
# Required
CV_PATH=/path/to/your/CV
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_PASSWORD=dev_password

# Optional (for testing)
API_KEYS=$(openssl rand -base64 32)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Verify Go Dependencies

```bash
go mod download
go mod verify
go mod tidy
```

### 5. Run Tests

```bash
make test
```

All tests should pass.

---

## Running Tests

### Test Commands

```bash
# Run all tests
make test

# Run with verbose output
go test ./... -v

# Run specific test package
go test ./internal/auth -v

# Run with race detector (detects concurrency bugs)
go test ./... -race

# Run with coverage
go test ./... -cover
```

### Test Coverage Report

```bash
# Generate coverage report
go test ./... -coverprofile=coverage.out

# View in browser
go tool cover -html=coverage.out

# Show coverage by package
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out
```

### Important Test Packages

| Package | Tests | Coverage Target |
|---------|-------|-----------------|
| `internal/auth` | JWT, API keys, TOTP | >95% |
| `internal/executor` | Job execution, timeouts | >90% |
| `internal/handlers` | HTTP endpoints | >80% |

### Test Structure

Tests follow Go conventions:

```go
// internal/auth/auth_test.go
package auth

import (
    "testing"
)

func TestValidateLogin_Success(t *testing.T) {
    provider := NewProvider(secret, user, pass, "", nil, 7*24*time.Hour)
    err := provider.ValidateLogin("user", "pass", "")
    if err != nil {
        t.Fatalf("expected success, got %v", err)
    }
}

func TestValidateLogin_InvalidPassword(t *testing.T) {
    provider := NewProvider(secret, user, pass, "", nil, 7*24*time.Hour)
    err := provider.ValidateLogin("user", "wrong", "")
    if err == nil {
        t.Fatal("expected error, got nil")
    }
}
```

**Patterns**:
- Test names: `TestFunctionName_Scenario`
- Both success and failure cases
- Table-driven tests for multiple scenarios
- Use `t.Fatalf` for assertion failures

---

## Code Style & Conventions

### Formatting

Go code is automatically formatted. Use:

```bash
# Format single file
gofmt -s filename.go

# Format all files
gofmt -s -w ./internal

# Or use gofumpt (more aggressive)
gofumpt -l -w ./internal

# Check in pre-commit
make fmt
```

### Naming Conventions

**Packages**: Single word, lowercase

```go
package auth       // ✓ Good
package authentication  // ✗ Avoid long names
```

**Functions/Methods**: Exported start with uppercase, unexported lowercase

```go
func (p *Provider) ValidateJWT(token string) error { }  // ✓ Exported
func (p *Provider) validateSignature(token string) bool { }  // ✓ Unexported
```

**Variables**: CamelCase

```go
jwtExpiry := 7 * 24 * time.Hour  // ✓ Good
jwt_expiry := 7 * 24 * time.Hour  // ✗ Avoid snake_case
```

**Constants**: UPPER_CASE for package-level

```go
const (
    DefaultTimeout = 120 * time.Second  // ✓ Good (exported)
    cookieName = "session"              // ✓ Good (unexported)
)
```

### Error Handling

Always handle errors explicitly:

```go
// ✓ Good
result, err := doSomething()
if err != nil {
    return fmt.Errorf("do something: %w", err)
}

// ✗ Avoid
result, _ := doSomething()  // Never silently ignore errors
```

Wrap errors with context:

```go
// ✓ Good
if err := os.Stat(path); err != nil {
    return fmt.Errorf("stat %q: %w", path, err)
}

// ✗ Avoid
if err := os.Stat(path); err != nil {
    return err  // Lost context about what failed
}
```

### Comments

Comment exported symbols and complex logic:

```go
// NewProvider creates an authentication provider with the given configuration.
func NewProvider(secret, username, password string) *Provider {
    return &Provider{
        secret: []byte(secret),
        // ...
    }
}

// validateSignature verifies the JWT signature using the stored secret.
// Uses constant-time comparison to prevent timing attacks.
func (p *Provider) validateSignature(token string) bool {
    // ...
}
```

### Logging

Use structured logging with `slog`:

```go
// ✓ Good
slog.Info("request processed", "user", username, "duration_ms", duration)
slog.Error("auth failed", "reason", "invalid_password", "ip", clientIP)

// ✗ Avoid
fmt.Printf("User %s failed to login\n", username)  // Unstructured, hard to parse
```

### Concurrency

Use appropriate primitives:

```go
// For protecting shared state
mu sync.RWMutex
mu.RLock()      // Read-only access
mu.RUnlock()

// For limiting concurrency
sem chan struct{}
sem <- struct{}{}  // Acquire
defer func() { <-sem }()  // Release

// For context-based cancellation
ctx, cancel := context.WithCancel(parent)
defer cancel()
```

---

## Adding a New Endpoint

### Example: Add `POST /api/applications/{name}/notes`

**Step 1: Define Types** (`internal/models/models.go`)

```go
type AddNotesRequest struct {
    Notes string `json:"notes"`
}

type AddNotesResponse struct {
    Name  string `json:"name"`
    Notes string `json:"notes"`
}
```

**Step 2: Create Handler** (`internal/handlers/applications.go`)

```go
func (h *ApplicationsHandler) AddNotes(w http.ResponseWriter, r *http.Request) {
    appName := chi.URLParam(r, "name")

    var req models.AddNotesRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        Respond(w, http.StatusBadRequest, map[string]string{
            "error": "invalid request body",
        })
        return
    }

    // Validate application exists
    app, err := h.storage.GetApplication(appName)
    if err != nil {
        Respond(w, http.StatusNotFound, map[string]string{
            "error": "application not found",
        })
        return
    }

    // Update notes (e.g., write to file)
    // ...

    Respond(w, http.StatusOK, models.AddNotesResponse{
        Name:  app.Name,
        Notes: req.Notes,
    })
}
```

**Step 3: Register Route** (`internal/handlers/router.go`)

```go
r.Group(func(r chi.Router) {
    r.Use(middleware.Auth(cfg.AuthProvider))

    appsHandler := NewApplicationsHandler(cfg.Storage)
    r.Get("/api/applications", appsHandler.List)
    r.Post("/api/applications", appsHandler.Create)
    r.Get("/api/applications/{name}", appsHandler.Get)
    r.Post("/api/applications/{name}/notes", appsHandler.AddNotes)  // NEW
})
```

**Step 4: Write Tests** (`internal/handlers/handlers_test.go`)

```go
func TestApplicationsHandler_AddNotes(t *testing.T) {
    // Setup
    store := storage.New("/path/to/CV")
    handler := NewApplicationsHandler(store)

    // Test success case
    reqBody := `{"notes":"Important follow-up"}`
    req := httptest.NewRequest("POST", "/api/applications/2024-03-company-x/notes", strings.NewReader(reqBody))
    w := httptest.NewRecorder()

    handler.AddNotes(w, req)

    if w.Code != http.StatusOK {
        t.Fatalf("expected 200, got %d", w.Code)
    }

    var resp models.AddNotesResponse
    json.Unmarshal(w.Body.Bytes(), &resp)
    if resp.Notes != "Important follow-up" {
        t.Errorf("expected notes in response")
    }
}
```

**Step 5: Document in API Reference** (`docs/api.md`)

```markdown
### `POST /api/applications/{name}/notes`

Add notes to an application.

**Request Body**
```json
{
  "notes": "Important follow-up"
}
```

**Response** `200 OK`
```json
{
  "name": "2024-03-company-x",
  "notes": "Important follow-up"
}
```
```

---

## Adding a New Make Target

### Example: Add `publish-blog` Target

**Step 1: Add Target to Allowlist** (`config/targets.yml`)

```yaml
- name: publish-blog
  category: content
  description: "Publish job search blog post"
  args: [topic]
  timeout: 120s
```

**Step 2: Implement in CV Project** (`/path/to/CV/Makefile`)

```makefile
.PHONY: publish-blog
publish-blog:
	@python scripts/publish_blog.py --topic "$(topic)"
```

**Step 3: Test Locally**

```bash
# Start cv-api
make dev

# Call the endpoint
curl -X POST http://localhost:3001/api/actions/publish-blog \
  -H "X-API-Key: your_key" \
  -d '{"args":{"topic":"My Job Search Journey"}}'

# Poll for results
curl http://localhost:3001/api/actions/jobs/JOB_ID \
  -H "X-API-Key: your_key"
```

**Step 4: Or Stream via WebSocket**

```javascript
const ws = new WebSocket('ws://localhost:3001/ws/actions/publish-blog?token=your_key');

ws.onopen = () => {
  ws.send(JSON.stringify({
    args: { topic: "My Job Search Journey" }
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(`[${msg.type}]: ${msg.data}`);
};
```

**Step 5: Update Documentation**

Add to `docs/api.md` in the target list, or document in your project's guides.

---

## Debugging

### Enable Verbose Logging

Edit `cmd/cv-api/main.go`:

```go
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: slog.LevelDebug,  // Changed from LevelInfo
})))
```

Then rebuild:

```bash
make dev
```

All logs will show at DEBUG level.

### Attach Debugger (Delve)

Install Delve:

```bash
go install github.com/go-delve/delve/cmd/dlv@latest
```

Run with debugger:

```bash
dlv debug ./cmd/cv-api
(dlv) break main.main
(dlv) continue
(dlv) next
(dlv) print cfg
(dlv) quit
```

### HTTP Debugging

Log all HTTP requests:

```bash
# Verbose curl
curl -v http://localhost:3001/api/applications -H "X-API-Key: key"

# Use httpie for prettier output (install: brew install httpie)
http GET http://localhost:3001/api/applications X-API-Key:key

# Follow redirects
curl -L http://localhost:3001/...
```

### Memory & Goroutine Profiling

```bash
# Add pprof to code (optional)
import _ "net/http/pprof"

# CPU profiling
curl http://localhost:6060/debug/pprof/profile?seconds=30 > cpu.prof
go tool pprof cpu.prof

# Memory profiling
curl http://localhost:6060/debug/pprof/heap > mem.prof
go tool pprof mem.prof
```

---

## CI/CD Pipeline

### Local Pre-Commit Checks

Run before committing:

```bash
# Format code
make fmt

# Run linter
make lint

# Run tests
make test
```

### GitHub Actions (Planned)

Example `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-go@v4
        with:
          go-version: '1.24'

      - run: go mod download
      - run: make test
      - run: make lint
```

---

## Common Tasks

### Updating Dependencies

```bash
# Check for updates
go get -u all

# Download new versions
go mod download

# Verify
go mod verify

# Tidy
go mod tidy

# Commit
git add go.mod go.sum
git commit -m "chore: update dependencies"
```

### Generating API Documentation

API documentation is manually maintained in `docs/api.md`. Keep in sync with code changes.

### Local vs Production Behavior

Some differences between `make dev` and Docker:

| Aspect | Dev | Docker |
|--------|-----|--------|
| Reload | Hot reload enabled | No reload, must rebuild |
| Logging | Console | stdout (JSON) |
| Secrets | .env file | Environment vars |
| Working Dir | Project directory | Container filesystem |

### Troubleshooting

**"CV_PATH does not exist"**
```bash
export CV_PATH=/actual/path/to/CV
make dev
```

**"Target not in allowlist"**
```bash
# Verify targets.yml exists and is valid YAML
cat config/targets.yml
```

**"Tests fail with race condition"**
```bash
# Run with race detector
go test ./... -race -v

# Check for unlocked shared state
# Look for map, slice, or struct without mutex
```

**"Memory leak in long-running server"**
```bash
# Profile memory usage
curl http://localhost:6060/debug/pprof/heap > mem.prof
go tool pprof mem.prof
# Look for growing allocations
```

---

## Code Review Checklist

When reviewing code:

- [ ] **Functionality**: Does it work as intended?
- [ ] **Tests**: Are there tests? Do they pass?
- [ ] **Security**: No hardcoded secrets, SQL injection, path traversal, etc.?
- [ ] **Error Handling**: Are errors handled properly and logged?
- [ ] **Concurrency**: Are goroutines properly managed? Any race conditions?
- [ ] **Performance**: Any obvious inefficiencies? Memory leaks?
- [ ] **Style**: Consistent with project conventions?
- [ ] **Documentation**: Exported symbols documented? Complex logic explained?
- [ ] **Dependencies**: Any unnecessary dependencies added?
- [ ] **Backwards Compatibility**: Does it break existing code/API?

---

## Further Learning

- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Go Best Practices](https://golang.org/doc/effective_go)
- [Chi Router Documentation](https://github.com/go-chi/chi)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)

