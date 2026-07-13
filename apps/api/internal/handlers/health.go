package handlers

import (
	"net/http"
	"os"

	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/models"
)

// HealthHandler serves the enriched health check endpoint.
type HealthHandler struct {
	exec    *executor.Executor
	cvPath  string
	targets []models.Target
	metrics *metrics.Registry
}

// NewHealthHandler creates a HealthHandler with the given dependencies.
// The metrics registry is optional; pass nil to omit AI provider call counts.
func NewHealthHandler(exec *executor.Executor, cvPath string, targets []models.Target, reg *metrics.Registry) *HealthHandler {
	return &HealthHandler{
		exec:    exec,
		cvPath:  cvPath,
		targets: targets,
		metrics: reg,
	}
}

// healthResponse is the JSON body returned by GET /health.
type healthResponse struct {
	Status           string            `json:"status"`
	RunnerUp         bool              `json:"runner_up"`
	CVPathOK         bool              `json:"cv_path_ok"`
	TargetsCount     int               `json:"targets_count"`
	JobQueueDepth    int               `json:"job_queue_depth"`
	AIProviders      map[string]bool   `json:"ai_providers"`
	AIProviderCalls  map[string]int64  `json:"ai_provider_calls,omitempty"`
}

// ServeHTTP handles GET /health — no authentication required.
// It returns a JSON body describing the server's readiness state.
func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	_, cvErr := os.Stat(h.cvPath)

	resp := healthResponse{
		Status:        "ok",
		RunnerUp:      os.Getenv("RUNNER_UP") == "true",
		CVPathOK:      cvErr == nil,
		TargetsCount:  len(h.targets),
		JobQueueDepth: h.exec.RunningCount(),
		AIProviders: map[string]bool{
			"gemini":    os.Getenv("GEMINI_API_KEY") != "",
			"anthropic": os.Getenv("ANTHROPIC_API_KEY") != "",
			"openai":    os.Getenv("OPENAI_API_KEY") != "",
			"mistral":   os.Getenv("MISTRAL_API_KEY") != "",
			"ollama":    os.Getenv("OLLAMA_HOST") != "",
		},
	}

	if h.metrics != nil {
		resp.AIProviderCalls = h.metrics.AIProviderCallsByProvider()
	}

	respondJSON(w, http.StatusOK, resp)
}
