package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/models"
)

// SSEHandler handles Server-Sent Events connections for streaming Make output.
type SSEHandler struct {
	exec     *executor.Executor
	provider *auth.Provider
}

// NewSSEHandler creates a new SSE handler.
func NewSSEHandler(exec *executor.Executor, provider *auth.Provider) *SSEHandler {
	return &SSEHandler{exec: exec, provider: provider}
}

// Stream handles GET /api/stream/{target}.
// Authenticates the request, validates the target, reads args from query params,
// and streams process output as Server-Sent Events.
func (h *SSEHandler) Stream(w http.ResponseWriter, r *http.Request) {
	// Authenticate before writing SSE headers so we can return clean JSON errors.
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

	// http.ResponseController handles unwrapping middleware-wrapped writers,
	// so we can flush even when a middleware has wrapped the ResponseWriter.
	rc := http.NewResponseController(w)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if err := rc.Flush(); err != nil {
		slog.Error("sse initial flush failed", "error", err)
		return
	}

	// Build ActionRequest from query parameters.
	q := r.URL.Query()
	args := make(map[string]string)
	for k, vals := range q {
		if k == "token" || k == "app" {
			continue
		}
		if len(vals) > 0 {
			args[k] = vals[0]
		}
	}

	req := models.ActionRequest{
		Target:      target,
		Application: q.Get("app"),
		Args:        args,
	}

	slog.Info("sse stream started", "target", target, "app", req.Application)

	err = h.exec.RunStreaming(r.Context(), req, func(msg models.WSMessage) {
		writeSSEEvent(w, rc, msg)
	})

	if err != nil {
		writeSSEEvent(w, rc, models.WSMessage{Type: "error", Data: err.Error()})
	}
}

// writeSSEEvent serialises msg and writes a single SSE data frame to w, then flushes.
func writeSSEEvent(w http.ResponseWriter, rc *http.ResponseController, msg models.WSMessage) {
	b, err := json.Marshal(msg)
	if err != nil {
		slog.Error("sse marshal failed", "error", err)
		return
	}
	_, _ = fmt.Fprintf(w, "data: %s\n\n", b)
	if flushErr := rc.Flush(); flushErr != nil {
		slog.Warn("sse flush failed", "error", flushErr)
	}
}
