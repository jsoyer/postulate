package handlers

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// setupRouterWithMetrics builds a test router that wires in a live metrics registry.
func setupRouterWithMetrics(t *testing.T) (*http.Handler, *metrics.Registry, string) {
	t.Helper()
	h, _, reg, tmpDir := setupRouterWithMetricsFull(t)
	return h, reg, tmpDir
}

// setupRouterWithMetricsFull is the full version that also returns the auth provider.
func setupRouterWithMetricsFull(t *testing.T) (*http.Handler, *auth.Provider, *metrics.Registry, string) {
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
		[]string{"test-api-key"},
		nil,
		time.Hour,
	)

	targets := []models.Target{
		{Name: "fetch", Category: "workflow", Description: "Fetch job", Args: []string{"url"}, Timeout: "10s"},
	}

	exec := executor.New(tmpDir, targets, 3, 10*time.Second, 60*time.Second)
	store := storage.New(tmpDir)
	reg := metrics.New()

	router := NewRouter(RouterConfig{
		AuthProvider:   provider,
		Executor:       exec,
		Storage:        store,
		Metrics:        reg,
		AllowedOrigins: []string{"http://localhost:3000"},
		CookieDomain:   "localhost",
		CookieSecure:   false,
		CVPath:         tmpDir,
	})

	h := http.Handler(router)
	return &h, provider, reg, tmpDir
}

// ------------------------------------------------------------------ Backup

func TestBackup_StreamsTarGz(t *testing.T) {
	// Use the metrics-enabled router which properly wires CVPath.
	handler, provider, _, tmpDir := setupRouterWithMetricsFull(t)

	// Add a second file so the archive has content beyond the meta.yml.
	appDir := filepath.Join(tmpDir, "applications", "2024-03-test-company")
	if err := os.WriteFile(filepath.Join(appDir, "notes.md"), []byte("interview notes"), 0640); err != nil {
		t.Fatal(err)
	}

	// Backup requires admin role; issue an admin JWT.
	token, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue JWT: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/backup", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	ct := w.Header().Get("Content-Type")
	if ct != "application/gzip" {
		t.Errorf("expected Content-Type application/gzip, got %q", ct)
	}

	cd := w.Header().Get("Content-Disposition")
	if cd == "" {
		t.Error("expected Content-Disposition header to be set")
	}

	// Verify the body is a valid gzip-wrapped tar archive.
	gr, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatalf("gzip.NewReader: %v", err)
	}
	defer func() { _ = gr.Close() }()

	tr := tar.NewReader(gr)
	var entries []string
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("tar.Next: %v", err)
		}
		entries = append(entries, hdr.Name)
	}

	if len(entries) == 0 {
		t.Error("expected at least one entry in the tar archive")
	}
}

func TestBackup_Unauthenticated(t *testing.T) {
	handler, _, _ := setupRouterWithMetrics(t)

	req := httptest.NewRequest(http.MethodGet, "/api/backup", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

// ------------------------------------------------------------------ Health with metrics

func TestHealth_WithMetrics(t *testing.T) {
	handler, reg, _ := setupRouterWithMetrics(t)

	// Record some calls so the map is non-empty.
	reg.AIProviderCalls.Inc("gemini", "tailor-cv", "ok")
	reg.AIProviderCalls.Inc("gemini", "tailor-cv", "ok")
	reg.AIProviderCalls.Inc("anthropic", "research", "ok")

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		AIProviderCalls map[string]int64 `json:"ai_provider_calls"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if resp.AIProviderCalls == nil {
		t.Fatal("expected ai_provider_calls to be present in response")
	}
	if resp.AIProviderCalls["gemini"] != 2 {
		t.Errorf("expected gemini=2, got %d", resp.AIProviderCalls["gemini"])
	}
	if resp.AIProviderCalls["anthropic"] != 1 {
		t.Errorf("expected anthropic=1, got %d", resp.AIProviderCalls["anthropic"])
	}
}

// ------------------------------------------------------------------ Restore

// buildRestoreRequest constructs a multipart POST request containing a minimal
// in-memory tar.gz archive with a single file entry.
func buildRestoreRequest(t *testing.T, url string, token string) *http.Request {
	t.Helper()

	var archiveBuf bytes.Buffer
	gz := gzip.NewWriter(&archiveBuf)
	tw := tar.NewWriter(gz)

	content := []byte("company: Restored Company\n")
	hdr := &tar.Header{
		Name: "2024-01-restored/meta.yml",
		Mode: 0640,
		Size: int64(len(content)),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		t.Fatalf("tar write header: %v", err)
	}
	if _, err := tw.Write(content); err != nil {
		t.Fatalf("tar write content: %v", err)
	}
	if err := tw.Close(); err != nil {
		t.Fatalf("tar close: %v", err)
	}
	if err := gz.Close(); err != nil {
		t.Fatalf("gzip close: %v", err)
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	fw, err := mw.CreateFormFile("backup", "backup.tar.gz")
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := io.Copy(fw, &archiveBuf); err != nil {
		t.Fatalf("copy archive: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("multipart close: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, url, &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return req
}

func TestRestore_Unauthenticated(t *testing.T) {
	handler, _, _ := setupRouterWithMetrics(t)

	req := buildRestoreRequest(t, "/api/restore", "")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRestore_ViewerForbidden(t *testing.T) {
	handler, provider, _, _ := setupRouterWithMetricsFull(t)

	token, _, err := provider.IssueJWT("testuser", auth.RoleViewer, "", "")
	if err != nil {
		t.Fatalf("issue JWT: %v", err)
	}

	req := buildRestoreRequest(t, "/api/restore", token)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestRestore_InvalidContentType(t *testing.T) {
	handler, provider, _, _ := setupRouterWithMetricsFull(t)

	token, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue JWT: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/restore", bytes.NewBufferString("not multipart"))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/octet-stream")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
}
