// Package api provides a typed HTTP client for the cv-api server.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const maxResponseBytes = 10 * 1024 * 1024 // 10 MB

const (
	maxRetries = 3
	retryDelay = 500 * time.Millisecond
)

// cacheEntry holds a cached value with an expiry time.
type cacheEntry struct {
	value     any
	expiresAt time.Time
}

// Client is an HTTP client for the cv-api server.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	mu         sync.RWMutex
	cache      map[string]cacheEntry
}

// New creates an API client.
func New(baseURL, apiKey string, timeout time.Duration) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: timeout,
		},
		cache: make(map[string]cacheEntry),
	}
}

// BaseURL returns the configured API base URL (for WebSocket connections).
func (c *Client) BaseURL() string {
	return c.baseURL
}

func (c *Client) cacheGet(key string) (any, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.value, true
}

func (c *Client) cacheSet(key string, val any, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = cacheEntry{
		value:     val,
		expiresAt: time.Now().Add(ttl),
	}
}

// cacheInvalidate removes specific keys from the cache.
// Pass "" to clear all entries.
func (c *Client) cacheInvalidate(keys ...string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, k := range keys {
		if k == "" {
			c.cache = make(map[string]cacheEntry)
			return
		}
		delete(c.cache, k)
	}
}

// cacheInvalidatePrefix removes all cache entries whose key has the given prefix.
func (c *Client) cacheInvalidatePrefix(prefix string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k := range c.cache {
		if strings.HasPrefix(k, prefix) {
			delete(c.cache, k)
		}
	}
}

func (c *Client) get(path string, result any) error {
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	return c.do(req, result)
}

func (c *Client) post(path string, body any, result any) error {
	data, hasBody, err := marshalBody(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if hasBody {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.doOnce(req, result)
}

func (c *Client) put(path string, body any, result any) error {
	data, hasBody, err := marshalBody(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPut, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if hasBody {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.doOnce(req, result)
}

func (c *Client) patch(path string, body any, result any) error {
	data, hasBody, err := marshalBody(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPatch, c.baseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if hasBody {
		req.Header.Set("Content-Type", "application/json")
	}
	return c.doOnce(req, result)
}

func marshalBody(body any) ([]byte, bool, error) {
	if body == nil {
		return nil, false, nil
	}
	data, err := json.Marshal(body)
	if err != nil {
		return nil, false, fmt.Errorf("marshal request: %w", err)
	}
	return data, true, nil
}

// do executes a request with retry logic for GET requests (no body to replay).
func (c *Client) do(req *http.Request, result any) error {
	// Only retry safe/idempotent GET requests (no body to replay).
	if req.Method != http.MethodGet {
		return c.doOnce(req, result)
	}

	delay := retryDelay
	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(delay)
			delay *= 2
		}
		err := c.doOnce(req, result)
		if err == nil {
			return nil
		}
		var urlErr *url.Error
		if !errors.As(err, &urlErr) {
			return err
		}
		lastErr = err
	}
	return lastErr
}

func (c *Client) doOnce(req *http.Request, result any) error {
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request %s %s: %w", req.Method, req.URL.Path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err == nil {
			return fmt.Errorf("API error %d: %s", apiErr.Code, apiErr.Message)
		}
		return fmt.Errorf("API error: HTTP %d", resp.StatusCode)
	}

	if result != nil {
		limited := io.LimitReader(resp.Body, maxResponseBytes)
		if err := json.NewDecoder(limited).Decode(result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// Health checks if the API is reachable.
func (c *Client) Health() error {
	var resp map[string]string
	return c.get("/health", &resp)
}
