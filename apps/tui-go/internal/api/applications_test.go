package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// TestListApplicationsCached verifies that a second call within the TTL
// does not hit the server again.
func TestListApplicationsCached(t *testing.T) {
	t.Parallel()

	var callCount int32
	apps := []Application{
		{Name: "acme-sre", Company: "Acme", Position: "SRE", Status: "applied"},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&callCount, 1)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(apps)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)

	// First call — should hit the server.
	result1, err := client.ListApplications()
	if err != nil {
		t.Fatalf("first call error: %v", err)
	}
	if len(result1) != 1 {
		t.Fatalf("expected 1 app, got %d", len(result1))
	}

	// Second call — should come from cache.
	result2, err := client.ListApplications()
	if err != nil {
		t.Fatalf("second call error: %v", err)
	}
	if len(result2) != 1 {
		t.Fatalf("expected 1 app from cache, got %d", len(result2))
	}

	if count := atomic.LoadInt32(&callCount); count != 1 {
		t.Errorf("expected server to be called once, got %d", count)
	}
}

// TestListApplicationsEmptySlice verifies a nil JSON array returns empty slice.
func TestListApplicationsEmptySlice(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, "null")
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	apps, err := client.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if apps == nil {
		t.Error("expected empty (non-nil) slice, got nil")
	}
	if len(apps) != 0 {
		t.Errorf("expected 0 apps, got %d", len(apps))
	}
}

// TestCreateApplicationInvalidatesCache verifies that creating an application
// clears the cached list so the next ListApplications call hits the server.
func TestCreateApplicationInvalidatesCache(t *testing.T) {
	t.Parallel()

	var callCount int32
	apps := []Application{
		{Name: "acme-sre", Company: "Acme", Position: "SRE", Status: "applied"},
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/applications":
			atomic.AddInt32(&callCount, 1)
			json.NewEncoder(w).Encode(apps)
		case r.Method == http.MethodPost && r.URL.Path == "/api/applications":
			newApp := Application{Name: "beta-eng", Company: "Beta", Position: "Eng", Status: "applied"}
			apps = append(apps, newApp)
			json.NewEncoder(w).Encode(newApp)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)

	// First list call — hits server (count=1), caches result.
	_, err := client.ListApplications()
	if err != nil {
		t.Fatalf("first list error: %v", err)
	}

	// Create — should invalidate cache.
	_, err = client.CreateApplication("Beta", "Eng", "")
	if err != nil {
		t.Fatalf("create error: %v", err)
	}

	// Second list — cache was invalidated, must hit server again (count=2).
	result, err := client.ListApplications()
	if err != nil {
		t.Fatalf("second list error: %v", err)
	}
	if len(result) != 2 {
		t.Errorf("expected 2 apps after create, got %d", len(result))
	}

	if count := atomic.LoadInt32(&callCount); count != 2 {
		t.Errorf("expected server /api/applications to be called twice, got %d", count)
	}
}

// TestGetApplicationByName verifies fetching a single application by name.
func TestGetApplicationByName(t *testing.T) {
	t.Parallel()

	app := Application{Name: "acme-sre", Company: "Acme", Position: "SRE", Status: "applied"}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/applications/acme-sre" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(app)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	result, err := client.GetApplication("acme-sre")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Company != "Acme" {
		t.Errorf("expected Acme, got %q", result.Company)
	}
}

// TestListApplicationsServerError verifies errors are propagated.
func TestListApplicationsServerError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, `{"code":500,"message":"internal error"}`)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	_, err := client.ListApplications()
	if err == nil {
		t.Fatal("expected error for 500 response")
	}
}
