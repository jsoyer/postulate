package handlers

import (
	"net/http"

	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// SettingsHandler handles user settings.
type SettingsHandler struct {
	store *storage.Storage
	audit *audit.Logger
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(store *storage.Storage, auditLog *audit.Logger) *SettingsHandler {
	return &SettingsHandler{store: store, audit: auditLog}
}

// Get returns current settings.
// GET /api/settings
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	settings, err := h.store.ReadSettings()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to read settings")
		return
	}
	respondJSON(w, http.StatusOK, settings)
}

// Update saves new settings.
// PUT /api/settings
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var settings models.Settings
	if !decodeJSON(w, r, &settings) {
		return
	}

	if err := h.store.WriteSettings(settings); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save settings")
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action: "settings_update",
			User:   middleware.UserFromContext(r.Context()),
			IP:     audit.IPFromRequest(r),
			Result: "ok",
		})
	}

	respondJSON(w, http.StatusOK, settings)
}
