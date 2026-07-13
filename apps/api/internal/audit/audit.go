// Package audit provides structured audit logging for security-relevant events.
//
// Audit entries are emitted as structured JSON via log/slog and stored in an
// in-memory circular buffer (last 100 entries) for retrieval via the API.
// The buffer is not persisted across restarts; Phase 3 will add SQLite backing.
package audit

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

const bufferSize = 100

// Entry is a single audit log record.
type Entry struct {
	// Time is when the event occurred.
	Time time.Time `json:"time"`
	// Action is the event type: "login", "logout", "action_execute",
	// "app_create", "app_update", "file_upload", "settings_update".
	Action string `json:"action"`
	// Resource is the affected object name (application name, target name, etc.).
	Resource string `json:"resource,omitempty"`
	// User is the authenticated username or "api_key".
	User string `json:"user,omitempty"`
	// IP is the client IP address (port stripped, X-Forwarded-For respected).
	IP string `json:"ip,omitempty"`
	// Result is the outcome: "ok", "denied", or "error".
	Result string `json:"result"`
	// Detail carries additional context about the event.
	Detail string `json:"detail,omitempty"`
}

// Logger writes audit entries to a slog.Logger and maintains an in-memory
// circular buffer of the last 100 entries.
type Logger struct {
	log    *slog.Logger
	mu     sync.RWMutex
	buf    [bufferSize]Entry
	head   int // next write index
	count  int // total entries written (capped at bufferSize for "full" detection)
}

// New creates a Logger that writes audit entries as INFO-level structured JSON
// to the default slog logger.
func New() *Logger {
	return &Logger{
		log: slog.Default(),
	}
}

// Log records an audit entry: it emits it via slog and appends it to the
// in-memory circular buffer.
func (l *Logger) Log(ctx context.Context, e Entry) {
	if e.Time.IsZero() {
		e.Time = time.Now().UTC()
	}

	// Emit via slog as structured fields alongside msg="audit".
	l.log.LogAttrs(ctx, slog.LevelInfo, "audit",
		slog.String("action", e.Action),
		slog.String("resource", e.Resource),
		slog.String("user", e.User),
		slog.String("ip", e.IP),
		slog.String("result", e.Result),
		slog.String("detail", e.Detail),
		slog.Time("event_time", e.Time),
	)

	l.mu.Lock()
	l.buf[l.head] = e
	l.head = (l.head + 1) % bufferSize
	if l.count < bufferSize {
		l.count++
	}
	l.mu.Unlock()
}

// Recent returns the last n entries (at most bufferSize) in chronological order.
// If n <= 0 or n > bufferSize, all buffered entries are returned.
func (l *Logger) Recent(n int) []Entry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if n <= 0 || n > bufferSize {
		n = bufferSize
	}

	count := l.count
	if n > count {
		n = count
	}
	if n == 0 {
		return []Entry{}
	}

	out := make([]Entry, n)
	// The oldest entry among the last n is at position:
	// (head - n + bufferSize) % bufferSize
	start := (l.head - n + bufferSize) % bufferSize
	for i := 0; i < n; i++ {
		out[i] = l.buf[(start+i)%bufferSize]
	}
	return out
}

// IPFromRequest extracts the client IP from a request, respecting the
// X-Forwarded-For header when behind a reverse proxy.
func IPFromRequest(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For may be a comma-separated list; the first is the client.
		parts := strings.SplitN(xff, ",", 2)
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
