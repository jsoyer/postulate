package runner

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jsoyer/cv-api/internal/cache"
	"github.com/jsoyer/cv-api/internal/cvutil"
	"github.com/jsoyer/cv-api/internal/models"
)

// JobStatus tracks the lifecycle of a Make target execution.
type JobStatus string

const (
	JobRunning   JobStatus = "running"
	JobCompleted JobStatus = "completed"
	JobFailed    JobStatus = "failed"
	JobCancelled JobStatus = "cancelled"
)

// Event is a single unit of streamed output from a running job.
type Event struct {
	Type string `json:"type"` // stdout, stderr, exit, error
	Data string `json:"data"`
}

// Job represents a running or completed Make target execution.
// Fields accessed concurrently are protected by mu.
type Job struct {
	ID         string
	Target     string
	Status     JobStatus
	ExitCode   int
	StartedAt  time.Time
	Duration   int64
	finishedAt time.Time // set when job reaches a terminal state; used for TTL eviction

	events []Event
	done   chan struct{} // closed when job finishes (any terminal state)
	mu     sync.RWMutex
	cancel context.CancelFunc
}

// getEventsSince returns all events appended after index cursor.
// It is safe to call concurrently.
func (j *Job) getEventsSince(cursor int) []Event {
	j.mu.RLock()
	defer j.mu.RUnlock()
	if cursor >= len(j.events) {
		return nil
	}
	result := make([]Event, len(j.events)-cursor)
	copy(result, j.events[cursor:])
	return result
}

// isDone reports whether the job has reached a terminal state.
func (j *Job) isDone() bool {
	select {
	case <-j.done:
		return true
	default:
		return false
	}
}

// toResponse converts the job to a JobResponse for the GET /jobs/{id} endpoint.
// stdout and stderr are assembled from events for backward compatibility.
func (j *Job) toResponse() JobResponse {
	j.mu.RLock()
	defer j.mu.RUnlock()

	var stdout, stderr strings.Builder
	for _, e := range j.events {
		switch e.Type {
		case "stdout":
			stdout.WriteString(e.Data)
			stdout.WriteByte('\n')
		case "stderr":
			stderr.WriteString(e.Data)
			stderr.WriteByte('\n')
		}
	}

	return JobResponse{
		JobID:      j.ID,
		Target:     j.Target,
		Status:     string(j.Status),
		ExitCode:   j.ExitCode,
		Stdout:     strings.TrimRight(stdout.String(), "\n"),
		Stderr:     strings.TrimRight(stderr.String(), "\n"),
		StartedAt:  j.StartedAt.UTC().Format(time.RFC3339),
		DurationMs: j.Duration,
	}
}

// JobStoreConfig holds the configuration for a JobStore.
type JobStoreConfig struct {
	CVPath        string
	MaxConcurrent int
	TargetsFile   string
	// DefaultTimeout is the per-job timeout when the target specifies none.
	DefaultTimeout time.Duration
	// MaxTimeout caps the per-job timeout even when the target specifies a longer one.
	MaxTimeout time.Duration
}

// cacheableTargetKeywords lists substrings that make a target eligible for
// AI response caching. A target is cacheable if its name contains any keyword.
var cacheableTargetKeywords = []string{"tailor", "research"}

// jobCacheEntry is the cached result for a completed cacheable job.
type jobCacheEntry struct {
	events   []Event
	exitCode int
	status   JobStatus
}

// JobStore manages active and completed jobs, the concurrency semaphore,
// and the target allowlist.
type JobStore struct {
	cvPath         string
	allowedTargets map[string]models.Target
	defaultTimeout time.Duration
	maxTimeout     time.Duration

	sem       chan struct{} // bounded concurrency semaphore
	mu        sync.RWMutex
	jobs      map[string]*Job
	aiCache   *cache.Cache[string, jobCacheEntry]
}

// NewJobStore creates a JobStore, loading the target allowlist from targetsFile.
func NewJobStore(cfg JobStoreConfig) (*JobStore, error) {
	targets, err := cvutil.LoadTargets(cfg.TargetsFile)
	if err != nil {
		return nil, fmt.Errorf("load targets from %q: %w", cfg.TargetsFile, err)
	}

	allowed := make(map[string]models.Target, len(targets))
	for _, t := range targets {
		allowed[t.Name] = t
	}

	defaultTimeout := cfg.DefaultTimeout
	if defaultTimeout == 0 {
		defaultTimeout = 120 * time.Second
	}
	maxTimeout := cfg.MaxTimeout
	if maxTimeout == 0 {
		maxTimeout = 600 * time.Second
	}

	s := &JobStore{
		cvPath:         cfg.CVPath,
		allowedTargets: allowed,
		defaultTimeout: defaultTimeout,
		maxTimeout:     maxTimeout,
		sem:            make(chan struct{}, cfg.MaxConcurrent),
		jobs:           make(map[string]*Job),
		aiCache:        cache.New[string, jobCacheEntry](1 * time.Hour),
	}
	s.startEviction(1 * time.Hour)
	return s, nil
}

// isCacheable reports whether a target's results should be cached.
func isCacheable(target string) bool {
	lower := strings.ToLower(target)
	for _, kw := range cacheableTargetKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// cacheKey computes a deterministic SHA256 cache key from target, application,
// and sorted args.
func cacheKey(req CreateJobRequest) string {
	h := sha256.New()
	h.Write([]byte(req.Target))
	h.Write([]byte("\x00"))
	h.Write([]byte(req.Application))
	h.Write([]byte("\x00"))

	keys := make([]string, 0, len(req.Args))
	for k := range req.Args {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		h.Write([]byte(k))
		h.Write([]byte("="))
		h.Write([]byte(req.Args[k]))
		h.Write([]byte("\x00"))
	}

	return hex.EncodeToString(h.Sum(nil))
}

// GetJob returns a job by ID, or false if not found.
func (s *JobStore) GetJob(id string) (*Job, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	j, ok := s.jobs[id]
	return j, ok
}

// CancelJob cancels a running job. Returns false if the job does not exist.
func (s *JobStore) CancelJob(id string) bool {
	j, ok := s.GetJob(id)
	if !ok {
		return false
	}
	j.cancel()
	return true
}

// Create validates the request, registers the job, and starts execution in a
// background goroutine. It returns the job immediately (status: running).
// For cacheable targets a prior successful result may be replayed without
// executing the Make target again.
func (s *JobStore) Create(req CreateJobRequest) (*Job, error) {
	if err := s.validateRequest(req); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithCancel(context.Background())

	job := &Job{
		ID:        uuid.New().String(),
		Target:    req.Target,
		Status:    JobRunning,
		StartedAt: time.Now(),
		done:      make(chan struct{}),
		cancel:    cancel,
	}

	s.mu.Lock()
	s.jobs[job.ID] = job
	s.mu.Unlock()

	if isCacheable(req.Target) {
		key := cacheKey(req)
		if entry, ok := s.aiCache.Get(key); ok {
			cancel()
			go s.replayFromCache(job, entry)
			return job, nil
		}
	}

	go s.execute(ctx, job, req)

	return job, nil
}

// replayFromCache fills a job's fields from a cache entry and closes it as
// completed without running Make. The job is never executing, so no semaphore
// slot is acquired.
func (s *JobStore) replayFromCache(job *Job, entry jobCacheEntry) {
	job.mu.Lock()
	job.events = make([]Event, len(entry.events))
	copy(job.events, entry.events)
	job.ExitCode = entry.exitCode
	job.Status = entry.status
	job.Duration = 0
	job.finishedAt = time.Now()
	job.mu.Unlock()
	close(job.done)
	slog.Info("ai response replayed from cache", "job_id", job.ID, "target", job.Target)
}

// execute runs the Make target, streams output into job.events, then marks
// the job terminal and releases the semaphore. It is always called in a
// goroutine and must not panic the server.
func (s *JobStore) execute(ctx context.Context, job *Job, req CreateJobRequest) {
	// Acquire semaphore slot — blocks until a slot is available or context is done.
	select {
	case s.sem <- struct{}{}:
	case <-ctx.Done():
		job.mu.Lock()
		job.Status = JobCancelled
		job.ExitCode = -1
		job.Duration = time.Since(job.StartedAt).Milliseconds()
		job.finishedAt = time.Now()
		job.mu.Unlock()
		close(job.done)
		return
	}
	defer func() { <-s.sem }()

	timeout := s.resolveTimeout(req.Target)
	execCtx, execCancel := context.WithTimeout(ctx, timeout)
	defer execCancel()

	args := s.buildArgs(req)
	slog.Info("executing target", "job_id", job.ID, "target", req.Target, "args", args)

	cmd := exec.CommandContext(execCtx, "make", args...)
	cmd.Dir = s.cvPath
	cmd.Env = s.sanitizedEnv()

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		s.finishWithError(job, fmt.Sprintf("stdout pipe: %s", err.Error()))
		return
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		s.finishWithError(job, fmt.Sprintf("stderr pipe: %s", err.Error()))
		return
	}

	if err := cmd.Start(); err != nil {
		s.finishWithError(job, fmt.Sprintf("start command: %s", err.Error()))
		return
	}

	var wg sync.WaitGroup
	wg.Add(2)

	streamLines := func(r io.Reader, eventType string) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			job.mu.Lock()
			job.events = append(job.events, Event{Type: eventType, Data: line})
			job.mu.Unlock()
		}
	}

	go streamLines(stdoutPipe, "stdout")
	go streamLines(stderrPipe, "stderr")

	wg.Wait()

	duration := time.Since(job.StartedAt).Milliseconds()
	waitErr := cmd.Wait()

	job.mu.Lock()
	job.Duration = duration

	if waitErr != nil {
		if execCtx.Err() != nil {
			// Timeout or external cancellation.
			if ctx.Err() != nil {
				job.Status = JobCancelled
			} else {
				job.Status = JobFailed
			}
			job.ExitCode = -1
			job.events = append(job.events, Event{Type: "error", Data: "target timeout exceeded"})
		} else if exitErr, ok := waitErr.(*exec.ExitError); ok {
			job.Status = JobFailed
			job.ExitCode = exitErr.ExitCode()
			job.events = append(job.events, Event{Type: "exit", Data: fmt.Sprintf("%d", exitErr.ExitCode())})
		} else {
			job.Status = JobFailed
			job.ExitCode = -1
			job.events = append(job.events, Event{Type: "error", Data: waitErr.Error()})
		}
		slog.Warn("target failed", "job_id", job.ID, "target", req.Target,
			"exit_code", job.ExitCode, "duration_ms", job.Duration)
	} else {
		job.Status = JobCompleted
		job.ExitCode = 0
		job.events = append(job.events, Event{Type: "exit", Data: "0"})
		slog.Info("target completed", "job_id", job.ID, "target", req.Target,
			"duration_ms", job.Duration)
	}
	job.finishedAt = time.Now()
	job.mu.Unlock()

	if job.Status == JobCompleted && isCacheable(req.Target) {
		job.mu.RLock()
		evCopy := make([]Event, len(job.events))
		copy(evCopy, job.events)
		job.mu.RUnlock()
		s.aiCache.Set(cacheKey(req), jobCacheEntry{
			events:   evCopy,
			exitCode: 0,
			status:   JobCompleted,
		})
		slog.Debug("ai response cached", "job_id", job.ID, "target", req.Target)
	}

	close(job.done)
}

// finishWithError marks a job failed with an error event before it even starts.
func (s *JobStore) finishWithError(job *Job, msg string) {
	job.mu.Lock()
	job.Status = JobFailed
	job.ExitCode = -1
	job.Duration = time.Since(job.StartedAt).Milliseconds()
	job.events = append(job.events, Event{Type: "error", Data: msg})
	job.finishedAt = time.Now()
	job.mu.Unlock()
	close(job.done)
	slog.Error("job failed before execution", "job_id", job.ID, "error", msg)
}

func (s *JobStore) validateRequest(req CreateJobRequest) error {
	if _, ok := s.allowedTargets[req.Target]; !ok {
		return fmt.Errorf("target %q is not in the allowlist", req.Target)
	}
	if err := cvutil.ValidateAppName(req.Application); err != nil {
		return err
	}
	return nil
}

// buildArgs constructs the argument list for the make command.
// Each argument is a separate string — no shell interpolation is possible.
func (s *JobStore) buildArgs(req CreateJobRequest) []string {
	args := []string{req.Target}

	target, ok := s.allowedTargets[req.Target]
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
			// Pass as a Make variable assignment: ARGNAME=value
			args = append(args, fmt.Sprintf("%s=%s", strings.ToUpper(argName), val))
		}
	}

	return args
}

func (s *JobStore) resolveTimeout(target string) time.Duration {
	if t, ok := s.allowedTargets[target]; ok && t.Timeout != "" {
		if d, err := time.ParseDuration(t.Timeout); err == nil {
			if d > s.maxTimeout {
				return s.maxTimeout
			}
			return d
		}
	}
	return s.defaultTimeout
}

// sanitizedEnv returns a controlled environment for child processes.
// Only variables that the CV Makefile explicitly exports are forwarded;
// everything else (host secrets, auth tokens, Go runtime vars) is dropped.
func (s *JobStore) sanitizedEnv() []string {
	env := []string{
		"PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
		"HOME=" + s.cvPath,
		"LANG=en_US.UTF-8",
		"LC_ALL=en_US.UTF-8",
		// TEXINPUTS must include the awesome-cv submodule path so xelatex
		// can find awesome-cv.cls. Mirrors: TEXINPUTS := $(CURDIR)/awesome-cv/:
		"TEXINPUTS=" + s.cvPath + "/awesome-cv/:",
	}

	// Forward only the variables that the CV Makefile explicitly exports.
	// Source: `export` directives at the top of the CV Makefile.
	passthrough := []string{
		// AI providers
		"GEMINI_API_KEY",
		"ANTHROPIC_API_KEY",
		"OPENAI_API_KEY",
		"MISTRAL_API_KEY",
		// Local LLM
		"OLLAMA_HOST",
		"OLLAMA_MODEL",
		// Notifications
		"SLACK_WEBHOOK_URL",
		"DISCORD_WEBHOOK_URL",
		"TELEGRAM_BOT_TOKEN",
		"TELEGRAM_CHAT_ID",
		// LinkedIn
		"LINKEDIN_ACCESS_TOKEN",
		// Notion
		"NOTION_TOKEN",
		"NOTION_DATABASE_ID",
	}

	for _, key := range passthrough {
		if val := os.Getenv(key); val != "" {
			env = append(env, key+"="+val)
		}
	}

	return env
}

// startEviction launches a background goroutine that removes finished jobs
// from the store once they are older than ttl.
func (s *JobStore) startEviction(ttl time.Duration) {
	go func() {
		ticker := time.NewTicker(ttl / 6) // check 6x per TTL period
		defer ticker.Stop()
		for range ticker.C {
			s.evict(ttl)
		}
	}()
}

// evict removes jobs whose finishedAt timestamp is older than ttl.
func (s *JobStore) evict(ttl time.Duration) {
	cutoff := time.Now().Add(-ttl)
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, j := range s.jobs {
		if j.isDone() {
			j.mu.RLock()
			finished := j.finishedAt
			j.mu.RUnlock()
			if !finished.IsZero() && finished.Before(cutoff) {
				delete(s.jobs, id)
			}
		}
	}
}
