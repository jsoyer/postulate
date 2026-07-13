# Authentication & Authorization

cv-api supports two authentication modes designed for different client types: JWT for web clients and API keys for terminal clients. Both are validated using secure, constant-time comparisons to prevent timing attacks.

## Overview

| Mode | Clients | Storage | Expiry | Use Case |
|------|---------|---------|--------|----------|
| **JWT** | cv-web (web frontend) | httpOnly cookie | 7 days | Browser sessions |
| **API Key** | cv-tui-go, cv-tui-rs | Config file | None | Terminal/local tools |
| **TOTP** | cv-web (optional) | Authenticator app | 30s window | Enhanced security |

## JWT Authentication (Web)

JWT (JSON Web Tokens) provides stateless session management suitable for web frontends.

### Flow Diagram

```
┌─────────┐
│ Browser │
└────┬────┘
     │ 1. POST /api/auth/login { username, password, totp? }
     │
     ├────────────────────────────────────┐
     │                                    │
     └───────────────────────────┬────────┘
                                  │ 2. Server validates credentials
                    ┌─────────────▼──────────────┐
                    │ Check password             │
                    │ Check TOTP (if enabled)    │
                    │ Generate JWT               │
                    │ Set httpOnly cookie        │
                    └─────────────┬──────────────┘
                                  │
     ┌────────────────────────────┘
     │ 3. 200 OK + Set-Cookie: cv_session=<JWT>
     │
     ├─────────────────────────────┬──────────────┐
     │ 4. All subsequent requests    │ Automatic    │
     │    include cookie via browser │ cookie       │
     │                               │ handling     │
     └─────────────────────────────┬──────────────┘
     │
     └───> GET /api/applications
          (Cookie: cv_session=<JWT> sent automatically)
     │
     ├─────────────────────────────┬──────────────┐
     │ 5. POST /api/auth/logout     │ Clears       │
     │    (Cookie still sent)       │ cookie       │
     │                              │              │
     └─────────────────────────────┬──────────────┘
          3. Clear-Cookie: cv_session
```

### JWT Token Structure

JWTs are signed using HS256 (HMAC with SHA-256) and contain standard claims:

```json
{
  "sub": "jerome",
  "iat": 1709827200,
  "exp": 1710432000,
  "iss": "cv-api"
}
```

| Claim | Meaning | Verified |
|-------|---------|----------|
| `sub` | Subject (username) | Extracted and used for logging |
| `iat` | Issued at (Unix timestamp) | Verified by JWT library |
| `exp` | Expires at (Unix timestamp) | Verified by JWT library |
| `iss` | Issuer | For information only |

**Token Size**: ~150-200 bytes (compact enough for headers)

### JWT Creation

```
1. POST /api/auth/login
   - Validate username matches configured username (constant-time)
   - Validate password matches configured password (constant-time)
   - If AUTH_TOTP_SECRET set, validate TOTP code

2. If all valid:
   - Create JWT claims with 7-day expiry
   - Sign with HS256 using AUTH_SECRET
   - Return token in JSON body
   - Set httpOnly cookie with token

3. If invalid:
   - Return 401 Unauthorized
   - Rate limit subsequent attempts (5/min per IP)
```

### JWT Validation

On protected endpoints:

```
1. Extract credential from request
   - Check X-API-Key header first (API key mode)
   - Check Authorization: Bearer header (JWT mode)
   - Check cv_session cookie (JWT mode)
   - Check token query param (JWT mode, WebSocket)

2. If JWT:
   - Parse token string
   - Verify algorithm is HS256 (prevent algorithm confusion)
   - Verify signature using AUTH_SECRET
   - Check exp claim (not expired)
   - Extract sub claim (username)

3. If valid:
   - Request proceeds with authenticated context

4. If invalid:
   - Return 401 Unauthorized
   - Log failed auth attempt
```

### Cookie Configuration

The session cookie has these security properties:

```http
Set-Cookie: cv_session=<JWT>;
            HttpOnly;
            SameSite=Strict;
            Secure;
            Path=/;
            Domain=<COOKIE_DOMAIN>;
            Max-Age=604800
```

| Property | Value | Purpose |
|----------|-------|---------|
| `HttpOnly` | true | Prevents JavaScript access (protects against XSS) |
| `SameSite=Strict` | Strict | Not sent on cross-origin requests (prevents CSRF) |
| `Secure` | true* | Only sent over HTTPS (requires HTTPS in production) |
| `Path=/` | / | Cookie sent for all paths |
| `Domain` | `COOKIE_DOMAIN` env var | Set to hostname in production |
| `Max-Age` | 604800 (7 days) | Token expiry, shorter is more secure |

*Set automatically when behind HTTPS proxy (Caddy)

### Login Example

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jerome",
    "password": "my_secure_password"
  }' \
  -c cookies.txt

# Response:
# HTTP/1.1 200 OK
# Set-Cookie: cv_session=eyJhbGci...; HttpOnly; SameSite=Strict; Path=/
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expires_at": 1710432000
# }

# Use the cookie for subsequent requests
curl http://localhost:3001/api/applications \
  -b cookies.txt
```

### Token Refresh

Tokens do not auto-refresh. After 7 days, users must login again:

```bash
# When token expires (after 7 days):
curl http://localhost:3001/api/applications \
  -b cookies.txt
# Response: 401 Unauthorized
# "Token expired"

# Must login again
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"jerome","password":"..."}'
```

For web clients, this is typically handled with a popup or redirect to login page.

---

## API Key Authentication (TUI)

API keys provide simple authentication for non-interactive clients (terminal UIs, scripts, integrations).

### Flow Diagram

```
┌──────────────────────┐
│ TUI Client           │
│ (cv-tui-go/rs)       │
└────┬─────────────────┘
     │
     │ 1. Read ~/.config/cv/config.toml
     │    api_key = "kJ9mP2xL7nQ4vR6..."
     │
     ├──────────────────────────────────┐
     │                                  │
     └────────────────┬─────────────────┘
     │
     │ 2. Every request includes
     │    X-API-Key: kJ9mP2xL7nQ4vR6...
     │
     ├──────────────────────────────────┐
     │  GET /api/applications           │
     │  X-API-Key: <key>                │
     │                                  │
     ├──────────────────────────────────┤
     │ 3. Server validates key          │
     │    - Constant-time compare       │
     │    - Check against API_KEYS list │
     │                                  │
     └────────────────┬─────────────────┘
                      │
           ┌──────────▼──────────┐
           │ Valid?              │
           └──┬─────────────┬────┘
              │             │
         Yes  │             │  No
              │             │
         Request ✓         401
         proceeds      Unauthorized
```

### Key Generation

```bash
# Generate a new API key (base64-encoded random data)
openssl rand -base64 32
# Example output: kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE=

# Generate multiple keys for different devices
openssl rand -base64 32 > /tmp/key1.txt
openssl rand -base64 32 > /tmp/key2.txt
```

### Key Configuration

Store keys in `.env`:

```bash
# .env
API_KEYS=kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE=,aBcD1234efgH5678ijkL9012mnoPqrS=,xYz9876AbCdEfGhI1234JkLmNoPqRsT=
```

The server parses this comma-separated list and validates against all keys.

### Key Usage

Store in TUI config file:

```toml
# ~/.config/cv/config.toml (both cv-tui-go and cv-tui-rs)
[api]
base_url = "http://localhost:3001"
api_key  = "kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="

[ui]
theme = "catppuccin-mocha"
```

TUI sends the key with every request:

```bash
curl http://localhost:3001/api/applications \
  -H "X-API-Key: kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="
```

### Key Validation

```
1. Extract X-API-Key header

2. If header present:
   - Compare key against each key in API_KEYS list (constant-time)
   - If match found: valid, continue
   - If no match: invalid, return 401

3. If header missing:
   - Check other auth methods (JWT cookie, Authorization header, token param)

4. If no valid auth found:
   - Return 401 Unauthorized
```

### Key Rotation

Keys do not expire, but can be rotated:

```bash
# 1. Generate new key
new_key=$(openssl rand -base64 32)

# 2. Update .env with both old and new keys
# API_KEYS=old_key,new_key

# 3. Update TUI config with new key
# ~/.config/cv/config.toml: api_key = new_key

# 4. Once all TUIs updated, remove old key from .env
# API_KEYS=new_key

# 5. Restart cv-api
```

During rotation, old and new keys work simultaneously (graceful transition).

### Security Considerations

- **No Expiry**: Keys don't expire (set expiry via external process if needed)
- **Constant-Time Comparison**: Protects against timing attacks
- **Static**: Same key used for all requests (no refresh mechanism)
- **Single Value**: Only one key per TUI instance
- **No Rate Limiting (per-key)**: Shared rate limit across all authenticated clients

---

## TOTP Two-Factor Authentication

Optional time-based one-time password (TOTP) for enhanced web login security.

### Setup

1. **Generate Secret**

```bash
# Generate a random base32 secret
python3 -c "import base64, secrets; print(base64.b32encode(secrets.token_bytes(20)).decode())"
# Example: JBSWY3DPBLQ4M53ELRQQ====
```

2. **Configure Server**

```bash
# .env
AUTH_TOTP_SECRET=JBSWY3DPBLQ4M53ELRQQ====
```

3. **Add to Authenticator App**

Scan QR code or manually enter secret in:
- Google Authenticator
- Authy
- 1Password
- Microsoft Authenticator
- Any TOTP-compatible app

### Login Flow with TOTP

```
1. POST /api/auth/login
   {
     "username": "jerome",
     "password": "password",
     "totp": "123456"  // 6-digit code from authenticator
   }

2. Server validates:
   - Username/password correct
   - TOTP code valid (±1 step tolerance, ~30s window)

3. If valid: 200 OK + JWT cookie
   If invalid: 401 Unauthorized
```

### TOTP Validation Details

- **Algorithm**: HMAC-SHA1 (RFC 6238)
- **Time Step**: 30 seconds
- **Digits**: 6
- **Tolerance**: ±1 step (accepts previous, current, next code)
  - This accommodates clock skew up to ±60 seconds

```bash
# Example: if current time window generates code 123456:
# Valid codes: 789012 (previous), 123456 (current), 456789 (next)
# Server rejects codes from 2+ steps ago or future
```

### TOTP Considerations

- **Backup Codes**: Not implemented (re-login to re-enable)
- **Recovery**: If user loses authenticator app:
  - Only option is to update AUTH_TOTP_SECRET (and redistribute to user)
  - Or clear AUTH_TOTP_SECRET in .env to disable 2FA
- **Clock Skew**: Tolerance of ±1 step handles most clock sync issues
- **Authenticator App**: User responsible for backing up seed/recovery codes

---

## Credential Extraction Priority

When validating a request, cv-api checks credentials in this order:

1. **X-API-Key header** (API key mode)
   ```
   X-API-Key: kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE=
   ```

2. **Authorization: Bearer header** (JWT mode)
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiI...
   ```

3. **cv_session cookie** (JWT mode, web)
   ```
   Cookie: cv_session=eyJhbGciOiJIUzI1NiI...
   ```

4. **token query parameter** (JWT mode, WebSocket)
   ```
   WS /ws/actions/fetch?token=eyJhbGciOiJIUzI1NiI...
   ```

If a credential is found, it's validated immediately. No further extraction methods are tried. If invalid, the request is rejected with 401.

---

## WebSocket Authentication

WebSocket connections authenticate during the HTTP upgrade handshake. The browser automatically includes cookies, so web clients are transparent.

### Web Client (with Cookie)

```javascript
// Session cookie is sent automatically by browser
const ws = new WebSocket('ws://localhost:3001/ws/actions/fetch');

ws.onopen = () => {
  ws.send(JSON.stringify({
    application: "2024-03-company-x",
    args: {}
  }));
};
```

### TUI Client (with Token)

```javascript
// TUI must send token via query parameter (no cookie support)
const token = "kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE=";
const ws = new WebSocket(`ws://localhost:3001/ws/actions/fetch?token=${token}`);

ws.onopen = () => {
  ws.send(JSON.stringify({
    application: "2024-03-company-x",
    args: {}
  }));
};
```

### Bash Example

```bash
#!/bin/bash

# Using websocat (install: brew install websocat)
token="kJ9mP2xL7nQ4vR6wT8yB3cF5hA1dG0jE="
action='{"args":{"url":"https://example.com"}}'

echo "$action" | websocat \
  "ws://localhost:3001/ws/actions/fetch?token=$token"
```

### Authentication Check

Auth is performed once at connection upgrade:

```
1. Client initiates WebSocket upgrade (GET with Upgrade header)

2. Server checks credentials (token, cookie, or Authorization)

3. If valid:
   - Send 101 Switching Protocols
   - Upgrade to WebSocket
   - Auth context inherited for entire session

4. If invalid:
   - Send 401 Unauthorized
   - Reject upgrade
```

Once upgraded, the connection is authenticated. Credentials are not re-checked per message.

---

## Rate Limiting

Rate limits prevent brute force attacks and resource exhaustion.

### Limits by Scope

| Scope | Limit | Response |
|-------|-------|----------|
| Login attempts | 5/min per IP | 429 + Retry-After |
| General API requests | 10/s per IP | 429 + Retry-After |
| Authenticated requests | 30/s per token | 429 + Retry-After |
| Concurrent Make jobs | 3 global | 429 + message |

### Login Rate Limiting

```
POST /api/auth/login 5 times from IP 192.168.1.100 within 1 minute
→ 1st-5th: succeed (or return 401 for invalid credentials)
→ 6th: 429 Too Many Requests
→ After 1 minute: limit resets
```

Prevents password guessing by limiting attempts.

### General API Rate Limiting

```
10 requests/second per IP across all endpoints
→ 1st-10th request: succeed
→ 11th request: 429 Too Many Requests
→ Resets after 1 second
```

Prevents DoS by limiting request rate.

### Per-Token Rate Limiting

```
30 requests/second per authenticated token
→ 1st-30th request: succeed
→ 31st request: 429 Too Many Requests
→ Resets after 1 second
```

Allows more aggressive rate limits for authenticated clients (trusted).

### Retry-After Header

All 429 responses include `Retry-After` header:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 1

{
  "code": 429,
  "message": "Rate limit exceeded. Please retry after 1 second."
}
```

Clients should wait the indicated number of seconds before retrying.

### Retry Strategy

```python
import time
import requests

def request_with_retry(method, url, max_retries=3):
    for attempt in range(max_retries):
        response = requests.request(method, url, timeout=10)

        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 1))
            print(f"Rate limited. Waiting {retry_after}s...")
            time.sleep(retry_after)
            continue

        return response

    raise Exception("Max retries exceeded")

response = request_with_retry('GET', 'http://localhost:3001/api/applications')
```

---

## Security Best Practices

### JWT Tokens

- **Don't expose tokens**: Keep in httpOnly cookies (never localStorage)
- **Use HTTPS**: Tokens can be intercepted over HTTP
- **Monitor expiry**: 7-day expiry is convenient, shorter is more secure
- **Rotate secrets**: Change AUTH_SECRET periodically (requires re-login)
- **Log failed attempts**: Monitor for attack patterns

### API Keys

- **Rotate keys**: Change periodically (all TUIs must update)
- **Limit scope**: One key per TUI instance (if stolen, only that device is compromised)
- **Secure storage**: TUI stores in `~/.config/cv/config.toml` (readable by user only)
- **Environment isolation**: Use different keys per environment (dev, prod)

### TOTP

- **Backup authenticator**: User must back up seed/recovery codes
- **Sync clock**: Authenticator app must have correct time (or enable tolerance)
- **Secure generator**: Use proper TOTP algorithm (HMAC-SHA1, 6 digits, 30s step)

### Infrastructure

- **HTTPS only**: cv-api behind HTTPS proxy (Caddy) in production
- **Secure transport**: Cookies set with `Secure` flag (HTTPS required)
- **CSRF protection**: Cookies set with `SameSite=Strict`
- **XSS protection**: Tokens in httpOnly cookies (JavaScript can't access)

### Credential Management

- **No hardcoded secrets**: All secrets in environment variables or `.env`
- **Git ignore**: `.env` not committed to version control
- **Vault integration**: Use Docker secrets or HashiCorp Vault in production
- **Audit logging**: Log all auth events (success, failure, rate limits)

---

## Troubleshooting

### "Invalid credentials"

```
Cause: Wrong username or password
Fix: Check USERNAME and PASSWORD match .env

If using TOTP:
  - Code must be 6 digits
  - Code expires after 30 seconds
  - Phone/authenticator app must have correct time
  - Try code from previous/next 30s window
```

### "Token expired"

```
Cause: JWT token older than 7 days
Fix: Login again via POST /api/auth/login
     Web: browser redirects to login page
     TUI: API key doesn't expire, this shouldn't happen
```

### "Invalid API key"

```
Cause: Key not in API_KEYS list
Fix: Regenerate key with: openssl rand -base64 32
    Add to .env: API_KEYS=new_key
    Restart cv-api
    Update TUI config: ~/.config/cv/config.toml
```

### "Rate limit exceeded"

```
Cause: Too many requests in short time
Fix: Wait for Retry-After seconds
    Implement exponential backoff
    Check for DDoS attack
```

### WebSocket "unauthorized"

```
Cause: Invalid or missing token in query parameter
Fix: Pass token via query param: ws://host/ws/actions/X?token=<key>
    Or use valid session cookie (web clients)
    Check cookie domain matches (production)
```

