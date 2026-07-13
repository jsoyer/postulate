package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// cache unit tests (white-box, same package)
// ---------------------------------------------------------------------------

// newTestClient returns a client with no real server for cache-only tests.
func newTestClient() *Client {
	return New("http://test-host", "test-key", 5*time.Second)
}

func TestCacheGetSetExpiry(t *testing.T) {
	t.Parallel()

	c := newTestClient()
	c.cacheSet("key", "value", 50*time.Millisecond)

	// Hit before expiry
	v, ok := c.cacheGet("key")
	if !ok {
		t.Fatal("expected cache hit before expiry")
	}
	if v.(string) != "value" {
		t.Fatalf("expected 'value', got %q", v)
	}

	// Wait for expiry
	time.Sleep(100 * time.Millisecond)

	_, ok = c.cacheGet("key")
	if ok {
		t.Fatal("expected cache miss after expiry")
	}
}

func TestCacheInvalidate(t *testing.T) {
	t.Parallel()

	c := newTestClient()
	c.cacheSet("alpha", 1, time.Minute)
	c.cacheSet("beta", 2, time.Minute)

	c.cacheInvalidate("alpha")

	_, ok := c.cacheGet("alpha")
	if ok {
		t.Error("expected alpha to be invalidated")
	}

	v, ok := c.cacheGet("beta")
	if !ok {
		t.Fatal("expected beta to still be present")
	}
	if v.(int) != 2 {
		t.Fatalf("expected 2, got %v", v)
	}
}

func TestCacheInvalidatePrefix(t *testing.T) {
	t.Parallel()

	c := newTestClient()
	c.cacheSet("apps:all", "all", time.Minute)
	c.cacheSet("apps:applied", "applied", time.Minute)
	c.cacheSet("dashboard", "dash", time.Minute)

	c.cacheInvalidatePrefix("apps:")

	_, ok := c.cacheGet("apps:all")
	if ok {
		t.Error("expected apps:all to be invalidated")
	}
	_, ok = c.cacheGet("apps:applied")
	if ok {
		t.Error("expected apps:applied to be invalidated")
	}

	v, ok := c.cacheGet("dashboard")
	if !ok {
		t.Fatal("expected dashboard to survive prefix invalidation")
	}
	if v.(string) != "dash" {
		t.Fatalf("expected 'dash', got %q", v)
	}
}

func TestCacheConcurrentAccess(t *testing.T) {
	t.Parallel()

	c := newTestClient()
	const goroutines = 50
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for i := 0; i < goroutines; i++ {
		i := i
		go func() {
			defer wg.Done()
			key := fmt.Sprintf("key-%d", i%5)
			c.cacheSet(key, i, 100*time.Millisecond)
			c.cacheGet(key)
			if i%3 == 0 {
				c.cacheInvalidate(key)
			}
		}()
	}
	wg.Wait()
}

// ---------------------------------------------------------------------------
// HTTP client tests
// ---------------------------------------------------------------------------

func TestClientHealthOK(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"status":"ok"}`)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	if err := client.Health(); err != nil {
		t.Fatalf("expected healthy, got error: %v", err)
	}
}

func TestClientHealthDown(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	if err := client.Health(); err == nil {
		t.Fatal("expected error for 503 response")
	}
}

// TestClientNoRetryOnHTTPError verifies that HTTP-level errors (4xx/5xx) are
// not retried — only network-level errors trigger the retry loop.
func TestClientNoRetryOnHTTPError(t *testing.T) {
	t.Parallel()

	var callCount int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&callCount, 1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 5*time.Second)
	if err := client.Health(); err == nil {
		t.Fatal("expected error for 503 response")
	}
	if count := atomic.LoadInt32(&callCount); count != 1 {
		t.Errorf("expected exactly 1 attempt for HTTP error, got %d", count)
	}
}

func TestResponseBodyLimit(t *testing.T) {
	t.Parallel()

	// Serve a response body larger than the 10 MB limit.
	const bodySize = 15 * 1024 * 1024 // 15 MB

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		// Write invalid JSON that is very large; the LimitReader will cut it off,
		// causing a JSON decode error rather than OOM.
		w.Write([]byte("["))
		chunk := strings.Repeat("x", 4096)
		written := 1
		for written < bodySize {
			n := len(chunk)
			if written+n > bodySize {
				n = bodySize - written
			}
			w.Write([]byte(chunk[:n]))
			written += n
		}
		w.Write([]byte("]"))
	}))
	defer srv.Close()

	client := New(srv.URL, "test-key", 30*time.Second)
	var result []json.RawMessage
	err := client.get("/health", &result)
	// With LimitReader the response is truncated; JSON decode should fail.
	if err == nil {
		t.Fatal("expected decode error from oversized body, got nil")
	}
}

func TestClientAPIKeyHeader(t *testing.T) {
	t.Parallel()

	var receivedKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedKey = r.Header.Get("X-API-Key")
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok"}`)
	}))
	defer srv.Close()

	client := New(srv.URL, "secret-api-key", 5*time.Second)
	_ = client.Health()

	if receivedKey != "secret-api-key" {
		t.Fatalf("expected X-API-Key header 'secret-api-key', got %q", receivedKey)
	}
}
