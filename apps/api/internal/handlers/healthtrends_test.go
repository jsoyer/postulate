package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthAuditHistory_EmptyOnFirstCall(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/health-audit/history", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	history, ok := resp["history"]
	if !ok {
		t.Fatal("expected 'history' key in response")
	}
	histSlice, ok := history.([]any)
	if !ok {
		t.Fatalf("expected history to be an array, got %T", history)
	}
	if len(histSlice) != 0 {
		t.Fatalf("expected empty history before any audit, got %d entries", len(histSlice))
	}
}

func TestHealthAuditHistory_RecordsAfterAudit(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	// Call health-audit to generate a score entry.
	auditReq := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/health-audit", nil)
	auditReq.Header.Set("X-API-Key", "test-api-key")
	auditW := httptest.NewRecorder()
	(*handler).ServeHTTP(auditW, auditReq)
	if auditW.Code != http.StatusOK {
		t.Fatalf("health-audit: expected 200, got %d: %s", auditW.Code, auditW.Body.String())
	}

	// Fetch history; should now have one entry.
	histReq := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/health-audit/history", nil)
	histReq.Header.Set("X-API-Key", "test-api-key")
	histW := httptest.NewRecorder()
	(*handler).ServeHTTP(histW, histReq)
	if histW.Code != http.StatusOK {
		t.Fatalf("history: expected 200, got %d: %s", histW.Code, histW.Body.String())
	}

	var resp map[string]any
	if err := json.NewDecoder(histW.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	histSlice, ok := resp["history"].([]any)
	if !ok {
		t.Fatalf("expected history array, got %T", resp["history"])
	}
	if len(histSlice) != 1 {
		t.Fatalf("expected 1 history entry after audit, got %d", len(histSlice))
	}

	entry, ok := histSlice[0].(map[string]any)
	if !ok {
		t.Fatalf("expected history entry to be a map, got %T", histSlice[0])
	}
	if _, ok := entry["overall_score"]; !ok {
		t.Fatal("expected 'overall_score' field in history entry")
	}
	if _, ok := entry["checked_at"]; !ok {
		t.Fatal("expected 'checked_at' field in history entry")
	}
}

func TestHealthAuditHistory_Unauthenticated(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company/health-audit/history", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}
