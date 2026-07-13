package handlers

import (
	"net/http"

	"github.com/jsoyer/cv-api/internal/audit"
)

// AuditHandler serves the audit log retrieval endpoint.
type AuditHandler struct {
	logger *audit.Logger
}

// NewAuditHandler creates an AuditHandler backed by the given audit Logger.
func NewAuditHandler(logger *audit.Logger) *AuditHandler {
	return &AuditHandler{logger: logger}
}

// List returns the last 100 audit entries as JSON.
// GET /api/audit-log — authentication required.
func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	entries := h.logger.Recent(100)
	respondJSON(w, http.StatusOK, entries)
}
