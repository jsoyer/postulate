package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/jsoyer/cv-api/internal/models"
)

// respondJSON writes a JSON response with the given status code.
func respondJSON(w http.ResponseWriter, code int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to encode response", "error", err)
	}
}

// respondError writes a standardized error response.
func respondError(w http.ResponseWriter, code int, message string) {
	respondJSON(w, code, models.APIError{Code: code, Message: message})
}

// decodeJSON reads and decodes a JSON request body into the given target.
// Returns false and writes an error response if decoding fails.
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if r.Body == nil {
		respondError(w, http.StatusBadRequest, "Request body is required")
		return false
	}
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid JSON")
		return false
	}
	return true
}
