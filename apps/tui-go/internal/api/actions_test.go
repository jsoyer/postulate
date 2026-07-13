package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// acceptWS upgrades an HTTP connection to WebSocket for test servers.
func acceptWS(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	return websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
}

// TestStreamActionMessages verifies that the callback receives all messages
// sent by the server in order.
func TestStreamActionMessages(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := acceptWS(w, r)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		ctx := context.Background()
		conn.Write(ctx, websocket.MessageText, []byte(`{"type":"stdout","data":"hello from test"}`))
		conn.Write(ctx, websocket.MessageText, []byte(`{"type":"exit","data":"0"}`))
		conn.Close(websocket.StatusNormalClosure, "")
	}))
	defer srv.Close()

	wsURL := strings.Replace(srv.URL, "http://", "ws://", 1)
	client := New(wsURL, "test-key", 5*time.Second)

	var mu sync.Mutex
	var received []WSMessage
	err := client.StreamAction(context.Background(), "test-target", "", func(msg WSMessage) {
		mu.Lock()
		defer mu.Unlock()
		received = append(received, msg)
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(received) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(received))
	}
	if received[0].Type != "stdout" || received[0].Data != "hello from test" {
		t.Errorf("unexpected first message: %+v", received[0])
	}
	if received[1].Type != "exit" || received[1].Data != "0" {
		t.Errorf("unexpected second message: %+v", received[1])
	}
}

// TestStreamActionNormalClose verifies that a normal server close returns nil.
func TestStreamActionNormalClose(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := acceptWS(w, r)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		// Close normally without sending any messages.
		conn.Close(websocket.StatusNormalClosure, "")
	}))
	defer srv.Close()

	wsURL := strings.Replace(srv.URL, "http://", "ws://", 1)
	client := New(wsURL, "test-key", 5*time.Second)

	err := client.StreamAction(context.Background(), "test-target", "", func(WSMessage) {})
	if err != nil {
		t.Fatalf("expected nil on normal close, got: %v", err)
	}
}

// TestStreamActionMessageOrder verifies multiple messages arrive in send order.
func TestStreamActionMessageOrder(t *testing.T) {
	t.Parallel()

	messages := [][]byte{
		[]byte(`{"type":"stdout","data":"line1"}`),
		[]byte(`{"type":"stdout","data":"line2"}`),
		[]byte(`{"type":"stdout","data":"line3"}`),
		[]byte(`{"type":"exit","data":"0"}`),
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := acceptWS(w, r)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		ctx := context.Background()
		for _, m := range messages {
			conn.Write(ctx, websocket.MessageText, m)
		}
		conn.Close(websocket.StatusNormalClosure, "")
	}))
	defer srv.Close()

	wsURL := strings.Replace(srv.URL, "http://", "ws://", 1)
	client := New(wsURL, "test-key", 5*time.Second)

	var received []WSMessage
	_ = client.StreamAction(context.Background(), "test-target", "", func(msg WSMessage) {
		received = append(received, msg)
	})

	// Should receive all 4 messages (exit stops the loop).
	if len(received) < 4 {
		t.Fatalf("expected at least 4 messages, got %d: %v", len(received), received)
	}
	expected := []struct{ typ, data string }{
		{"stdout", "line1"},
		{"stdout", "line2"},
		{"stdout", "line3"},
		{"exit", "0"},
	}
	for i, e := range expected {
		if received[i].Type != e.typ || received[i].Data != e.data {
			t.Errorf("message[%d]: expected {%s %s}, got %+v", i, e.typ, e.data, received[i])
		}
	}
}

// TestStreamActionAPIKeyHeader verifies the X-API-Key header is sent on the WS upgrade.
func TestStreamActionAPIKeyHeader(t *testing.T) {
	t.Parallel()

	var gotKey string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("X-API-Key")
		conn, err := acceptWS(w, r)
		if err != nil {
			return
		}
		conn.Close(websocket.StatusNormalClosure, "")
	}))
	defer srv.Close()

	wsURL := strings.Replace(srv.URL, "http://", "ws://", 1)
	client := New(wsURL, "my-secret", 5*time.Second)
	_ = client.StreamAction(context.Background(), "target", "", func(WSMessage) {})

	if gotKey != "my-secret" {
		t.Errorf("expected X-API-Key 'my-secret', got %q", gotKey)
	}
}

// TestStreamActionContextCancel verifies that cancelling the context stops streaming.
func TestStreamActionContextCancel(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := acceptWS(w, r)
		if err != nil {
			return
		}
		defer conn.CloseNow()

		// Keep connection open; client should disconnect via context cancel.
		ctx := r.Context()
		<-ctx.Done()
	}))
	defer srv.Close()

	wsURL := strings.Replace(srv.URL, "http://", "ws://", 1)
	client := New(wsURL, "test-key", 5*time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := client.StreamAction(ctx, "target", "", func(WSMessage) {})
	// A cancelled context should return nil (not an error).
	if err != nil {
		t.Errorf("expected nil on context cancel, got: %v", err)
	}
}
