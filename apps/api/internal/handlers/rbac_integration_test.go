package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// setupRBACRouter creates a test router with distinct viewer and editor API keys.
// viewerKeys: ["viewer-api-key"], editorKeys (apiKeys): ["editor-api-key"].
// It returns the handler and the auth provider so callers can issue JWTs that
// are registered in the same session store the router uses.
func setupRBACRouter(t *testing.T) (*http.Handler, *auth.Provider) {
	t.Helper()

	tmpDir := t.TempDir()
	appsDir := filepath.Join(tmpDir, "applications", "2024-03-test-company")
	if err := os.MkdirAll(appsDir, 0750); err != nil {
		t.Fatal(err)
	}
	meta := `company: Test Company
position: Senior Engineer
status: applied
created_at: "2024-03-01T10:00:00Z"
`
	if err := os.WriteFile(filepath.Join(appsDir, "meta.yml"), []byte(meta), 0640); err != nil {
		t.Fatal(err)
	}

	provider := auth.NewProvider(
		"test-secret-that-is-at-least-32-characters-long",
		"testuser", "testpass", "",
		[]string{"editor-api-key"},
		[]string{"viewer-api-key"},
		time.Hour,
	)

	targets := []models.Target{
		{Name: "fetch", Category: "workflow", Description: "Fetch job", Args: []string{"url"}, Timeout: "10s"},
	}

	exec := executor.New(tmpDir, targets, 3, 10*time.Second, 60*time.Second)
	store := storage.New(tmpDir)

	router := NewRouter(RouterConfig{
		AuthProvider:   provider,
		Executor:       exec,
		Storage:        store,
		Audit:          audit.New(),
		AllowedOrigins: []string{"http://localhost:3000"},
		CookieDomain:   "localhost",
		CookieSecure:   false,
		CVPath:         tmpDir,
	})

	h := http.Handler(router)
	return &h, provider
}

// adminJWT issues a Bearer JWT using the given provider so the session is
// registered in the same store the router validates against.
func adminJWT(t *testing.T, p *auth.Provider) string {
	t.Helper()
	token, _, err := p.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue admin JWT: %v", err)
	}
	return token
}

func TestRBAC_ViewerCannotCreateApplication(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	body := `{"company":"ACME","position":"Engineer","status":"applied"}`
	req := httptest.NewRequest(http.MethodPost, "/api/applications", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "viewer-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_ViewerCanListApplications(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	req.Header.Set("X-API-Key", "viewer-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_ViewerCannotAccessAuditLog(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/audit-log", nil)
	req.Header.Set("X-API-Key", "viewer-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_EditorCanCreateApplication(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	body := `{"company":"ACME Corp","position":"Senior Engineer","status":"applied"}`
	req := httptest.NewRequest(http.MethodPost, "/api/applications", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "editor-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_EditorCannotWriteSettings(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	body := `{"theme":"dark","default_view":"board"}`
	req := httptest.NewRequest(http.MethodPut, "/api/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "editor-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_AdminCanWriteSettings(t *testing.T) {
	handler, provider := setupRBACRouter(t)

	token := adminJWT(t, provider)
	body := `{"theme":"dark","default_view":"board"}`
	req := httptest.NewRequest(http.MethodPut, "/api/settings", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_ViewerCannotPatchApplication(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	body := `{"status":"interviewing"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/applications/2024-03-test-company", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "viewer-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_ViewerCanGetApplication(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/2024-03-test-company", nil)
	req.Header.Set("X-API-Key", "viewer-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_EditorCannotAccessAuditLog(t *testing.T) {
	handler, _ := setupRBACRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/audit-log", nil)
	req.Header.Set("X-API-Key", "editor-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRBAC_AdminCanAccessAuditLog(t *testing.T) {
	handler, provider := setupRBACRouter(t)

	token := adminJWT(t, provider)
	req := httptest.NewRequest(http.MethodGet, "/api/audit-log", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
