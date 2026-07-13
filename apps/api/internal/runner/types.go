// Package runner implements the cv-runner HTTP execution backend.
// It receives job requests from cv-api, runs Make targets, and streams output.
package runner

// CreateJobRequest is the payload sent by cv-api to create a new job.
type CreateJobRequest struct {
	Target      string            `json:"target"`
	Application string            `json:"application"`
	Args        map[string]string `json:"args,omitempty"`
}

// CreateJobResponse is returned immediately after a job is accepted.
type CreateJobResponse struct {
	JobID  string `json:"job_id"`
	Status string `json:"status"`
}

// JobResponse is returned by GET /jobs/{id} with the current job state.
type JobResponse struct {
	JobID      string `json:"job_id"`
	Target     string `json:"target"`
	Status     string `json:"status"`
	ExitCode   int    `json:"exit_code"`
	Stdout     string `json:"stdout,omitempty"`
	Stderr     string `json:"stderr,omitempty"`
	StartedAt  string `json:"started_at"`
	DurationMs int64  `json:"duration_ms"`
}
