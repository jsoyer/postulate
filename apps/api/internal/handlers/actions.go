package handlers

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
)

// ActionsHandler handles Make target execution.
type ActionsHandler struct {
	exec  *executor.Executor
	audit *audit.Logger
}

// NewActionsHandler creates a new ActionsHandler.
func NewActionsHandler(exec *executor.Executor, auditLog *audit.Logger) *ActionsHandler {
	return &ActionsHandler{exec: exec, audit: auditLog}
}

// Execute runs a Make target and returns the job result.
// POST /api/actions/{target}
func (h *ActionsHandler) Execute(w http.ResponseWriter, r *http.Request) {
	target := chi.URLParam(r, "target")
	if target == "" {
		respondError(w, http.StatusBadRequest, "Target is required")
		return
	}

	if !h.exec.IsAllowed(target) {
		respondError(w, http.StatusForbidden, "Target '"+target+"' is not in the allowlist")
		return
	}

	var req models.ActionRequest
	if r.Body != nil && r.ContentLength > 0 {
		if !decodeJSON(w, r, &req) {
			return
		}
	}
	req.Target = target

	user := middleware.UserFromContext(r.Context())
	slog.Info("action requested", "target", target, "user", user, "app", req.Application)

	job, err := h.exec.Run(r.Context(), req)
	if err != nil {
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Execution failed")
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "action_execute",
			Resource: target,
			User:     user,
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
			Detail:   "job_id=" + job.ID,
		})
	}

	status := http.StatusOK
	if job.Status == executor.JobRunning {
		status = http.StatusAccepted
	}

	respondJSON(w, status, job.ToResult())
}

// Status returns the status of a running or completed job.
// GET /api/actions/jobs/{jobId}
func (h *ActionsHandler) Status(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "jobId")
	if jobID == "" {
		respondError(w, http.StatusBadRequest, "Job ID is required")
		return
	}

	job, ok := h.exec.GetJob(jobID)
	if !ok {
		respondError(w, http.StatusNotFound, "Job not found")
		return
	}

	respondJSON(w, http.StatusOK, job.ToResult())
}

// ListTargets returns all allowed Make targets.
// GET /api/targets
func (h *ActionsHandler) ListTargets(w http.ResponseWriter, r *http.Request) {
	targets := h.exec.ListTargets()
	respondJSON(w, http.StatusOK, targets)
}
