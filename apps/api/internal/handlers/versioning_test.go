package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jsoyer/cv-api/internal/storage"
)

const testAppName = "2024-03-test-company"

// TestUpdateNotes_CreatesVersion verifies that updating notes twice produces
// exactly one version entry (the first value, saved before the second write).
func TestUpdateNotes_CreatesVersion(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	writeNotes := func(content string) {
		t.Helper()
		body := `{"content":"` + content + `"}`
		req := httptest.NewRequest(http.MethodPut, "/api/applications/"+testAppName+"/notes", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", "test-api-key")
		w := httptest.NewRecorder()
		(*handler).ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("write notes: expected 200, got %d: %s", w.Code, w.Body.String())
		}
	}

	writeNotes("first version content")
	writeNotes("second version content")

	req := httptest.NewRequest(http.MethodGet, "/api/applications/"+testAppName+"/notes/versions", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("list versions: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var versions []storage.NoteVersion
	if err := json.NewDecoder(w.Body).Decode(&versions); err != nil {
		t.Fatalf("decode versions: %v", err)
	}
	if len(versions) != 1 {
		t.Fatalf("expected 1 version after two writes, got %d", len(versions))
	}
}

// TestGetNoteVersion_ReturnsContent verifies that the stored version content
// matches the value that was active before the subsequent write.
func TestGetNoteVersion_ReturnsContent(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	firstContent := "original notes content"

	writeNotes := func(content string) {
		t.Helper()
		body := `{"content":"` + content + `"}`
		req := httptest.NewRequest(http.MethodPut, "/api/applications/"+testAppName+"/notes", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-API-Key", "test-api-key")
		w := httptest.NewRecorder()
		(*handler).ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("write notes: expected 200, got %d: %s", w.Code, w.Body.String())
		}
	}

	writeNotes(firstContent)
	writeNotes("updated notes content")

	listReq := httptest.NewRequest(http.MethodGet, "/api/applications/"+testAppName+"/notes/versions", nil)
	listReq.Header.Set("X-API-Key", "test-api-key")
	listW := httptest.NewRecorder()
	(*handler).ServeHTTP(listW, listReq)

	if listW.Code != http.StatusOK {
		t.Fatalf("list versions: expected 200, got %d", listW.Code)
	}

	var versions []storage.NoteVersion
	if err := json.NewDecoder(listW.Body).Decode(&versions); err != nil {
		t.Fatalf("decode versions: %v", err)
	}
	if len(versions) == 0 {
		t.Fatal("expected at least one version")
	}

	filename := versions[0].Filename
	getReq := httptest.NewRequest(http.MethodGet, "/api/applications/"+testAppName+"/notes/versions/"+filename, nil)
	getReq.Header.Set("X-API-Key", "test-api-key")
	getW := httptest.NewRecorder()
	(*handler).ServeHTTP(getW, getReq)

	if getW.Code != http.StatusOK {
		t.Fatalf("get version: expected 200, got %d: %s", getW.Code, getW.Body.String())
	}

	got := getW.Body.String()
	if got != firstContent {
		t.Fatalf("version content mismatch: expected %q, got %q", firstContent, got)
	}
}

// TestListNoteVersions_EmptyWhenNone verifies that listing versions for an
// application that has never had notes updated returns an empty array.
func TestListNoteVersions_EmptyWhenNone(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications/"+testAppName+"/notes/versions", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var versions []storage.NoteVersion
	if err := json.NewDecoder(w.Body).Decode(&versions); err != nil {
		t.Fatalf("decode versions: %v", err)
	}
	if len(versions) != 0 {
		t.Fatalf("expected empty versions, got %d", len(versions))
	}
}
