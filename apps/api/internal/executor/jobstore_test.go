package executor

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jsoyer/cv-api/internal/models"
)

// newTestExecutor creates an Executor with known targets, rooted at a temp dir.
func newTestExecutor(t *testing.T, targets []models.Target) *Executor {
	t.Helper()
	dir := t.TempDir()
	return New(dir, targets, 5, 5*time.Second, 30*time.Second)
}

var testTargets = []models.Target{
	{Name: "fetch", Category: "workflow", Description: "Fetch job", Args: []string{"url"}, Timeout: "5s"},
	{Name: "build", Category: "cv", Description: "Build CV", Args: []string{"app"}, Timeout: "10s"},
}

// ------------------------------------------------------------------ IsAllowed / GetTarget

func TestIsAllowed_KnownTarget(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	if !exec.IsAllowed("fetch") {
		t.Error("expected fetch to be allowed")
	}
	if !exec.IsAllowed("build") {
		t.Error("expected build to be allowed")
	}
}

func TestIsAllowed_UnknownTarget(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	if exec.IsAllowed("dangerous-target") {
		t.Error("expected dangerous-target to be disallowed")
	}
	if exec.IsAllowed("") {
		t.Error("expected empty string to be disallowed")
	}
}

func TestGetTarget_ReturnsTarget(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	target, ok := exec.GetTarget("fetch")
	if !ok {
		t.Fatal("expected fetch target to be found")
	}
	if target.Name != "fetch" {
		t.Errorf("expected name fetch, got %q", target.Name)
	}
	if target.Category != "workflow" {
		t.Errorf("expected category workflow, got %q", target.Category)
	}
}

func TestGetTarget_Missing(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	_, ok := exec.GetTarget("nonexistent")
	if ok {
		t.Error("expected nonexistent target to not be found")
	}
}

// ------------------------------------------------------------------ ListTargets

func TestListTargets_ReturnsAll(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	targets := exec.ListTargets()
	if len(targets) != 2 {
		t.Errorf("expected 2 targets, got %d", len(targets))
	}

	names := make(map[string]bool)
	for _, t := range targets {
		names[t.Name] = true
	}
	if !names["fetch"] {
		t.Error("expected fetch in target list")
	}
	if !names["build"] {
		t.Error("expected build in target list")
	}
}

func TestListTargets_EmptyWhenNone(t *testing.T) {
	exec := newTestExecutor(t, nil)
	targets := exec.ListTargets()
	if len(targets) != 0 {
		t.Errorf("expected 0 targets, got %d", len(targets))
	}
}

// ------------------------------------------------------------------ validateRequest

func TestValidateRequest_UnknownTargetRejected(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	err := exec.validateRequest(models.ActionRequest{Target: "hack"})
	if err == nil {
		t.Fatal("expected error for unknown target")
	}
	if !strings.Contains(err.Error(), "not in the allowlist") {
		t.Errorf("expected 'not in the allowlist' in error, got %q", err.Error())
	}
}

func TestValidateRequest_InvalidAppNameRejected(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	cases := []string{
		"../etc/passwd",
		"has space",
		"-starts-with-dash",
		"has/slash",
		"has;semicolon",
	}

	for _, appName := range cases {
		t.Run(appName, func(t *testing.T) {
			err := exec.validateRequest(models.ActionRequest{
				Target:      "fetch",
				Application: appName,
			})
			if err == nil {
				t.Errorf("expected error for app name %q, got nil", appName)
			}
		})
	}
}

func TestValidateRequest_EmptyAppAllowed(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	// Empty app name is valid (some targets don't require an app)
	err := exec.validateRequest(models.ActionRequest{Target: "fetch", Application: ""})
	if err != nil {
		t.Errorf("expected nil for empty app name, got %v", err)
	}
}

// ------------------------------------------------------------------ buildArgs

func TestBuildArgs_TargetOnly(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	args := exec.buildArgs(models.ActionRequest{Target: "fetch"})
	if len(args) == 0 {
		t.Fatal("expected at least target in args")
	}
	if args[0] != "fetch" {
		t.Errorf("expected first arg to be fetch, got %q", args[0])
	}
}

func TestBuildArgs_AppArgUppercase(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	args := exec.buildArgs(models.ActionRequest{
		Target:      "build",
		Application: "2024-01-myapp",
	})

	// Should contain APP=2024-01-myapp
	found := false
	for _, arg := range args {
		if arg == "APP=2024-01-myapp" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected APP=2024-01-myapp in args, got %v", args)
	}
}

func TestBuildArgs_ExtraArgsUppercase(t *testing.T) {
	targets := []models.Target{
		{Name: "custom", Category: "test", Args: []string{"url", "format"}},
	}
	exec := newTestExecutor(t, targets)

	args := exec.buildArgs(models.ActionRequest{
		Target: "custom",
		Args:   map[string]string{"url": "https://example.com", "format": "pdf"},
	})

	found := map[string]bool{}
	for _, arg := range args {
		found[arg] = true
	}
	if !found["URL=https://example.com"] {
		t.Errorf("expected URL= in args, got %v", args)
	}
	if !found["FORMAT=pdf"] {
		t.Errorf("expected FORMAT= in args, got %v", args)
	}
}

func TestBuildArgs_EmptyArgSkipped(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	args := exec.buildArgs(models.ActionRequest{
		Target:      "build",
		Application: "", // empty — should not add APP=
	})

	for _, arg := range args {
		if strings.HasPrefix(arg, "APP=") {
			t.Errorf("expected APP= to be skipped for empty application, got %v", args)
		}
	}
}

// ------------------------------------------------------------------ GetJob

func TestGetJob_NotFound(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	_, ok := exec.GetJob("nonexistent-job-id")
	if ok {
		t.Error("expected job not found")
	}
}

// ------------------------------------------------------------------ resolveTimeout

func TestResolveTimeout_UsesTargetTimeout(t *testing.T) {
	targets := []models.Target{
		{Name: "quick", Timeout: "2s"},
	}
	exec := newTestExecutor(t, targets)

	d := exec.resolveTimeout("quick")
	if d != 2*time.Second {
		t.Errorf("expected 2s, got %v", d)
	}
}

func TestResolveTimeout_FallsBackToDefault(t *testing.T) {
	// Use a target with no timeout (it will fall back to default)
	targets := []models.Target{
		{Name: "notimeout"},
	}
	exec := New(t.TempDir(), targets, 3, 7*time.Second, 30*time.Second)
	d := exec.resolveTimeout("notimeout")
	if d != 7*time.Second {
		t.Errorf("expected 7s default, got %v", d)
	}
}

func TestResolveTimeout_CappedAtMaxTimeout(t *testing.T) {
	targets := []models.Target{
		{Name: "slow", Timeout: "999s"}, // well over max
	}
	exec := New(t.TempDir(), targets, 3, 10*time.Second, 30*time.Second)

	d := exec.resolveTimeout("slow")
	if d != 30*time.Second {
		t.Errorf("expected max 30s, got %v", d)
	}
}

// ------------------------------------------------------------------ sanitizedEnv

func TestSanitizedEnv_ContainsRequired(t *testing.T) {
	exec := newTestExecutor(t, nil)
	env := exec.sanitizedEnv()

	envMap := make(map[string]string)
	for _, e := range env {
		parts := strings.SplitN(e, "=", 2)
		if len(parts) == 2 {
			envMap[parts[0]] = parts[1]
		}
	}

	if _, ok := envMap["PATH"]; !ok {
		t.Error("expected PATH in sanitized env")
	}
	if _, ok := envMap["HOME"]; !ok {
		t.Error("expected HOME in sanitized env")
	}
	if _, ok := envMap["LANG"]; !ok {
		t.Error("expected LANG in sanitized env")
	}
}

func TestSanitizedEnv_DoesNotLeakHostEnv(t *testing.T) {
	// Set a sensitive env var on the current process
	t.Setenv("SECRET_API_KEY", "should-not-leak")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "aws-secret")

	exec := newTestExecutor(t, nil)
	env := exec.sanitizedEnv()

	for _, e := range env {
		if strings.HasPrefix(e, "SECRET_API_KEY=") {
			t.Error("sanitized env leaked SECRET_API_KEY")
		}
		if strings.HasPrefix(e, "AWS_SECRET_ACCESS_KEY=") {
			t.Error("sanitized env leaked AWS_SECRET_ACCESS_KEY")
		}
	}
}

func TestSanitizedEnv_DoesNotContainGoTestEnv(t *testing.T) {
	exec := newTestExecutor(t, nil)
	env := exec.sanitizedEnv()

	for _, e := range env {
		// GOPATH, GOROOT, GO111MODULE etc. should not be present
		if strings.HasPrefix(e, "GOPATH=") {
			t.Error("sanitized env contains GOPATH")
		}
		if strings.HasPrefix(e, "GOROOT=") {
			t.Error("sanitized env contains GOROOT")
		}
	}
}

func TestSanitizedEnv_IsMinimal(t *testing.T) {
	exec := newTestExecutor(t, nil)
	env := exec.sanitizedEnv()

	// We expect very few entries (PATH, HOME, LANG, LC_ALL)
	if len(env) > 10 {
		t.Errorf("expected minimal env (≤10 entries), got %d: %v", len(env), env)
	}
}

// ------------------------------------------------------------------ Run (integration — requires make)

func TestRun_UnknownTargetReturnsError(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	_, err := exec.Run(context.Background(), models.ActionRequest{Target: "not-allowed"})
	if err == nil {
		t.Fatal("expected error for unknown target")
	}
}

func TestRun_InvalidAppNameReturnsError(t *testing.T) {
	exec := newTestExecutor(t, testTargets)

	_, err := exec.Run(context.Background(), models.ActionRequest{
		Target:      "fetch",
		Application: "../../../etc/passwd",
	})
	if err == nil {
		t.Fatal("expected error for invalid app name")
	}
}

// ------------------------------------------------------------------ ValidateAppName (table-driven, extended)

func TestValidateAppName_TableDriven(t *testing.T) {
	cases := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid date-company", "2024-03-google", false},
		{"valid simple", "my-app", false},
		{"valid underscore", "my_app", false},
		{"valid dot", "my.app", false},
		{"valid single char", "a", false},
		{"empty allowed", "", false},
		{"path traversal slash", "a/b", true},
		{"path traversal double dot", "foo..bar", true},
		{"starts with dash", "-bad", true},
		{"space in name", "has space", true},
		{"backslash", "back\\slash", true},
		{"semicolon", "semi;colon", true},
		{"pipe", "pipe|char", true},
		{"dollar", "dol$ar", true},
		{"too long", strings.Repeat("a", 200), true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateAppName(tc.input)
			if tc.wantErr && err == nil {
				t.Errorf("expected error for %q, got nil", tc.input)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("expected nil for %q, got %v", tc.input, err)
			}
		})
	}
}
