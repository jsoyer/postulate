package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// JobMatchHandler handles job match AI scoring endpoints.
type JobMatchHandler struct {
	store  *storage.Storage
	exec   *executor.Executor
	audit  *audit.Logger
	cvPath string
}

// NewJobMatchHandler creates a new JobMatchHandler.
func NewJobMatchHandler(store *storage.Storage, exec *executor.Executor, auditLog *audit.Logger, cvPath string) *JobMatchHandler {
	return &JobMatchHandler{
		store:  store,
		exec:   exec,
		audit:  auditLog,
		cvPath: cvPath,
	}
}

// RunJobMatch executes the job match AI analysis for an application.
// POST /api/applications/{name}/match
func (h *JobMatchHandler) RunJobMatch(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	if _, err := h.store.GetApplication(name); err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read application")
		return
	}

	if !h.exec.IsAllowed("job-match") {
		respondError(w, http.StatusNotImplemented, "Job match target not configured — add 'job-match' to targets.yml")
		return
	}

	var req models.JobMatchRequest
	if r.Body != nil && r.ContentLength > 0 {
		if !decodeJSON(w, r, &req) {
			return
		}
	}

	args := map[string]string{"name": name}
	if req.AI != "" {
		args["ai"] = req.AI
	}
	if req.Threshold > 0 {
		args["threshold"] = strconv.Itoa(req.Threshold)
	}

	actionReq := models.ActionRequest{
		Target: "job-match",
		Args:   args,
	}

	user := middleware.UserFromContext(r.Context())
	slog.Info("job match requested", "name", name, "user", user, "ai", req.AI, "threshold", req.Threshold)

	job, err := h.exec.Run(r.Context(), actionReq)
	if err != nil {
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Job match execution failed")
		return
	}

	if job.Status != executor.JobCompleted {
		respondError(w, http.StatusInternalServerError, "Job match analysis failed: "+job.Stderr)
		return
	}

	matchPath := filepath.Join(h.cvPath, "applications", name, "job-match.json")
	data, err := os.ReadFile(matchPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, http.StatusInternalServerError, "Job match result not found after execution")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read job match result")
		return
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		respondError(w, http.StatusInternalServerError, "Invalid job match result")
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "job_match_execute",
			Resource: name,
			User:     user,
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
			Detail:   fmt.Sprintf("ai=%s threshold=%d", req.AI, req.Threshold),
		})
	}

	respondJSON(w, http.StatusOK, result)
}

// GetJobMatch returns a cached job match analysis result.
// GET /api/applications/{name}/match
func (h *JobMatchHandler) GetJobMatch(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	if _, err := h.store.GetApplication(name); err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read application")
		return
	}

	matchPath := filepath.Join(h.cvPath, "applications", name, "job-match.json")
	data, err := os.ReadFile(matchPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, http.StatusNotFound, "No job match result found — run POST /api/applications/"+name+"/match first")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read job match result")
		return
	}

	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		respondError(w, http.StatusInternalServerError, "Invalid job match result")
		return
	}

	respondJSON(w, http.StatusOK, result)
}
