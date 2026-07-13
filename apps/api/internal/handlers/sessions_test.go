package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jsoyer/cv-api/internal/auth"
)

// loginAndGetToken performs a login via the router and returns the JWT token.
func loginAndGetToken(t *testing.T, handler *http.Handler) string {
	t.Helper()
	body := `{"username":"testuser","password":"testpass"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login failed: %d %s", w.Code, w.Body.String())
	}
	var resp struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	return resp.Token
}

func TestSessions_ListRequiresAdmin(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	// Viewer API key should be forbidden (403), not 401.
	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	req.Header.Set("X-API-Key", "test-api-key") // editor key → 403
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSessions_ListUnauthenticated(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestSessions_RevokeRequiresAdmin(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodDelete, "/api/sessions/someid", nil)
	req.Header.Set("X-API-Key", "test-api-key") // editor → 403
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSessions_ListAfterLogin(t *testing.T) {
	handler, provider, _ := setupTestRouter(t)

	// Login to create a session.
	_ = loginAndGetToken(t, handler)

	// List sessions as admin.
	adminToken, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue admin JWT: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Sessions []map[string]any `json:"sessions"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode sessions response: %v", err)
	}
	// At minimum 2 sessions: the login + the admin JWT.
	if len(resp.Sessions) < 2 {
		t.Fatalf("expected at least 2 sessions (login + admin), got %d", len(resp.Sessions))
	}
}
