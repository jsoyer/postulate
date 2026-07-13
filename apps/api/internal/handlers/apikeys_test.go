package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jsoyer/cv-api/internal/auth"
)

func TestAPIKeys_ListRequiresAdmin(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/api-keys", nil)
	req.Header.Set("X-API-Key", "test-api-key") // editor → 403
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAPIKeys_GenerateRequiresAdmin(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	body := `{"role":"editor"}`
	req := httptest.NewRequest(http.MethodPost, "/api/api-keys", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "test-api-key") // editor → 403
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestAPIKeys_GeneratedKeyWorks(t *testing.T) {
	handler, provider, _ := setupTestRouter(t)

	// Generate a new key as admin.
	adminToken, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue admin JWT: %v", err)
	}

	body := `{"role":"editor"}`
	req := httptest.NewRequest(http.MethodPost, "/api/api-keys", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Key    string `json:"key"`
		Prefix string `json:"prefix"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode generate response: %v", err)
	}
	if resp.Key == "" {
		t.Fatal("expected non-empty key in response")
	}
	if resp.Role != string(auth.RoleEditor) {
		t.Fatalf("expected role editor, got %q", resp.Role)
	}

	// The generated key must work to authenticate.
	authReq := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	authReq.Header.Set("X-API-Key", resp.Key)
	authW := httptest.NewRecorder()
	(*handler).ServeHTTP(authW, authReq)

	if authW.Code != http.StatusOK {
		t.Fatalf("generated key should authenticate: expected 200, got %d: %s", authW.Code, authW.Body.String())
	}
}

func TestAPIKeys_RevokeKey(t *testing.T) {
	handler, provider, _ := setupTestRouter(t)

	adminToken, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue admin JWT: %v", err)
	}
	authHeader := "Bearer " + adminToken

	// Generate a key.
	genBody := `{"role":"editor"}`
	genReq := httptest.NewRequest(http.MethodPost, "/api/api-keys", strings.NewReader(genBody))
	genReq.Header.Set("Content-Type", "application/json")
	genReq.Header.Set("Authorization", authHeader)
	genW := httptest.NewRecorder()
	(*handler).ServeHTTP(genW, genReq)
	if genW.Code != http.StatusCreated {
		t.Fatalf("generate: expected 201, got %d: %s", genW.Code, genW.Body.String())
	}

	var genResp struct {
		Key    string `json:"key"`
		Prefix string `json:"prefix"`
	}
	if err := json.NewDecoder(genW.Body).Decode(&genResp); err != nil {
		t.Fatalf("decode generate response: %v", err)
	}

	// Verify key works before revocation.
	checkReq := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	checkReq.Header.Set("X-API-Key", genResp.Key)
	checkW := httptest.NewRecorder()
	(*handler).ServeHTTP(checkW, checkReq)
	if checkW.Code != http.StatusOK {
		t.Fatalf("key should work before revocation, got %d", checkW.Code)
	}

	// Revoke the key.
	revokeReq := httptest.NewRequest(http.MethodDelete, "/api/api-keys/"+genResp.Prefix, nil)
	revokeReq.Header.Set("Authorization", authHeader)
	revokeW := httptest.NewRecorder()
	(*handler).ServeHTTP(revokeW, revokeReq)
	if revokeW.Code != http.StatusOK {
		t.Fatalf("revoke: expected 200, got %d: %s", revokeW.Code, revokeW.Body.String())
	}

	// Key must no longer work.
	afterReq := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	afterReq.Header.Set("X-API-Key", genResp.Key)
	afterW := httptest.NewRecorder()
	(*handler).ServeHTTP(afterW, afterReq)
	if afterW.Code != http.StatusUnauthorized {
		t.Fatalf("revoked key should be rejected: expected 401, got %d", afterW.Code)
	}
}
