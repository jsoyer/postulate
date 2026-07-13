package api

import "time"

// Application represents a job application from the API.
type Application struct {
	Name      string            `json:"name"`
	Company   string            `json:"company"`
	Position  string            `json:"position"`
	Status    string            `json:"status"`
	CreatedAt time.Time         `json:"created_at"`
	Deadline  *time.Time        `json:"deadline,omitempty"`
	Outcome   string            `json:"outcome,omitempty"`
	Files     map[string]string `json:"files,omitempty"`
}

// ActionRequest is sent to execute a Make target.
type ActionRequest struct {
	Target      string            `json:"target"`
	Application string            `json:"application,omitempty"`
	Args        map[string]string `json:"args,omitempty"`
}

// ActionResult represents a Make target execution result.
type ActionResult struct {
	JobID    string `json:"job_id"`
	Target   string `json:"target"`
	Status   string `json:"status"`
	ExitCode int    `json:"exit_code"`
	Stdout   string `json:"stdout,omitempty"`
	Stderr   string `json:"stderr,omitempty"`
	Duration int64  `json:"duration_ms"`
}

// WSMessage represents a WebSocket message.
type WSMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

// Target describes an allowed Make target.
type Target struct {
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Description string   `json:"description"`
	Args        []string `json:"args,omitempty"`
}

// DashboardData holds aggregated dashboard information.
type DashboardData struct {
	TotalApplications  int            `json:"total_applications"`
	ByStatus           map[string]int `json:"by_status"`
	RecentApplications []Application  `json:"recent_applications"`
}

// StatsData holds pipeline statistics.
type StatsData struct {
	Funnel   map[string]int  `json:"funnel"`
	Timeline []TimelineEntry `json:"timeline"`
}

// TimelineEntry is a data point on the timeline chart.
type TimelineEntry struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// APIError is the standard error response from cv-api.
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
