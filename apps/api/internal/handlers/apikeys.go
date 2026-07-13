package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/auth"
)

// APIKeysHandler manages runtime API key operations.
type APIKeysHandler struct {
	provider *auth.Provider
}

// NewAPIKeysHandler creates a new APIKeysHandler.
func NewAPIKeysHandler(provider *auth.Provider) *APIKeysHandler {
	return &APIKeysHandler{provider: provider}
}

// List returns prefix and role information for all stored API keys.
// Full key values are never returned.
// GET /api/api-keys
func (h *APIKeysHandler) List(w http.ResponseWriter, r *http.Request) {
	keys := h.provider.ListAPIKeys()
	if keys == nil {
		keys = []auth.APIKeyInfo{}
	}
	respondJSON(w, http.StatusOK, map[string]any{"keys": keys})
}

// Generate creates a new API key, adds it to the runtime store, and returns
// the full key exactly once.
// POST /api/api-keys
func (h *APIKeysHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role string `json:"role"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}

	role := auth.RoleEditor
	if req.Role == string(auth.RoleViewer) {
		role = auth.RoleViewer
	}

	key, err := auth.GenerateAPIKey()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to generate API key")
		return
	}

	h.provider.AddAPIKey(key, role)

	prefix := key
	if len(prefix) > 8 {
		prefix = prefix[:8]
	}

	respondJSON(w, http.StatusCreated, map[string]any{
		"key":    key,
		"prefix": prefix,
		"role":   role,
	})
}

// Revoke removes all keys matching the given prefix.
// DELETE /api/api-keys/{prefix}
func (h *APIKeysHandler) Revoke(w http.ResponseWriter, r *http.Request) {
	prefix := chi.URLParam(r, "prefix")
	if prefix == "" {
		respondError(w, http.StatusBadRequest, "Key prefix is required")
		return
	}

	// Find the full key by prefix and revoke it.
	keys := h.provider.ListAPIKeys()
	found := false
	for _, info := range keys {
		if info.Prefix == prefix {
			found = true
			break
		}
	}
	if !found {
		respondError(w, http.StatusNotFound, "No key found with that prefix")
		return
	}

	h.provider.RevokeAPIKeyByPrefix(prefix)
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
