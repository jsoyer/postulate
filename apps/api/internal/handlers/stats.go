package handlers

import (
	"net/http"

	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// StatsHandler handles dashboard and statistics endpoints.
type StatsHandler struct {
	store   *storage.Storage
	metrics *metrics.Registry
}

// NewStatsHandler creates a new StatsHandler.
// Pass a non-nil registry to include execution metrics in the Dashboard response.
func NewStatsHandler(store *storage.Storage, reg *metrics.Registry) *StatsHandler {
	return &StatsHandler{store: store, metrics: reg}
}

// dashboardResponse wraps DashboardData with optional execution metrics.
type dashboardResponse struct {
	*models.DashboardData
	AIProviderCallsTotal *int64 `json:"ai_provider_calls_total,omitempty"`
}

// Dashboard returns aggregated dashboard data.
// GET /api/dashboard
func (h *StatsHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	data, err := h.store.GetDashboard()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to load dashboard data")
		return
	}

	resp := dashboardResponse{DashboardData: data}
	if h.metrics != nil {
		total := h.metrics.TotalAIProviderCalls()
		resp.AIProviderCallsTotal = &total
	}

	respondJSON(w, http.StatusOK, resp)
}

// Stats returns pipeline statistics and funnel data.
// GET /api/stats
func (h *StatsHandler) Stats(w http.ResponseWriter, r *http.Request) {
	data, err := h.store.GetStats()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to load statistics")
		return
	}
	respondJSON(w, http.StatusOK, data)
}
