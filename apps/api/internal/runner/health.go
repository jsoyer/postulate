package runner

import (
	"encoding/json"
	"net/http"
	"os/exec"
)

type healthResponse struct {
	Status        string `json:"status"`
	CVPath        string `json:"cv_path"`
	MakeAvailable bool   `json:"make_available"`
}

// handleHealth handles GET /health.
// It does not require authentication — the route is intentionally public so
// that container health checks and load balancers can probe it without a secret.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	_, makeErr := exec.LookPath("make")

	resp := healthResponse{
		Status:        "ok",
		CVPath:        s.store.cvPath,
		MakeAvailable: makeErr == nil,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		// Headers are already sent; nothing useful we can do.
		_ = err
	}
}
