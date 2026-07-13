// Package executor safely runs Make targets from the CV project.
//
// Security guarantees:
//   - Only targets listed in the allowlist can be executed
//   - Uses exec.CommandContext with argument list (never shell interpolation)
//   - Working directory is locked to the configured CV_PATH
//   - Per-target timeout enforced via context cancellation
//   - Global concurrency limited via semaphore
//   - Application names validated against strict regex
//   - No environment variable leakage to child processes
package executor

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jsoyer/cv-api/internal/models"
)

// validAppName allows only safe directory names: alphanumeric, hyphens, underscores, dots.
// Prevents path traversal attacks. Max 128 chars.
var validAppName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$`)

// ValidateAppName checks if an application name is safe for filesystem use.
func ValidateAppName(name string) error {
	if name == "" {
		return nil // empty is allowed (not all targets require an app)
	}
	if !validAppName.MatchString(name) {
		return fmt.Errorf("invalid application name %q: must match %s", name, validAppName.String())
	}
	if strings.Contains(name, "..") {
		return fmt.Errorf("invalid application name %q: path traversal detected", name)
	}
	return nil
}

// JobStatus tracks the lifecycle of a Make target execution.
type JobStatus string

const (
	JobRunning   JobStatus = "running"
	JobCompleted JobStatus = "completed"
	JobFailed    JobStatus = "failed"
	JobCancelled JobStatus = "cancelled"
)

// Job represents a running or completed Make target execution.
type Job struct {
	ID        string    `json:"job_id"`
	Target    string    `json:"target"`
	Status    JobStatus `json:"status"`
	ExitCode  int       `json:"exit_code"`
	Stdout    string    `json:"stdout,omitempty"`
	Stderr    string    `json:"stderr,omitempty"`
	StartedAt time.Time `json:"started_at"`
	Duration  int64     `json:"duration_ms"`
	cancel    context.CancelFunc
}

// ToResult converts a Job to an ActionResult model.
func (j *Job) ToResult() models.ActionResult {
	return models.ActionResult{
		JobID:    j.ID,
		Target:   j.Target,
		Status:   string(j.Status),
		ExitCode: j.ExitCode,
		Stdout:   j.Stdout,
		Stderr:   j.Stderr,
		Duration: j.Duration,
	}
}

// Executor runs Make targets with safety controls.
type Executor struct {
	cvPath         string
	allowedTargets map[string]models.Target
	defaultTimeout time.Duration
	maxTimeout     time.Duration

	sem  chan struct{} // concurrency semaphore
	mu   sync.RWMutex
	jobs map[string]*Job
}

// New creates an Executor with the given limits.
func New(cvPath string, targets []models.Target, maxConcurrent int, defaultTimeout, maxTimeout time.Duration) *Executor {
	allowed := make(map[string]models.Target, len(targets))
	for _, t := range targets {
		allowed[t.Name] = t
	}
	return &Executor{
		cvPath:         cvPath,
		allowedTargets: allowed,
		defaultTimeout: defaultTimeout,
		maxTimeout:     maxTimeout,
		sem:            make(chan struct{}, maxConcurrent),
		jobs:           make(map[string]*Job),
	}
}

// RunningCount returns the number of currently executing jobs.
func (e *Executor) RunningCount() int {
	return len(e.sem)
}

// WithMetrics attaches a metrics registry to the executor (no-op for compatibility).
func (e *Executor) WithMetrics(_ interface{}) {}

// IsAllowed checks if a target is in the allowlist.
func (e *Executor) IsAllowed(target string) bool {
	_, ok := e.allowedTargets[target]
	return ok
}

// GetTarget returns a target definition from the allowlist.
func (e *Executor) GetTarget(name string) (models.Target, bool) {
	t, ok := e.allowedTargets[name]
	return t, ok
}

// ListTargets returns all allowed targets.
func (e *Executor) ListTargets() []models.Target {
	targets := make([]models.Target, 0, len(e.allowedTargets))
	for _, t := range e.allowedTargets {
		targets = append(targets, t)
	}
	return targets
}

// GetJob returns a job by ID.
func (e *Executor) GetJob(id string) (*Job, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	j, ok := e.jobs[id]
	return j, ok
}

// Run executes a Make target synchronously and returns the result.
// It blocks until the process completes or the timeout expires.
func (e *Executor) Run(ctx context.Context, req models.ActionRequest) (*Job, error) {
	if err := e.validateRequest(req); err != nil {
		return nil, err
	}

	// Acquire semaphore slot (blocks if at max concurrency)
	select {
	case e.sem <- struct{}{}:
		defer func() { <-e.sem }()
	case <-ctx.Done():
		return nil, fmt.Errorf("cancelled waiting for execution slot: %w", ctx.Err())
	}

	timeout := e.resolveTimeout(req.Target)
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	job := &Job{
		ID:        uuid.New().String(),
		Target:    req.Target,
		Status:    JobRunning,
		StartedAt: time.Now(),
		cancel:    cancel,
	}

	e.mu.Lock()
	e.jobs[job.ID] = job
	e.mu.Unlock()

	args := e.buildArgs(req)
	slog.Info("executing target", "job_id", job.ID, "target", req.Target, "args", args)

	cmd := exec.CommandContext(ctx, "make", args...)
	cmd.Dir = e.cvPath
	cmd.Env = e.sanitizedEnv()

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	job.Duration = time.Since(job.StartedAt).Milliseconds()
	job.Stdout = stdout.String()
	job.Stderr = stderr.String()

	if err != nil {
		if ctx.Err() != nil {
			job.Status = JobCancelled
			job.ExitCode = -1
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			job.Status = JobFailed
			job.ExitCode = exitErr.ExitCode()
		} else {
			job.Status = JobFailed
			job.ExitCode = -1
		}
		slog.Warn("target failed", "job_id", job.ID, "target", req.Target,
			"exit_code", job.ExitCode, "duration_ms", job.Duration, "error", err)
	} else {
		job.Status = JobCompleted
		job.ExitCode = 0
		slog.Info("target completed", "job_id", job.ID, "target", req.Target,
			"duration_ms", job.Duration)
	}

	return job, nil
}

// RunStreaming executes a Make target and streams stdout/stderr line by line
// to the provided callback. Used for WebSocket streaming.
func (e *Executor) RunStreaming(ctx context.Context, req models.ActionRequest, onMessage func(models.WSMessage)) error {
	if err := e.validateRequest(req); err != nil {
		return err
	}

	select {
	case e.sem <- struct{}{}:
		defer func() { <-e.sem }()
	case <-ctx.Done():
		return fmt.Errorf("cancelled waiting for execution slot: %w", ctx.Err())
	}

	timeout := e.resolveTimeout(req.Target)
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	args := e.buildArgs(req)
	slog.Info("streaming target", "target", req.Target, "args", args)

	cmd := exec.CommandContext(ctx, "make", args...)
	cmd.Dir = e.cvPath
	cmd.Env = e.sanitizedEnv()

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start command: %w", err)
	}

	var wg sync.WaitGroup
	wg.Add(2)

	streamLines := func(r io.Reader, msgType string) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			onMessage(models.WSMessage{Type: msgType, Data: scanner.Text()})
		}
	}

	go streamLines(stdoutPipe, "stdout")
	go streamLines(stderrPipe, "stderr")

	wg.Wait()

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			onMessage(models.WSMessage{Type: "timeout", Data: "target timeout exceeded"})
			return nil
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			onMessage(models.WSMessage{Type: "exit", Data: fmt.Sprintf("%d", exitErr.ExitCode())})
			return nil
		}
		onMessage(models.WSMessage{Type: "error", Data: err.Error()})
		return nil
	}

	onMessage(models.WSMessage{Type: "exit", Data: "0"})
	return nil
}

// WaitForSlot blocks until a concurrency slot is available or the given
// timeout elapses. It returns an error when the queue is full and the
// timeout expires before a slot opens, allowing callers to distinguish
// a backpressure failure from a genuine execution error.
func (e *Executor) WaitForSlot(ctx context.Context, timeout time.Duration) error {
	tctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	select {
	case e.sem <- struct{}{}:
		<-e.sem
		return nil
	case <-tctx.Done():
		if ctx.Err() != nil {
			return fmt.Errorf("context cancelled while waiting for execution slot: %w", ctx.Err())
		}
		return fmt.Errorf("execution queue full: no slot available after %s", timeout)
	}
}

func (e *Executor) validateRequest(req models.ActionRequest) error {
	if !e.IsAllowed(req.Target) {
		return fmt.Errorf("target %q is not in the allowlist", req.Target)
	}
	if err := ValidateAppName(req.Application); err != nil {
		return err
	}
	return nil
}

// buildArgs constructs the argument list for the make command.
// Each argument is a separate string — no shell interpolation possible.
func (e *Executor) buildArgs(req models.ActionRequest) []string {
	args := []string{req.Target}

	target, ok := e.allowedTargets[req.Target]
	if !ok {
		return args
	}

	for _, argName := range target.Args {
		var val string
		switch argName {
		case "app":
			val = req.Application
		default:
			if req.Args != nil {
				val = req.Args[argName]
			}
		}
		if val != "" {
			// Pass as Make variable assignment: ARG_NAME=value
			args = append(args, fmt.Sprintf("%s=%s", strings.ToUpper(argName), val))
		}
	}

	return args
}

func (e *Executor) resolveTimeout(target string) time.Duration {
	if t, ok := e.allowedTargets[target]; ok && t.Timeout != "" {
		if d, err := time.ParseDuration(t.Timeout); err == nil {
			if d > e.maxTimeout {
				return e.maxTimeout
			}
			return d
		}
	}
	return e.defaultTimeout
}

// sanitizedEnv returns a minimal environment for child processes.
// Only passes essential variables — never leaks API keys or secrets.
func (e *Executor) sanitizedEnv() []string {
	return []string{
		"PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin",
		"HOME=" + e.cvPath,
		"LANG=en_US.UTF-8",
		"LC_ALL=en_US.UTF-8",
	}
}
