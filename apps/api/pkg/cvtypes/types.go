// Package cvtypes provides shared types for cv-api clients.
//
// This package is intended to be imported by TUI clients (cv-tui-go)
// to share API response types without duplicating struct definitions.
package cvtypes

import "time"

// Application mirrors the API response for a job application.
type Application struct {
	Name      string     `json:"name"`
	Company   string     `json:"company"`
	Position  string     `json:"position"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	Deadline  *time.Time `json:"deadline,omitempty"`
	Outcome   string     `json:"outcome,omitempty"`
}

// ActionResult mirrors the API response for a completed action.
type ActionResult struct {
	JobID    string `json:"job_id"`
	Target   string `json:"target"`
	Status   string `json:"status"`
	ExitCode int    `json:"exit_code"`
	Stdout   string `json:"stdout,omitempty"`
	Stderr   string `json:"stderr,omitempty"`
	Duration int64  `json:"duration_ms"`
}

// WSMessage mirrors the WebSocket message format.
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

// DashboardData mirrors the dashboard API response.
type DashboardData struct {
	TotalApplications  int                `json:"total_applications"`
	ByStatus           map[string]int     `json:"by_status"`
	RecentApplications []Application      `json:"recent_applications"`
}

// APIError mirrors the error response format.
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}
