package handlers

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/models"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		// Origin validation is handled by the CORS middleware;
		// allow the upgrade if the request made it this far.
		return true
	},
}

// WSHandler handles WebSocket connections for streaming Make output.
type WSHandler struct {
	exec     *executor.Executor
	provider *auth.Provider
	metrics  *metrics.Registry
}

// NewWSHandler creates a new WebSocket handler.
func NewWSHandler(exec *executor.Executor, provider *auth.Provider, reg *metrics.Registry) *WSHandler {
	return &WSHandler{exec: exec, provider: provider, metrics: reg}
}

// Stream upgrades to WebSocket and streams Make target output in real-time.
// WS /ws/actions/{target}
//
// Authentication is validated during the WebSocket handshake using the
// token query parameter or session cookie. Requires at least RoleEditor.
//
// Protocol:
//
//	Client sends: ActionRequest JSON as first message
//	Server sends: WSMessage with type "stdout", "stderr", "exit", or "error"
//	Connection closes after the Make process exits.
func (h *WSHandler) Stream(w http.ResponseWriter, r *http.Request) {
	// Authenticate before upgrading
	_, _, role, err := h.provider.Authenticate(r)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}
	if !auth.HasMinimumRole(role, auth.RoleEditor) {
		respondError(w, http.StatusForbidden, "Insufficient permissions")
		return
	}

	target := chi.URLParam(r, "target")
	if target == "" {
		respondError(w, http.StatusBadRequest, "Target is required")
		return
	}

	if !h.exec.IsAllowed(target) {
		respondError(w, http.StatusForbidden, "Target '"+target+"' is not in the allowlist")
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}
	if h.metrics != nil {
		h.metrics.WSConnectionsActive.Inc()
	}
	done := make(chan struct{})
	defer func() {
		close(done)
		if h.metrics != nil {
			h.metrics.WSConnectionsActive.Dec()
		}
		_ = conn.Close()
	}()

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
					slog.Warn("websocket ping failed", "error", err)
					if err := conn.SetWriteDeadline(time.Now().Add(60 * time.Second)); err != nil {
						slog.Warn("websocket set write deadline failed", "error", err)
					}
					return
				}
			}
		}
	}()

	// Read the action request from the client
	var req models.ActionRequest
	if err := conn.ReadJSON(&req); err != nil {
		slog.Error("websocket read request failed", "error", err)
		writeWSError(conn, "Failed to read action request: "+err.Error())
		return
	}
	req.Target = target

	slog.Info("websocket stream started", "target", target, "app", req.Application)

	// Stream the output
	err = h.exec.RunStreaming(r.Context(), req, func(msg models.WSMessage) {
		if writeErr := conn.WriteJSON(msg); writeErr != nil {
			slog.Error("websocket write failed", "error", writeErr)
		}
	})

	if err != nil {
		writeWSError(conn, err.Error())
	}
}

func writeWSError(conn *websocket.Conn, message string) {
	_ = conn.WriteJSON(models.WSMessage{Type: "error", Data: message})
}
