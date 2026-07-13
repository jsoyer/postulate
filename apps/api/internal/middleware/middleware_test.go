package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jsoyer/cv-api/internal/middleware"
)

func TestRequestID_HeaderSet(t *testing.T) {
	handler := middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The request ID must already be in context by the time the inner
		// handler runs.
		id := middleware.RequestIDFromContext(r.Context())
		if id == "" {
			t.Error("expected request_id in context, got empty string")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	id := w.Header().Get("X-Request-ID")
	if id == "" {
		t.Error("expected X-Request-ID header to be set on response")
	}
}

func TestRequestID_UniquePerRequest(t *testing.T) {
	var ids []string
	handler := middleware.RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		ids = append(ids, w.Header().Get("X-Request-ID"))
	}

	seen := make(map[string]bool)
	for _, id := range ids {
		if seen[id] {
			t.Errorf("duplicate request ID %q", id)
		}
		seen[id] = true
	}
}

func TestRequestIDFromContext_MissingReturnsEmpty(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	id := middleware.RequestIDFromContext(req.Context())
	if id != "" {
		t.Errorf("expected empty string for missing request ID, got %q", id)
	}
}
