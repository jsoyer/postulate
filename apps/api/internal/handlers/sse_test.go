package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSSE_Unauthenticated(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/stream/fetch", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/json") {
		t.Errorf("expected JSON content-type for error, got %q", ct)
	}
}

func TestSSE_UnknownTarget(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/stream/nonexistent-target", nil)
	req = withAPIKey(req)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestSSE_ValidRequest(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	// "fetch" is the one target seeded in setupTestRouter.
	req := httptest.NewRequest(http.MethodGet, "/api/stream/fetch?url=https://example.com", nil)
	req = withAPIKey(req)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	// The make command will fail in CI (no Makefile / make binary),
	// but the SSE headers must already be committed with 200.
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: body=%s", w.Code, w.Body.String())
	}

	ct := w.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "text/event-stream") {
		t.Errorf("expected text/event-stream content-type, got %q", ct)
	}
}
