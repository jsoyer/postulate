package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestPreview_Unauthenticated verifies the preview endpoint requires auth.
func TestPreview_Unauthenticated(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/preview?theme=tech-blue", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

// TestPreview_InvalidTheme verifies that an unknown theme name returns 400.
func TestPreview_InvalidTheme(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/preview?theme=does-not-exist", nil)
	req = withAPIKey(req)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

// TestPreview_TargetNotConfigured verifies 501 when "preview" is not in the executor allowlist.
func TestPreview_TargetNotConfigured(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	// The setupTestRouter only registers "fetch" as an allowed target, not "preview".
	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/preview?theme=tech-blue", nil)
	req = withAPIKey(req)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d: %s", w.Code, w.Body.String())
	}
}
