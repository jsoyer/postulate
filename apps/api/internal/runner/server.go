package runner

import (
	"crypto/subtle"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
)

// Server holds the dependencies shared across HTTP handlers.
type Server struct {
	store *JobStore
}

// Router returns the chi router for cv-runner. It registers all routes and
// middleware. The secret is the shared RUNNER_SECRET used to authenticate
// requests from cv-api.
func Router(secret string, store *JobStore) http.Handler {
	s := &Server{store: store}

	r := chi.NewRouter()

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Recoverer)
	r.Use(requestLogger)

	// Health is public — no secret required.
	r.Get("/health", s.handleHealth)

	// All other routes require the shared secret.
	r.Group(func(r chi.Router) {
		r.Use(secretAuth(secret))
		r.Post("/jobs", s.handleCreateJob)
		r.Get("/jobs/{id}", s.handleGetJob)
		r.Get("/jobs/{id}/stream", s.streamSSE)
		r.Delete("/jobs/{id}", s.handleCancelJob)
	})

	return r
}

// secretAuth returns middleware that validates the X-Runner-Secret header
// using a constant-time comparison to prevent timing attacks.
func secretAuth(secret string) func(http.Handler) http.Handler {
	secretBytes := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			provided := r.Header.Get("X-Runner-Secret")
			if subtle.ConstantTimeCompare([]byte(provided), secretBytes) != 1 {
				writeError(w, http.StatusUnauthorized, "unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// requestLogger is a minimal structured logging middleware. It logs method,
// path, status, the chi-assigned request ID, and the upstream X-Request-ID
// forwarded by cv-api for end-to-end correlation.
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ww := chimiddleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"request_id", chimiddleware.GetReqID(r.Context()),
			"upstream_request_id", r.Header.Get("X-Request-ID"),
		)
	})
}

// handleCreateJob handles POST /jobs.
func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var req CreateJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	job, err := s.store.Create(req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusAccepted, CreateJobResponse{
		JobID:  job.ID,
		Status: string(job.Status),
	})
}

// handleGetJob handles GET /jobs/{id}.
func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	job, ok := s.store.GetJob(id)
	if !ok {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}

	writeJSON(w, http.StatusOK, job.toResponse())
}

// handleCancelJob handles DELETE /jobs/{id}.
func (s *Server) handleCancelJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if !s.store.CancelJob(id) {
		writeError(w, http.StatusNotFound, "job not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// writeJSON encodes v as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
