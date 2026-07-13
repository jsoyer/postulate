# Security Architecture

This document outlines cv-api's security model, threat model, and security practices.

## Table of Contents

- [Security Overview](#security-overview)
- [Threat Model](#threat-model)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [Execution Safety](#execution-safety)
- [Rate Limiting](#rate-limiting)
- [HTTP Security](#http-security)
- [Secrets Management](#secrets-management)
- [Dependency Security](#dependency-security)
- [Security Headers](#security-headers)
- [Reporting Vulnerabilities](#reporting-vulnerabilities)

---

## Security Overview

cv-api implements defense-in-depth security with 6 independent layers. Each layer is designed to prevent specific attack vectors:

```
Layer 1: Network    ← TLS termination, firewall
Layer 2: Auth       ← JWT + API keys, optional TOTP
Layer 3: Authz      ← Target allowlist
Layer 4: Exec       ← No shell, timeout, concurrency limits
Layer 5: Validation ← Input validation, path traversal prevention
Layer 6: Limits     ← Rate limiting, request size limits
```

**Key Principle**: No single layer failure should compromise the system. Each layer provides independent protection.

---

## Threat Model

### Assets

1. **CV Data**: Applications, job descriptions, tailored CVs, interview notes
2. **Credentials**: Username/password, API keys, TOTP secrets
3. **Compute**: CV project filesystem, Make target execution
4. **Intellectual Property**: AI scripts, custom prompts

### Threats & Mitigations

#### 1. Unauthorized Access (Authentication)

**Threat**: Attacker gains access to CV data or executes arbitrary Make targets

**Mitigations**:
- JWT for web clients (7-day expiry, httpOnly cookies)
- API keys for TUI clients (constant-time comparison)
- Optional TOTP 2FA for enhanced security
- Rate limiting on login attempts (5/min per IP)

**Residual Risk**: Weak password or leaked API key allows access

**Mitigation**: User responsible for strong passwords; rotate keys regularly

---

#### 2. Privilege Escalation (Authorization)

**Threat**: Authenticated user executes targets not in allowlist

**Mitigations**:
- Target allowlist in `config/targets.yml` is mandatory
- All targets validated before execution
- No implicit permissions; default deny
- Centralized authorization in executor

**Residual Risk**: Misconfigured allowlist allows dangerous targets

**Mitigation**: Review allowlist before deployment; audit regularly

---

#### 3. Shell Injection / Code Execution

**Threat**: Attacker injects shell commands via application name or arguments

**Example Attack**:
```bash
# Attacker submits malicious application name
app_name = "'; rm -rf /"

# If vulnerable code runs:
os.system(f"make tailor app={app_name}")  # VULNERABLE!
# Executes: make tailor app='; rm -rf /
```

**Mitigations**:
- Use `exec.Command` with separate arguments (never shell)
- Application names validated against strict regex: `[a-zA-Z0-9._-]`
- No `..` in names (path traversal prevention)
- Working directory locked to CV_PATH

**Residual Risk**: Zero-day in Go stdlib (extremely unlikely)

**Mitigation**: Regular security updates of Go runtime

---

#### 4. Path Traversal / Directory Escape

**Threat**: Attacker accesses files outside CV project

**Example Attack**:
```bash
# Attacker submits malicious application name
app_name = "../../../etc/passwd"

# If vulnerable code runs:
read_file(f"{cv_path}/{app_name}/meta.yml")
# Accesses: /path/to/CV/../../../etc/passwd = /etc/passwd
```

**Mitigations**:
- Application names validated against `^[a-zA-Z0-9._-]{1,128}$`
- Explicit check for `..` in names
- Working directory locked to CV_PATH
- No symlink following (implicit in Go filesystem APIs)

**Residual Risk**: TOCTOU (time-of-check to time-of-use) race condition

**Mitigation**: Single-threaded access pattern; filesystem immutable in production

---

#### 5. Denial of Service (Resource Exhaustion)

**Threat**: Attacker exhausts CPU, memory, or file descriptors

**Example Attacks**:
- Trigger 1000 concurrent Make jobs → memory exhaustion
- Send 1 MB+ request bodies → memory exhaustion
- Send infinite requests → CPU exhaustion

**Mitigations**:
- Global concurrency limit (default 3 jobs)
- Per-target timeout (default 120s, max 600s)
- Request body size limit (1 MB)
- Per-IP rate limiting (10 req/s)
- Per-token rate limiting (30 req/s)

**Residual Risk**: Slowloris attack (slow-upload DoS)

**Mitigation**: Reverse proxy (Caddy) timeout configuration

---

#### 6. Session Hijacking / Token Theft

**Threat**: Attacker steals JWT and impersonates user

**Mitigations**:
- Tokens in httpOnly cookies (JavaScript can't access)
- Cookies marked SameSite=Strict (prevents CSRF)
- Cookies marked Secure (HTTPS only)
- 7-day expiry (limits lifetime of stolen token)
- HTTPS in production (prevents interception)

**Residual Risk**: Memory disclosure in server, password reuse, phishing

**Mitigation**: Secure coding practices, user education, password managers

---

#### 7. Rate Limit Bypass

**Threat**: Attacker bypasses rate limits via distributed requests or spoofed IPs

**Mitigations**:
- Per-IP rate limiting (using X-Forwarded-For from trusted proxy)
- Per-token rate limiting
- Login attempts separately rate limited
- Exponential backoff in clients

**Residual Risk**: Distributed attack from many IPs

**Mitigation**: Reverse proxy (Caddy) with advanced rate limiting; WAF; DDoS protection

---

#### 8. Dependency Vulnerabilities

**Threat**: Vulnerable third-party library exploited

**Example**: JWT library has timing attack vulnerability

**Mitigations**:
- Minimal dependencies (only essential libraries)
- Regular `go mod tidy` and security audits
- Use vetted, well-maintained libraries
- Monitor GitHub security advisories
- Automated dependency updates (Dependabot)

**Residual Risk**: Zero-day in dependency

**Mitigation**: Quick security update process; version pinning

---

### Risk Matrix

| Threat | Severity | Likelihood | Mitigations |
|--------|----------|-----------|-------------|
| Unauthorized access | High | Low | Auth + rate limiting |
| Privilege escalation | High | Low | Target allowlist |
| Shell injection | Critical | Very low | `exec.Command` only |
| Path traversal | High | Very low | Name validation + working dir lock |
| DoS | Medium | Medium | Concurrency + timeout + rate limits |
| Session hijacking | High | Low | httpOnly + HTTPS |
| Rate limit bypass | Medium | Low | Per-IP + per-token limits |
| Dependency vuln | Medium | Low | Security updates |

---

## Authentication & Authorization

### Authentication Methods

#### JWT (Web Clients)

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -d '{"username":"jerome","password":"...","totp":"..."}'
# Response: Sets cv_session cookie (httpOnly, SameSite=Strict, Secure)

# Subsequent requests
curl http://localhost:3001/api/applications -b cookies.txt
# Cookie sent automatically
```

**Security Properties**:
- Signed with HS256 (HMAC-SHA256)
- 7-day expiry (configurable)
- Verified on every request
- Algorithm verified (prevents algorithm confusion)

#### API Keys (TUI Clients)

```bash
# Every request includes API key
curl http://localhost:3001/api/applications \
  -H "X-API-Key: kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="
```

**Security Properties**:
- Constant-time comparison (prevents timing attacks)
- Static, no expiry (suitable for local tools)
- Multiple keys supported
- No automatic renewal

#### TOTP 2FA (Optional)

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -d '{"username":"jerome","password":"...","totp":"123456"}'
```

**Security Properties**:
- HMAC-SHA1 algorithm (RFC 6238)
- 30-second time step
- ±1 step tolerance (handles clock skew)
- 6-digit codes

### Authorization (Target Allowlist)

Only targets in `config/targets.yml` can execute:

```yaml
targets:
  - name: fetch
    description: "Fetch job description"
    args: [url]

  - name: tailor
    description: "Tailor CV"
    args: [app]
```

**Protection**:
- Mandatory allowlist (no default targets)
- Per-target argument validation
- No glob/wildcard patterns (exact names only)
- Centralized validation in executor

---

## Input Validation

### Application Names

Validated against strict pattern: `^[a-zA-Z0-9._-]{1,128}$`

**Prevents**:
- Path traversal (`..`, `/`, `\`)
- Shell metacharacters (`$`, `` ` ``, `|`, `;`)
- Unicode/null bytes
- Excessively long names (>128 chars)

**Examples**:
- ✓ `2024-03-company-x` (valid)
- ✓ `app_1.0` (valid)
- ✗ `../../etc/passwd` (invalid)
- ✗ `app'; rm -rf /` (invalid)
- ✗ `/home/user/app` (invalid)

### Request Bodies

- **Content-Type**: `application/json` required
- **Size Limit**: 1 MB max
- **Charset**: UTF-8
- **Schema**: Validated against expected structure

**Prevents**:
- Oversized payloads (memory exhaustion)
- Malformed JSON (injection attacks)
- Unknown fields (API stability)

### Query Parameters

- **Type checking**: Enforced per parameter
- **Length limits**: Applied where appropriate
- **Regex validation**: For sensitive parameters (e.g., status filters)

---

## Execution Safety

### No Shell Interpolation

**Vulnerable Code** (DO NOT USE):
```go
cmd := exec.Command("sh", "-c", fmt.Sprintf("make %s", target))
// Attacker sets target="fetch; rm -rf /"
// Executes: sh -c "make fetch; rm -rf /"
```

**Secure Code** (USED):
```go
cmd := exec.Command("make", target)  // Arguments separate, no shell
// Attacker sets target="fetch; rm -rf /"
// Executes: make "fetch; rm -rf /"  (literal string, not shell command)
```

cv-api always uses `exec.Command` with separate arguments. Never shell.

### Working Directory Lockdown

```go
cmd.Dir = cvPath  // Locked to CV_PATH, cannot cd elsewhere
```

Even if target tries `cd /tmp; rm -rf *`, working directory is locked.

### Per-Target Timeouts

```go
ctx, cancel := context.WithTimeout(ctx, targetTimeout)
defer cancel()
cmd := exec.CommandContext(ctx, "make", target)
```

If target runs longer than timeout (default 120s), command is killed (SIGKILL).

**Per-Target Timeout Example**:
```yaml
- name: tailor
  timeout: 120s  # Default

- name: research
  timeout: 300s  # 5 minutes for expensive operation
```

**Hard Max**: 600s (10 minutes). Targets cannot override beyond this.

### Concurrency Limits

Global semaphore limits concurrent jobs:

```go
sem chan struct{}  // Size = MaxConcurrent (default 3)

// Before execution:
sem <- struct{}{}  // Acquire
defer func() { <-sem }()  // Release

// If 3 jobs running, 4th waits or times out
```

**Prevents**:
- Unbounded resource consumption
- CPU/memory exhaustion
- File descriptor exhaustion

### Environment Variables

Child processes inherit minimal environment:

```go
cmd.Env = []string{
    "PATH=/usr/local/bin:/usr/bin:/bin",
    "HOME=/tmp",
    // No secrets or credentials passed
}
```

Prevents:
- Accidental credential leakage
- Malicious environment variable injection

---

## Rate Limiting

### Strategy

Rate limits prevent brute force attacks and DoS:

```
Layer 1: Per-IP (10 req/s)
  ↓
Layer 2: Per-Token (30 req/s if authenticated)
  ↓
Layer 3: Per-Endpoint (login: 5/min)
  ↓
Layer 4: Concurrency (3 global jobs)
```

### Per-IP Rate Limiting

```go
// 10 requests/second per IP
if !rateLimiter.Allow(clientIP) {
    return http.StatusTooManyRequests, "Rate limit exceeded"
}
```

**X-Forwarded-For**: Trusted from reverse proxy (Caddy):
```go
clientIP := r.Header.Get("X-Forwarded-For")  // From Caddy
// Prevents spoofing if proxy is trusted
```

### Per-Token Rate Limiting

```go
// 30 requests/second per authenticated token
if !rateLimiterPerToken.Allow(tokenHash) {
    return http.StatusTooManyRequests
}
```

Allows higher rate for authenticated clients (reduces false positives).

### Login Rate Limiting

```go
// 5 login attempts per IP per minute
if !loginRateLimiter.Allow(clientIP) {
    return http.StatusTooManyRequests, "Too many login attempts"
}
```

Prevents password guessing.

### Retry-After Header

All 429 responses include Retry-After:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1

{"code":429,"message":"Rate limit exceeded"}
```

Clients should wait before retrying.

---

## HTTP Security

### Security Headers

All responses include protective headers:

```http
X-Frame-Options: DENY                          # Prevent clickjacking
X-Content-Type-Options: nosniff                # Prevent MIME sniffing
Referrer-Policy: no-referrer                   # Privacy
X-XSS-Protection: 1; mode=block                # XSS protection (legacy)
Content-Security-Policy: default-src 'self'    # CSP (if applicable)
```

### CORS Configuration

Controlled via `ALLOWED_ORIGINS` environment variable:

```bash
ALLOWED_ORIGINS=https://cv.example.com,https://cv-web.example.com
```

Server responds with:

```http
Access-Control-Allow-Origin: https://cv.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,X-API-Key
Access-Control-Max-Age: 3600
```

**Security**:
- Whitelist-based (not wildcard `*`)
- Credentials allowed only to trusted origins
- Preflight requests handled correctly

### HTTPS/TLS

Production uses Caddy reverse proxy for TLS termination:

```
Internet (TLS 1.3)
    ↓
Caddy (port 443, TLS termination)
    ↓ (plain HTTP, internal network)
cv-api (port 3001, not exposed)
```

**Configuration**:
- Automatic HTTPS via Let's Encrypt
- TLS 1.2+ enforced
- HTTP/2 support
- Certificate auto-renewal

---

## Secrets Management

### Principles

1. **Never commit secrets** to version control
2. **Use strong secrets**: `openssl rand -base64 32` (32+ bytes)
3. **Rotate periodically**: Quarterly or on compromise
4. **Audit access**: Log who accessed secrets
5. **Encrypt at rest**: Secrets in vault, not plaintext files

### Development

Use `.env` file (excluded from git):

```bash
# .env (never commit)
CV_PATH=/path/to/CV
AUTH_SECRET=<random 32+ chars>
AUTH_PASSWORD=<strong password>
```

Load in shell:

```bash
export $(cat .env | xargs)
make dev
```

### Production

Use secrets management system:

**Docker Secrets** (Swarm):
```bash
echo "secret_value" | docker secret create my_secret -
```

**Docker Compose** (development):
```yaml
services:
  cv-api:
    environment:
      AUTH_SECRET: ${AUTH_SECRET}  # From .env file
```

**Kubernetes Secrets**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cv-api-secrets
type: Opaque
data:
  AUTH_SECRET: <base64-encoded>
```

**HashiCorp Vault** (enterprise):
```bash
vault kv get secret/cv-api/prod
```

---

## Dependency Security

### Minimal Dependencies

cv-api uses only essential libraries:

- `github.com/go-chi/chi/v5` — HTTP router
- `github.com/golang-jwt/jwt/v5` — JWT signing
- `github.com/pquerna/otp` — TOTP generation
- Standard library for everything else

**Benefits**:
- Small attack surface
- Easy to audit
- Fewer transitive dependencies

### Security Updates

```bash
# Check for vulnerabilities
go list -json -m all | nancy sleuth

# Update dependencies
go get -u all
go mod tidy

# Verify integrity
go mod verify
```

### Automated Dependency Updates

Use Dependabot on GitHub:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
```

Automatically creates PRs for new versions, triggering CI tests.

---

## Security Headers

### Full List

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking (no iframes) |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing attacks |
| `Referrer-Policy` | `no-referrer` | Don't send referer in links |
| `X-XSS-Protection` | `1; mode=block` | XSS protection (legacy, for old browsers) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforce HTTPS |
| `Content-Security-Policy` | `default-src 'self'` | CSP (if applicable) |

### HSTS Configuration

For production HTTPS:

```go
w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
// Forces HTTPS for 1 year, includes subdomains, eligible for browser preload list
```

---

## Reporting Vulnerabilities

### Security Issue Discovery

If you find a security vulnerability:

1. **Do not create a public GitHub issue**
2. **Email privately**: [security contact email - ADD THIS]
3. **Include details**:
   - Vulnerability description
   - Steps to reproduce
   - Potential impact
   - Suggested fix (optional)

### Responsible Disclosure

- 90-day disclosure window
- Coordinated release of patch
- Credit in release notes (unless requested otherwise)
- Reasonable effort to fix before public disclosure

### Past Vulnerabilities

None reported to date. This project is security-conscious but not a high-value target (personal tool).

---

## Security Checklist

When deploying cv-api, ensure:

- [ ] **Secrets**: All sensitive values in environment, never hardcoded
- [ ] **HTTPS**: Production uses TLS (behind Caddy or similar)
- [ ] **Auth**: Credentials stored securely, strong passwords
- [ ] **Allowlist**: `config/targets.yml` reviewed before deployment
- [ ] **Logging**: All auth events logged (success, failure, attempts)
- [ ] **Monitoring**: Security logs aggregated and alerted on anomalies
- [ ] **Updates**: Go and dependencies kept current
- [ ] **Testing**: Security tests pass, no known vulnerabilities
- [ ] **Access Control**: Only authorized users have access
- [ ] **Backups**: Regular backups of CV data
- [ ] **Incident Response**: Plan documented for security incidents
- [ ] **Audit**: Regular security audits scheduled

---

## Further Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Go Security Best Practices](https://golang.org/doc/security)
- [JWT Security](https://tools.ietf.org/html/rfc7519)
- [TOTP (RFC 6238)](https://tools.ietf.org/html/rfc6238)
- [HTTP Security Headers](https://owasp.org/www-project-secure-headers/)

