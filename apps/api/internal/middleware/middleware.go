// Package middleware provides HTTP middleware for authentication,
// rate limiting, CORS, security headers, and request logging.
package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/httprate"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/models"
)

type contextKey string

const (
	userContextKey      contextKey = "user"
	requestIDContextKey contextKey = "requestID"
)

// roleCtxKey is the context key for the authenticated role.
type roleCtxKey struct{}

// jtiCtxKey is the context key for the JWT jti claim.
type jtiCtxKey struct{}

// UserFromContext retrieves the authenticated username from the request context.
func UserFromContext(ctx context.Context) string {
	if user, ok := ctx.Value(userContextKey).(string); ok {
		return user
	}
	return ""
}

// RoleFromContext retrieves the authenticated role from the request context.
func RoleFromContext(ctx context.Context) auth.Role {
	if role, ok := ctx.Value(roleCtxKey{}).(auth.Role); ok {
		return role
	}
	return ""
}

// WithRole stores the given role in the context.
func WithRole(ctx context.Context, role auth.Role) context.Context {
	return context.WithValue(ctx, roleCtxKey{}, role)
}

// JTIFromContext retrieves the JWT jti from the request context.
func JTIFromContext(ctx context.Context) string {
	if jti, ok := ctx.Value(jtiCtxKey{}).(string); ok {
		return jti
	}
	return ""
}

// WithJTI stores the given JWT jti in the context.
func WithJTI(ctx context.Context, jti string) context.Context {
	return context.WithValue(ctx, jtiCtxKey{}, jti)
}

// RequestIDFromContext retrieves the request ID from the context.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDContextKey).(string); ok {
		return id
	}
	return ""
}

// RequestID generates a unique request ID, sets it as X-Request-ID response
// header, and stores it in the context for downstream handlers and logging.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := fmt.Sprintf("%x", time.Now().UnixNano())
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDContextKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// Auth creates middleware that validates JWT or API key credentials.
// Requests without valid credentials receive 401 Unauthorized.
// On success, stores the authenticated username, role, and jti in the context.
func Auth(provider *auth.Provider) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, jti, role, err := provider.Authenticate(r)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "Authentication required")
				return
			}
			ctx := context.WithValue(r.Context(), userContextKey, user)
			ctx = WithRole(ctx, role)
			ctx = WithJTI(ctx, jti)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns middleware that enforces a minimum role requirement.
// The role precedence is: admin > editor > viewer.
// Requests with an insufficient role receive 403 Forbidden.
// This middleware must be used after Auth, which stores the role in context.
func RequireRole(minimum auth.Role) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := RoleFromContext(r.Context())
			if !auth.HasMinimumRole(role, minimum) {
				writeError(w, http.StatusForbidden, "Insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RateLimit applies per-IP rate limiting using a sliding window.
func RateLimit(requestsPerSecond int) func(http.Handler) http.Handler {
	return httprate.LimitByIP(requestsPerSecond, time.Second)
}

// LoginRateLimit applies strict rate limiting for login attempts.
func LoginRateLimit() func(http.Handler) http.Handler {
	return httprate.LimitByIP(5, time.Minute)
}

// PerTokenRateLimit applies per-authenticated-token (or API-key) rate limiting.
// It limits to rps requests per second per unique token value. Use inside
// protected route groups where the Authorization header or X-API-Key is present.
func PerTokenRateLimit(rps int) func(http.Handler) http.Handler {
	return httprate.NewRateLimiter(rps, time.Second,
		httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
			// Prefer Authorization bearer token; fall back to API key header.
			if auth := r.Header.Get("Authorization"); auth != "" {
				return "bearer:" + auth, nil
			}
			if key := r.Header.Get("X-API-Key"); key != "" {
				return "apikey:" + key, nil
			}
			// Fall back to cookie name so browser sessions are also limited.
			if c, err := r.Cookie("cv_session"); err == nil {
				return "cookie:" + c.Value, nil
			}
			return r.RemoteAddr, nil
		}),
	).Handler
}

// CostBasedRateLimit returns middleware that enforces a strict 2 req/min per IP
// for targets listed in expensive. If the URL path does not end with an
// expensive target name, the middleware is a no-op for that request.
func CostBasedRateLimit(expensive []string) func(http.Handler) http.Handler {
	expensiveSet := make(map[string]bool, len(expensive))
	for _, t := range expensive {
		expensiveSet[t] = true
	}

	// One shared limiter: 2 requests per minute per IP.
	limiter := httprate.NewRateLimiter(2, time.Minute)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract target from the last path segment.
			path := r.URL.Path
			target := path
			for i := len(path) - 1; i >= 0; i-- {
				if path[i] == '/' {
					target = path[i+1:]
					break
				}
			}
			if expensiveSet[target] {
				limiter.Handler(next).ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CORS handles Cross-Origin Resource Sharing with strict origin validation.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	originSet := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[strings.TrimRight(o, "/")] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			if origin != "" && (len(allowedOrigins) == 0 || originSet[origin]) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.Header().Set("Vary", "Origin")
			}

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders adds standard security headers to every response.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "0")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

// Logger logs each request with structured fields: method, path, status, duration.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		duration := time.Since(start)
		level := slog.LevelInfo
		if wrapped.status >= 500 {
			level = slog.LevelError
		} else if wrapped.status >= 400 {
			level = slog.LevelWarn
		}

		args := []any{
			"method", r.Method,
			"path", r.URL.Path,
			"status", wrapped.status,
			"duration_ms", duration.Milliseconds(),
			"remote", r.RemoteAddr,
			"user", UserFromContext(r.Context()),
		}
		if id := RequestIDFromContext(r.Context()); id != "" {
			args = append(args, "request_id", id)
		}
		slog.Log(r.Context(), level, "request", args...)
	})
}

// RequestSize limits the maximum request body size.
func RequestSize(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}

// statusWriter wraps http.ResponseWriter to capture the status code.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func writeError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(models.APIError{Code: code, Message: message}); err != nil {
		slog.Error("failed to write error response", "error", err)
	}
}
