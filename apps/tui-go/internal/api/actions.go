package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coder/websocket"
)

const (
	ttlTargets        = 300 * time.Second
	wsMaxMessageBytes = 1 << 20 // 1 MiB
)

// ExecuteAction sends a Make target execution request.
func (c *Client) ExecuteAction(target, application string, args map[string]string) (*ActionResult, error) {
	body := map[string]any{
		"application": application,
		"args":        args,
	}
	var result ActionResult
	if err := c.post("/api/actions/"+url.PathEscape(target), body, &result); err != nil {
		return nil, err
	}
	c.cacheInvalidate("applications:all", "dashboard", "stats")
	c.cacheInvalidatePrefix("applications:")
	return &result, nil
}

// GetActionStatus polls a running job for its result.
func (c *Client) GetActionStatus(jobID string) (*ActionResult, error) {
	var result ActionResult
	if err := c.get("/api/actions/jobs/"+jobID, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListTargets returns all allowed Make targets.
func (c *Client) ListTargets() ([]Target, error) {
	if cached, ok := c.cacheGet("targets"); ok {
		if targets, ok := cached.([]Target); ok {
			return targets, nil
		}
	}
	var targets []Target
	if err := c.get("/api/targets", &targets); err != nil {
		return nil, err
	}
	c.cacheSet("targets", targets, ttlTargets)
	return targets, nil
}

// StreamAction opens a WebSocket to stream action output.
// Authentication uses X-API-Key header (not query param).
// The callback is invoked for each message received.
// This blocks until the action completes, the context is cancelled, or the connection is closed.
func (c *Client) StreamAction(ctx context.Context, target, application string, onMessage func(WSMessage)) error {
	wsBase := strings.NewReplacer("http://", "ws://", "https://", "wss://").Replace(c.baseURL)
	rawURL := wsBase + "/ws/actions/" + url.PathEscape(target)
	if application != "" {
		rawURL += "?app=" + url.QueryEscape(application)
	}

	conn, resp, err := websocket.Dial(ctx, rawURL, &websocket.DialOptions{
		HTTPHeader: http.Header{"X-API-Key": []string{c.apiKey}},
	})
	if err != nil {
		return fmt.Errorf("WebSocket connect: %w", err)
	}
	if resp != nil && resp.Body != nil {
		defer func() { _ = resp.Body.Close() }()
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(wsMaxMessageBytes)

	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				return nil
			}
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("WebSocket read: %w", err)
		}

		var msg WSMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		onMessage(msg)

		if msg.Type == "exit" || msg.Type == "error" {
			_ = conn.Close(websocket.StatusNormalClosure, "")
			return nil
		}
	}
}
