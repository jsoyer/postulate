package models

import "time"

// Application represents a job application directory.
type Application struct {
	Name      string            `json:"name" yaml:"name"`
	Company   string            `json:"company" yaml:"company"`
	Position  string            `json:"position" yaml:"position"`
	Status    string            `json:"status" yaml:"status"`
	CreatedAt time.Time         `json:"created_at" yaml:"created_at"`
	Deadline  *time.Time        `json:"deadline,omitempty" yaml:"deadline,omitempty"`
	Outcome   string            `json:"outcome,omitempty" yaml:"outcome,omitempty"`
	Files     map[string]string `json:"files,omitempty"`
}

// ActionRequest represents a request to execute a Make target.
type ActionRequest struct {
	Target      string            `json:"target"`
	Application string            `json:"application,omitempty"`
	Args        map[string]string `json:"args,omitempty"`
}

// ActionResult represents the result of a Make target execution.
type ActionResult struct {
	JobID    string `json:"job_id"`
	Target   string `json:"target"`
	Status   string `json:"status"` // running, completed, failed, cancelled
	ExitCode int    `json:"exit_code"`
	Stdout   string `json:"stdout,omitempty"`
	Stderr   string `json:"stderr,omitempty"`
	Duration int64  `json:"duration_ms"`
}

// WSMessage represents a WebSocket message for streaming output.
type WSMessage struct {
	Type string `json:"type"` // stdout, stderr, exit, error
	Data string `json:"data"`
}

// Target describes an allowed Make target from the allowlist.
type Target struct {
	Name        string   `json:"name" yaml:"name"`
	Category    string   `json:"category" yaml:"category"`
	Description string   `json:"description" yaml:"description"`
	Args        []string `json:"args,omitempty" yaml:"args,omitempty"`
	Timeout     string   `json:"timeout,omitempty" yaml:"timeout,omitempty"`
}

// TargetConfig is the top-level structure for targets.yml.
type TargetConfig struct {
	Targets []Target `yaml:"targets"`
}

// DashboardData contains aggregated dashboard information.
type DashboardData struct {
	TotalApplications int            `json:"total_applications"`
	ByStatus          map[string]int `json:"by_status"`
	RecentApplications []Application `json:"recent_applications"`
}

// StatsData contains pipeline statistics.
type StatsData struct {
	Funnel   map[string]int `json:"funnel"`
	Timeline []TimelineEntry `json:"timeline"`
}

// TimelineEntry represents a data point in the application timeline.
type TimelineEntry struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// APIError is a standardized error response.
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// LoginRequest holds web login credentials.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	TOTP     string `json:"totp,omitempty"`
}

// LoginResponse holds a successful login result.
type LoginResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
}

// Settings holds user-configurable settings.
type Settings struct {
	Theme        string `json:"theme" yaml:"theme"`
	DefaultView  string `json:"default_view" yaml:"default_view"`
	DefaultAI    string `json:"default_ai,omitempty" yaml:"default_ai,omitempty"`
	DefaultModel string `json:"default_model,omitempty" yaml:"default_model,omitempty"`
}

// UpdateApplicationRequest carries optional fields for patching an application's metadata.
type UpdateApplicationRequest struct {
	Status       *string `json:"status,omitempty"`
	Company      *string `json:"company,omitempty"`
	Position     *string `json:"position,omitempty"`
	FollowupDate *string `json:"followup_date,omitempty"`
	Deadline     *string `json:"deadline,omitempty"`
}

// NotesResponse carries the raw content of notes.md.
type NotesResponse struct {
	Content string `json:"content"`
}

// WriteNotesRequest carries new content for notes.md.
type WriteNotesRequest struct {
	Content string `json:"content"`
}

// UploadResponse is returned after a successful file upload.
type UploadResponse struct {
	OK       bool   `json:"ok"`
	Filename string `json:"filename"`
}

// OKResponse is a minimal success acknowledgement.
type OKResponse struct {
	OK bool `json:"ok"`
}

// ApplicationFilter carries optional filtering and sorting parameters for listing applications.
type ApplicationFilter struct {
	// Status filters by exact status value (e.g. "applied", "rejected").
	Status string
	// Company filters by case-insensitive substring match on the company field.
	Company string
	// DateFrom filters applications with created_at >= the given YYYY-MM string.
	DateFrom string
	// DateTo filters applications with created_at <= the given YYYY-MM string.
	DateTo string
	// Sort specifies the field to sort by: created_at, deadline, company, or status.
	// Defaults to created_at when empty.
	Sort string
	// Order is "asc" or "desc". Defaults to "desc" when empty.
	Order string
}

// BulkUpdateRequest is the request body for PATCH /api/applications (collection-level).
type BulkUpdateRequest struct {
	// Names is the list of application names to update.
	Names []string `json:"names"`
	// Update carries the fields to patch on each named application.
	Update UpdateApplicationRequest `json:"update"`
}

// BulkUpdateResponse reports the outcome of a bulk update operation.
type BulkUpdateResponse struct {
	// Updated is the count of applications successfully updated.
	Updated int `json:"updated"`
	// Errors lists per-name error messages for any failures.
	Errors []string `json:"errors"`
}

// SkillsGapResponse contains keyword gap analysis results.
type SkillsGapResponse struct {
	Missing []string `json:"missing"`
	Present []string `json:"present"`
}

// SearchMatch represents a single file match within an application.
type SearchMatch struct {
	File    string `json:"file"`
	Snippet string `json:"snippet"`
}

// SearchResult represents an application that matched a search query.
type SearchResult struct {
	Name     string        `json:"name"`
	Company  string        `json:"company"`
	Position string        `json:"position"`
	Stage    string        `json:"stage"`
	Matches  []SearchMatch `json:"matches"`
}

// SearchResponse wraps search results.
type SearchResponse struct {
	Results []SearchResult `json:"results"`
}

// JobMatchRequest carries optional parameters for job match AI analysis.
type JobMatchRequest struct {
	AI        string `json:"ai,omitempty"`
	Threshold int    `json:"threshold,omitempty"`
}
