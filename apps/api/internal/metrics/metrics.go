// Package metrics provides lightweight in-process counters and histograms for
// cv-api telemetry. It exposes a text/plain Prometheus-compatible scrape
// endpoint using only the standard library — no external dependencies required.
//
// Counters exposed:
//
//	cvapi_ai_provider_calls_total{provider, target, status}
//
// Histograms exposed:
//
//	cvapi_ai_provider_latency_ms{provider, target}
package metrics

import (
	"fmt"
	"io"
	"math"
	"sync"
	"sync/atomic"
)

// --- Counter ---

// CounterVec is a thread-safe counter keyed by a fixed set of label names.
type CounterVec struct {
	name   string
	labels []string

	mu   sync.RWMutex
	vals map[string]*atomic.Int64 // key = joined label values
}

// newCounterVec creates a CounterVec with the given metric name and label names.
func newCounterVec(name string, labels []string) *CounterVec {
	return &CounterVec{
		name:   name,
		labels: labels,
		vals:   make(map[string]*atomic.Int64),
	}
}

// Inc increments the counter for the given label values by 1.
// len(labelValues) must match the number of label names the vec was created with.
func (c *CounterVec) Inc(labelValues ...string) {
	key := joinLabels(labelValues)

	c.mu.RLock()
	ctr, ok := c.vals[key]
	c.mu.RUnlock()

	if !ok {
		c.mu.Lock()
		if ctr, ok = c.vals[key]; !ok {
			ctr = &atomic.Int64{}
			c.vals[key] = ctr
		}
		c.mu.Unlock()
	}

	ctr.Add(1)
}

// writePrometheus serialises all counter time series in Prometheus text format to w.
func (c *CounterVec) writePrometheus(w io.Writer) {
	_, _ = fmt.Fprintf(w, "# TYPE %s counter\n", c.name)

	c.mu.RLock()
	defer c.mu.RUnlock()

	for key, ctr := range c.vals {
		labelStr := labelsPrometheusString(c.labels, splitLabels(key))
		_, _ = fmt.Fprintf(w, "%s{%s} %d\n", c.name, labelStr, ctr.Load())
	}
}

// --- Histogram ---

// numBuckets is the number of latency histogram buckets (including +Inf).
const numBuckets = 11

// histBuckets are the upper bounds (in ms) for latency histograms.
// len(histBuckets) must equal numBuckets.
var histBuckets = [numBuckets]float64{5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, math.Inf(1)}

// HistogramVec is a thread-safe latency histogram keyed by label values.
type HistogramVec struct {
	name   string
	labels []string

	mu   sync.RWMutex
	vals map[string]*histogram
}

type histogram struct {
	mu      sync.Mutex
	buckets [numBuckets]int64 // counts per bucket
	sum     float64
	count   int64
}

func (h *histogram) observe(v float64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.sum += v
	h.count++
	for i := 0; i < numBuckets; i++ {
		if v <= histBuckets[i] {
			h.buckets[i]++
		}
	}
}

// newHistogramVec creates a HistogramVec with the given metric name and label names.
func newHistogramVec(name string, labels []string) *HistogramVec {
	return &HistogramVec{
		name:   name,
		labels: labels,
		vals:   make(map[string]*histogram),
	}
}

// Observe records a latency value (in milliseconds) for the given label values.
func (h *HistogramVec) Observe(ms float64, labelValues ...string) {
	key := joinLabels(labelValues)

	h.mu.RLock()
	hist, ok := h.vals[key]
	h.mu.RUnlock()

	if !ok {
		h.mu.Lock()
		if hist, ok = h.vals[key]; !ok {
			hist = &histogram{}
			h.vals[key] = hist
		}
		h.mu.Unlock()
	}

	hist.observe(ms)
}

// writePrometheus serialises all histogram time series in Prometheus text format to w.
func (h *HistogramVec) writePrometheus(w io.Writer) {
	_, _ = fmt.Fprintf(w, "# TYPE %s histogram\n", h.name)

	h.mu.RLock()
	defer h.mu.RUnlock()

	for key, hist := range h.vals {
		lv := splitLabels(key)

		hist.mu.Lock()
		var cumulative int64
		for i := 0; i < numBuckets; i++ {
			bound := histBuckets[i]
			cumulative += hist.buckets[i]
			leStr := fmt.Sprintf("%g", bound)
			if math.IsInf(bound, 1) {
				leStr = "+Inf"
			}
			extraLabel := fmt.Sprintf(`le="%s"`, leStr)
			_, _ = fmt.Fprintf(w, "%s_bucket{%s,%s} %d\n",
				h.name,
				labelsPrometheusString(h.labels, lv),
				extraLabel,
				cumulative,
			)
		}
		_, _ = fmt.Fprintf(w, "%s_sum{%s} %g\n", h.name, labelsPrometheusString(h.labels, lv), hist.sum)
		_, _ = fmt.Fprintf(w, "%s_count{%s} %d\n", h.name, labelsPrometheusString(h.labels, lv), hist.count)
		hist.mu.Unlock()
	}
}

// --- Gauge ---

// Gauge is a thread-safe integer gauge (can increase or decrease).
type Gauge struct {
	name string
	val  atomic.Int64
}

func newGauge(name string) *Gauge { return &Gauge{name: name} }

// Inc increments the gauge by 1.
func (g *Gauge) Inc() { g.val.Add(1) }

// Dec decrements the gauge by 1.
func (g *Gauge) Dec() { g.val.Add(-1) }

// Value returns the current gauge value.
func (g *Gauge) Value() int64 { return g.val.Load() }

func (g *Gauge) writePrometheus(w io.Writer) {
	_, _ = fmt.Fprintf(w, "# TYPE %s gauge\n%s %d\n", g.name, g.name, g.val.Load())
}

// --- Registry ---

// Registry holds all metrics and can serialise them to a Prometheus scrape body.
type Registry struct {
	// AIProviderCalls counts AI provider invocations by provider, target, and status.
	// status is one of: ok, error, rate_limited.
	AIProviderCalls *CounterVec
	// AIProviderLatency records AI provider call duration in milliseconds.
	AIProviderLatency *HistogramVec
	// WSConnectionsActive tracks the current number of active WebSocket connections.
	WSConnectionsActive *Gauge
	// ThemeUsage counts preview requests by theme name.
	ThemeUsage *CounterVec
}

// New creates a Registry with all metrics pre-initialised.
func New() *Registry {
	return &Registry{
		AIProviderCalls: newCounterVec(
			"cvapi_ai_provider_calls_total",
			[]string{"provider", "target", "status"},
		),
		AIProviderLatency: newHistogramVec(
			"cvapi_ai_provider_latency_ms",
			[]string{"provider", "target"},
		),
		WSConnectionsActive: newGauge("cvapi_ws_connections_active"),
		ThemeUsage: newCounterVec(
			"cvapi_theme_usage_total",
			[]string{"theme"},
		),
	}
}

// ThemeCount returns the current usage count for the named theme.
func (reg *Registry) ThemeCount(theme string) int64 {
	key := joinLabels([]string{theme})
	reg.ThemeUsage.mu.RLock()
	ctr, ok := reg.ThemeUsage.vals[key]
	reg.ThemeUsage.mu.RUnlock()
	if !ok {
		return 0
	}
	return ctr.Load()
}

// WritePrometheus writes all metrics in Prometheus text exposition format to w.
func (reg *Registry) WritePrometheus(w io.Writer) {
	reg.AIProviderCalls.writePrometheus(w)
	reg.AIProviderLatency.writePrometheus(w)
	reg.WSConnectionsActive.writePrometheus(w)
	reg.ThemeUsage.writePrometheus(w)
}

// TotalAIProviderCalls returns the sum of all AI provider call counter values.
func (reg *Registry) TotalAIProviderCalls() int64 {
	reg.AIProviderCalls.mu.RLock()
	defer reg.AIProviderCalls.mu.RUnlock()

	var total int64
	for _, ctr := range reg.AIProviderCalls.vals {
		total += ctr.Load()
	}
	return total
}

// AIProviderCallsByProvider returns a map of provider name to total call count,
// summing across all targets and statuses.
func (reg *Registry) AIProviderCallsByProvider() map[string]int64 {
	reg.AIProviderCalls.mu.RLock()
	defer reg.AIProviderCalls.mu.RUnlock()

	out := make(map[string]int64)
	for key, ctr := range reg.AIProviderCalls.vals {
		parts := splitLabels(key)
		if len(parts) == 0 {
			continue
		}
		out[parts[0]] += ctr.Load()
	}
	return out
}

// --- label helpers ---

const labelSep = "\x00"

func joinLabels(vals []string) string {
	result := ""
	for i, v := range vals {
		if i > 0 {
			result += labelSep
		}
		result += v
	}
	return result
}

func splitLabels(key string) []string {
	if key == "" {
		return nil
	}
	// manual split on NUL byte to avoid importing strings just for this
	var parts []string
	start := 0
	for i := 0; i < len(key); i++ {
		if key[i] == labelSep[0] {
			parts = append(parts, key[start:i])
			start = i + 1
		}
	}
	parts = append(parts, key[start:])
	return parts
}

func labelsPrometheusString(names []string, vals []string) string {
	out := ""
	for i, name := range names {
		if i > 0 {
			out += ","
		}
		val := ""
		if i < len(vals) {
			val = vals[i]
		}
		out += fmt.Sprintf(`%s="%s"`, name, val)
	}
	return out
}
