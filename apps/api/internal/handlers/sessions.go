package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/auth"
)

// SessionsHandler exposes session management endpoints.
type SessionsHandler struct {
	provider *auth.Provider
}

// NewSessionsHandler creates a new SessionsHandler.
func NewSessionsHandler(provider *auth.Provider) *SessionsHandler {
	return &SessionsHandler{provider: provider}
}

// List returns all active (non-expired) sessions.
// GET /api/sessions
func (h *SessionsHandler) List(w http.ResponseWriter, r *http.Request) {
	sessions := h.provider.Sessions.List()
	if sessions == nil {
		sessions = []*auth.Session{}
	}
	respondJSON(w, http.StatusOK, map[string]any{"sessions": sessions})
}

// Revoke removes a session by jti.
// DELETE /api/sessions/{id}
func (h *SessionsHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		respondError(w, http.StatusBadRequest, "Session ID is required")
		return
	}
	h.provider.RevokeSession(id)
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
