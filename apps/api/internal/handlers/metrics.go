package handlers

import (
	"net/http"

	"github.com/jsoyer/cv-api/internal/metrics"
)

// MetricsHandler serves Prometheus-compatible metrics.
type MetricsHandler struct {
	reg *metrics.Registry
}

// NewMetricsHandler creates a MetricsHandler backed by the given Registry.
func NewMetricsHandler(reg *metrics.Registry) *MetricsHandler {
	return &MetricsHandler{reg: reg}
}

// ServeHTTP handles GET /metrics and writes all metrics in Prometheus text format.
func (h *MetricsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	h.reg.WritePrometheus(w)
}
