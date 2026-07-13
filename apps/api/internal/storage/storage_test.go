package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jsoyer/cv-api/internal/models"
)

// makeTestApp creates a properly-formed application directory under dir/applications/name
// with the provided meta.yml content. It returns the full path to the app directory.
func makeTestApp(t *testing.T, cvPath, name, metaContent string) string {
	t.Helper()
	appDir := filepath.Join(cvPath, "applications", name)
	if err := os.MkdirAll(appDir, 0750); err != nil {
		t.Fatalf("makeTestApp: mkdir %s: %v", appDir, err)
	}
	if err := os.WriteFile(filepath.Join(appDir, "meta.yml"), []byte(metaContent), 0640); err != nil {
		t.Fatalf("makeTestApp: write meta.yml for %s: %v", name, err)
	}
	return appDir
}

// newTestStorage creates a Storage rooted at a fresh t.TempDir().
func newTestStorage(t *testing.T) (*Storage, string) {
	t.Helper()
	dir := t.TempDir()
	return New(dir), dir
}

// ------------------------------------------------------------------ ListApplications

func TestListApplications_EmptyDir(t *testing.T) {
	store, _ := newTestStorage(t)

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 0 {
		t.Fatalf("expected 0 apps, got %d", len(apps))
	}
}

func TestListApplications_SingleApp(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-acme", `
company: Acme Corp
position: Engineer
outcome: applied
created: "2024-01"
`)

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 1 {
		t.Fatalf("expected 1 app, got %d", len(apps))
	}
	if apps[0].Company != "Acme Corp" {
		t.Errorf("expected company Acme Corp, got %q", apps[0].Company)
	}
	if apps[0].Name != "2024-01-acme" {
		t.Errorf("expected name 2024-01-acme, got %q", apps[0].Name)
	}
}

func TestListApplications_MultipleApps(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-alpha", `
company: Alpha Inc
position: Engineer
outcome: applied
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-02-beta", `
company: Beta LLC
position: Developer
outcome: interviewing
created: "2024-02"
`)
	makeTestApp(t, cvPath, "2024-03-gamma", `
company: Gamma Ltd
position: Architect
outcome: offered
created: "2024-03"
`)

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 3 {
		t.Fatalf("expected 3 apps, got %d", len(apps))
	}
}

func TestListApplications_SortedByCreatedAtDesc(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-old", `
company: Old Corp
position: Dev
outcome: applied
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-06-new", `
company: New Corp
position: Dev
outcome: applied
created: "2024-06"
`)

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 2 {
		t.Fatalf("expected 2 apps, got %d", len(apps))
	}
	// Most recent first
	if apps[0].Name != "2024-06-new" {
		t.Errorf("expected newest first, got %q", apps[0].Name)
	}
}

func TestListApplications_InvalidDirNamesSkipped(t *testing.T) {
	store, cvPath := newTestStorage(t)

	// Create a valid app
	makeTestApp(t, cvPath, "2024-01-valid", `
company: Valid Corp
position: Engineer
outcome: applied
created: "2024-01"
`)

	// Create an invalid dir name (starts with dash – ValidateAppName rejects it)
	invalidDir := filepath.Join(cvPath, "applications", "-invalid-name")
	if err := os.MkdirAll(invalidDir, 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(invalidDir, "meta.yml"), []byte("company: Bad\n"), 0640); err != nil {
		t.Fatal(err)
	}

	// Create a file (not a directory) in applications — should also be skipped
	appsDir := filepath.Join(cvPath, "applications")
	if err := os.WriteFile(filepath.Join(appsDir, "stray-file.txt"), []byte("noise"), 0640); err != nil {
		t.Fatal(err)
	}

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 1 {
		t.Fatalf("expected 1 valid app, got %d", len(apps))
	}
}

func TestListApplications_BrokenMetaSkipped(t *testing.T) {
	store, cvPath := newTestStorage(t)

	// Valid app
	makeTestApp(t, cvPath, "2024-01-good", `
company: Good Corp
position: Engineer
outcome: applied
created: "2024-01"
`)

	// App with broken meta (no meta.yml at all)
	brokenDir := filepath.Join(cvPath, "applications", "2024-02-broken")
	if err := os.MkdirAll(brokenDir, 0750); err != nil {
		t.Fatal(err)
	}

	apps, err := store.ListApplications()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(apps) != 1 {
		t.Fatalf("expected 1 app (broken skipped), got %d", len(apps))
	}
}

// ------------------------------------------------------------------ GetApplication

func TestGetApplication_Existing(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-03-test", `
company: Test Company
position: Senior Engineer
outcome: applied
created: "2024-03"
`)

	// Write some files from the knownFiles list (notes.md is NOT in knownFiles —
	// it is served separately via ReadNotes).
	if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte("Go developer role"), 0640); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(appDir, "prep.md"), []byte("# Prep"), 0640); err != nil {
		t.Fatal(err)
	}

	app, err := store.GetApplication("2024-03-test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if app.Company != "Test Company" {
		t.Errorf("expected Test Company, got %q", app.Company)
	}
	if app.Position != "Senior Engineer" {
		t.Errorf("expected Senior Engineer, got %q", app.Position)
	}
	if app.Files == nil {
		t.Fatal("expected files map, got nil")
	}
	// Files that were written and are in knownFiles should be present
	for _, fname := range []string{"job.txt", "prep.md"} {
		if _, ok := app.Files[fname]; !ok {
			t.Errorf("expected %s in files", fname)
		}
	}
	// Files that were NOT written should be absent
	if _, ok := app.Files["cv-tailored.yml"]; ok {
		t.Error("cv-tailored.yml should not be present (was not written)")
	}
	// notes.md is NOT in knownFiles — GetApplication does not include it
	if _, ok := app.Files["notes.md"]; ok {
		t.Error("notes.md should not appear in Files (it is not in knownFiles)")
	}
}

func TestGetApplication_Missing(t *testing.T) {
	store, _ := newTestStorage(t)

	_, err := store.GetApplication("2024-01-nonexistent")
	if err == nil {
		t.Fatal("expected error for missing application")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' in error, got %q", err.Error())
	}
}

func TestGetApplication_PathTraversalRejected(t *testing.T) {
	store, _ := newTestStorage(t)

	_, err := store.GetApplication("../etc")
	if err == nil {
		t.Fatal("expected error for path traversal")
	}
}

func TestGetApplication_AllKnownFiles(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-04-allfiles", `
company: AllFiles Corp
position: Tester
outcome: applied
created: "2024-04"
`)

	// Write all known files
	knownFilesLocal := []string{
		"meta.yml", "job.txt", "job.url", "cv-tailored.yml",
		"coverletter.yml", "prep.md", "company-research.md",
		"contacts.md", "star-stories.md", "salary-bench.md",
		"interview-brief.md", "milestones.yml",
	}
	for _, fname := range knownFilesLocal {
		// meta.yml already written by makeTestApp
		if fname == "meta.yml" {
			continue
		}
		if err := os.WriteFile(filepath.Join(appDir, fname), []byte("content of "+fname), 0640); err != nil {
			t.Fatalf("write %s: %v", fname, err)
		}
	}

	app, err := store.GetApplication("2024-04-allfiles")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// All written files should appear (except notes.md which was not written)
	for _, fname := range []string{"job.txt", "prep.md", "cv-tailored.yml", "milestones.yml"} {
		if _, ok := app.Files[fname]; !ok {
			t.Errorf("expected %s in files", fname)
		}
	}
	// notes.md was not written — should be absent
	if _, ok := app.Files["notes.md"]; ok {
		t.Error("notes.md should not be present (was not written)")
	}
}

// ------------------------------------------------------------------ CreateApplication

func TestCreateApplication_CreatesStructure(t *testing.T) {
	store, cvPath := newTestStorage(t)

	app, err := store.CreateApplication("Acme Corp", "Software Engineer", "https://jobs.example.com/123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if app.Company != "Acme Corp" {
		t.Errorf("expected Acme Corp, got %q", app.Company)
	}
	if app.Position != "Software Engineer" {
		t.Errorf("expected Software Engineer, got %q", app.Position)
	}
	if app.Status != "applied" {
		t.Errorf("expected status applied, got %q", app.Status)
	}

	// Verify the directory was created
	appsDir := filepath.Join(cvPath, "applications")
	entries, err := os.ReadDir(appsDir)
	if err != nil {
		t.Fatalf("read applications dir: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 dir, got %d", len(entries))
	}

	// Verify meta.yml exists
	appDir := filepath.Join(appsDir, entries[0].Name())
	if _, err := os.Stat(filepath.Join(appDir, "meta.yml")); err != nil {
		t.Errorf("meta.yml not created: %v", err)
	}

	// Verify job.url was created with URL
	urlContent, err := os.ReadFile(filepath.Join(appDir, "job.url"))
	if err != nil {
		t.Errorf("job.url not created: %v", err)
	}
	if string(urlContent) != "https://jobs.example.com/123" {
		t.Errorf("expected job.url content, got %q", string(urlContent))
	}
}

func TestCreateApplication_NoURL_SkipsJobURL(t *testing.T) {
	store, cvPath := newTestStorage(t)

	app, err := store.CreateApplication("Beta Inc", "Developer", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if app.Name == "" {
		t.Error("expected non-empty name")
	}

	// Find the created dir
	appsDir := filepath.Join(cvPath, "applications")
	entries, _ := os.ReadDir(appsDir)
	if len(entries) != 1 {
		t.Fatalf("expected 1 dir, got %d", len(entries))
	}
	appDir := filepath.Join(appsDir, entries[0].Name())

	// job.url should NOT exist
	if _, err := os.Stat(filepath.Join(appDir, "job.url")); !os.IsNotExist(err) {
		t.Error("job.url should not be created when URL is empty")
	}
}

func TestCreateApplication_GeneratedNameFormat(t *testing.T) {
	store, _ := newTestStorage(t)

	app, err := store.CreateApplication("Google LLC", "SRE", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	now := time.Now()
	expectedPrefix := now.Format("2006-01")
	if !strings.HasPrefix(app.Name, expectedPrefix) {
		t.Errorf("expected name to start with %q, got %q", expectedPrefix, app.Name)
	}
	if !strings.Contains(app.Name, "google") {
		t.Errorf("expected name to contain 'google', got %q", app.Name)
	}
}

// ------------------------------------------------------------------ UpdateApplication

func TestUpdateApplication_PatchesStatus(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-patch-test", `
company: Patch Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	status := "interviewing"
	updated, err := store.UpdateApplication("2024-01-patch-test", models.UpdateApplicationRequest{
		Status: &status,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Status != "interviewing" {
		t.Errorf("expected status interviewing, got %q", updated.Status)
	}
}

func TestUpdateApplication_PatchesCompany(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-co-update", `
company: Old Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	newCompany := "New Corp"
	updated, err := store.UpdateApplication("2024-01-co-update", models.UpdateApplicationRequest{
		Company: &newCompany,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Company != "New Corp" {
		t.Errorf("expected New Corp, got %q", updated.Company)
	}
}

func TestUpdateApplication_PatchesPosition(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-pos-update", `
company: Corp
position: Junior Dev
outcome: applied
created: "2024-01"
`)

	newPos := "Senior Dev"
	updated, err := store.UpdateApplication("2024-01-pos-update", models.UpdateApplicationRequest{
		Position: &newPos,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Position != "Senior Dev" {
		t.Errorf("expected Senior Dev, got %q", updated.Position)
	}
}

func TestUpdateApplication_PatchesDeadline(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-deadline-update", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	deadline := "2024-12-31"
	updated, err := store.UpdateApplication("2024-01-deadline-update", models.UpdateApplicationRequest{
		Deadline: &deadline,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Deadline == nil {
		t.Error("expected deadline to be set")
	}
}

func TestUpdateApplication_PatchesFollowupDate(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-followup-update", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	appDir := filepath.Join(cvPath, "applications", "2024-01-followup-update")
	meta, _ := os.ReadFile(filepath.Join(appDir, "meta.yml"))
	_ = meta // just ensure it's there

	followup := "2024-06-15"
	_, err := store.UpdateApplication("2024-01-followup-update", models.UpdateApplicationRequest{
		FollowupDate: &followup,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify followup_date was written to yaml
	content, err := os.ReadFile(filepath.Join(appDir, "meta.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "followup_date") {
		t.Errorf("expected followup_date in meta.yml, got:\n%s", string(content))
	}
}

func TestUpdateApplication_PreservesUnknownFields(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-preserve", `
company: TechCorp
position: Dev
outcome: applied
created: "2024-01"
tech_stack:
  - Go
  - Kubernetes
  - Postgres
`)

	status := "interviewing"
	_, err := store.UpdateApplication("2024-01-preserve", models.UpdateApplicationRequest{
		Status: &status,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify tech_stack was preserved in the file
	appDir := filepath.Join(cvPath, "applications", "2024-01-preserve")
	content, err := os.ReadFile(filepath.Join(appDir, "meta.yml"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "tech_stack") {
		t.Errorf("tech_stack should be preserved, meta.yml:\n%s", string(content))
	}
	if !strings.Contains(string(content), "Go") {
		t.Errorf("Go should be preserved in tech_stack, meta.yml:\n%s", string(content))
	}
}

func TestUpdateApplication_MissingApp(t *testing.T) {
	store, _ := newTestStorage(t)

	status := "applied"
	_, err := store.UpdateApplication("2024-01-nonexistent", models.UpdateApplicationRequest{
		Status: &status,
	})
	if err == nil {
		t.Fatal("expected error for missing application")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' in error, got %q", err.Error())
	}
}

func TestUpdateApplication_ConcurrentCallsDoNotPanic(t *testing.T) {
	// This test verifies that concurrent UpdateApplication calls do not panic or
	// cause data races beyond what os.WriteFile guarantees. The storage layer does
	// not hold an in-process mutex — last writer wins. Some calls may fail with a
	// YAML parse error (torn write from an interleaved concurrent write). The
	// important invariant is: no panics, and the file is eventually parseable.
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-concurrent", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	const goroutines = 5
	statuses := []string{"applied", "interviewing", "offered", "rejected", "withdrawn"}

	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			status := statuses[idx%len(statuses)]
			// Ignore errors — concurrent writes may cause transient parse failures
			_, _ = store.UpdateApplication("2024-01-concurrent", models.UpdateApplicationRequest{
				Status: &status,
			})
		}(i)
	}
	wg.Wait()

	// After all goroutines finish, perform a final single-writer update.
	// This ensures the file is left in a clean, parseable state.
	finalStatus := "applied"
	app, err := store.UpdateApplication("2024-01-concurrent", models.UpdateApplicationRequest{
		Status: &finalStatus,
	})
	if err != nil {
		t.Fatalf("final update failed: %v", err)
	}
	if app.Name != "2024-01-concurrent" {
		t.Errorf("unexpected name %q", app.Name)
	}
}

// ------------------------------------------------------------------ ReadNotes / WriteNotes

func TestReadNotes_MissingNotesReturnsEmpty(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-no-notes", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	content, err := store.ReadNotes("2024-01-no-notes")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "" {
		t.Errorf("expected empty string, got %q", content)
	}
}

func TestReadNotes_MissingAppReturnsError(t *testing.T) {
	store, _ := newTestStorage(t)

	_, err := store.ReadNotes("2024-01-nonexistent")
	if err == nil {
		t.Fatal("expected error for missing application")
	}
}

func TestWriteNotes_RoundTrip(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-notes-rt", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	noteContent := "# Interview Notes\n\nDon't forget to ask about the tech stack."
	if err := store.WriteNotes("2024-01-notes-rt", noteContent); err != nil {
		t.Fatalf("write error: %v", err)
	}

	got, err := store.ReadNotes("2024-01-notes-rt")
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if got != noteContent {
		t.Errorf("expected %q, got %q", noteContent, got)
	}
}

func TestWriteNotes_MissingAppReturnsError(t *testing.T) {
	store, _ := newTestStorage(t)

	err := store.WriteNotes("2024-01-nonexistent", "content")
	if err == nil {
		t.Fatal("expected error for missing application")
	}
}

// ------------------------------------------------------------------ UploadFile

func TestUploadFile_ValidExtensions(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-upload", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	validFiles := []struct {
		name string
		data []byte
	}{
		{"resume.txt", []byte("resume text")},
		{"cover.md", []byte("# Cover Letter")},
		{"job.yml", []byte("role: engineer")},
		{"notes.yaml", []byte("notes: some")},
	}

	for _, f := range validFiles {
		t.Run(f.name, func(t *testing.T) {
			if err := store.UploadFile("2024-01-upload", f.name, f.data); err != nil {
				t.Errorf("unexpected error for %s: %v", f.name, err)
			}
		})
	}
}

func TestUploadFile_InvalidExtensionRejected(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-badext", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	invalidFiles := []string{
		"malware.exe",
		"script.sh",
		"archive.zip",
		"image.png",
		"noextension",
	}

	for _, fname := range invalidFiles {
		t.Run(fname, func(t *testing.T) {
			err := store.UploadFile("2024-01-badext", fname, []byte("data"))
			if err == nil {
				t.Errorf("expected error for %s, got nil", fname)
			}
			if !strings.Contains(err.Error(), "invalid extension") {
				t.Errorf("expected 'invalid extension' in error for %s, got %q", fname, err.Error())
			}
		})
	}
}

func TestUploadFile_SizeOver10MBRejected(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-bigfile", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	// Create data slightly over 10 MB
	bigData := make([]byte, 10*1024*1024+1)
	err := store.UploadFile("2024-01-bigfile", "resume.txt", bigData)
	if err == nil {
		t.Fatal("expected error for oversized file")
	}
	if !strings.Contains(err.Error(), "exceeds maximum") && !strings.Contains(err.Error(), "max") {
		t.Errorf("expected size error, got %q", err.Error())
	}
}

func TestUploadFile_PathTraversalInFilenameRejected(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-traverse", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	// filepath.Base is applied, so ../etc/passwd becomes "passwd"
	// which has no extension → rejected as invalid extension
	err := store.UploadFile("2024-01-traverse", "../../../etc/passwd", []byte("data"))
	if err == nil {
		t.Fatal("expected error for path traversal filename")
	}
}

func TestUploadFile_MissingAppReturnsError(t *testing.T) {
	store, _ := newTestStorage(t)

	err := store.UploadFile("2024-01-nonexistent", "resume.txt", []byte("data"))
	if err == nil {
		t.Fatal("expected error for missing application")
	}
}

// ------------------------------------------------------------------ ReadFileRaw

func TestReadFileRaw_CorrectContentType(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-files", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	cases := []struct {
		filename    string
		content     string
		expectedCT  string
	}{
		{"resume.txt", "resume", "text/plain; charset=utf-8"},
		{"notes.md", "notes", "text/markdown; charset=utf-8"},
		{"data.yml", "key: val", "text/yaml; charset=utf-8"},
		{"data.yaml", "key: val", "text/yaml; charset=utf-8"},
	}

	for _, tc := range cases {
		t.Run(tc.filename, func(t *testing.T) {
			if err := os.WriteFile(filepath.Join(appDir, tc.filename), []byte(tc.content), 0640); err != nil {
				t.Fatal(err)
			}
			_, ct, err := store.ReadFileRaw("2024-01-files", tc.filename)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ct != tc.expectedCT {
				t.Errorf("expected content-type %q, got %q", tc.expectedCT, ct)
			}
		})
	}
}

func TestReadFileRaw_MissingFileReturnsError(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-nofile", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	_, _, err := store.ReadFileRaw("2024-01-nofile", "nonexistent.txt")
	if err == nil {
		t.Fatal("expected error for missing file")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' in error, got %q", err.Error())
	}
}

func TestReadFileRaw_InvalidExtensionRejected(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-badread", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	_, _, err := store.ReadFileRaw("2024-01-badread", "malware.exe")
	if err == nil {
		t.Fatal("expected error for invalid extension")
	}
	if !strings.Contains(err.Error(), "invalid extension") {
		t.Errorf("expected 'invalid extension' in error, got %q", err.Error())
	}
}

// ------------------------------------------------------------------ SkillsGap

func TestSkillsGap_PresentAndMissingKeywords(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-skillsgap", `
company: TechCorp
position: Engineer
outcome: applied
created: "2024-01"
`)

	// Write job.txt
	jobTxt := "We need experience with kubernetes golang postgres docker elasticsearch"
	if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte(jobTxt), 0640); err != nil {
		t.Fatal(err)
	}

	// Write data/cv.yml
	dataDir := filepath.Join(cvPath, "data")
	if err := os.MkdirAll(dataDir, 0750); err != nil {
		t.Fatal(err)
	}
	cvYml := "skills: kubernetes golang docker grpc redis"
	if err := os.WriteFile(filepath.Join(dataDir, "cv.yml"), []byte(cvYml), 0640); err != nil {
		t.Fatal(err)
	}

	result, err := store.SkillsGap("2024-01-skillsgap")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	presentSet := make(map[string]bool, len(result.Present))
	for _, k := range result.Present {
		presentSet[k] = true
	}
	missingSet := make(map[string]bool, len(result.Missing))
	for _, k := range result.Missing {
		missingSet[k] = true
	}

	// kubernetes, golang, docker are in cv — should be present
	for _, kw := range []string{"kubernetes", "golang", "docker"} {
		if !presentSet[kw] {
			t.Errorf("expected %q to be present (in both job and cv)", kw)
		}
	}

	// postgres, elasticsearch are in job but NOT cv — should be missing
	for _, kw := range []string{"postgres", "elasticsearch"} {
		if !missingSet[kw] {
			t.Errorf("expected %q to be missing (in job but not cv)", kw)
		}
	}
}

func TestSkillsGap_MissingJobTxtReturnsError(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-nojob", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	// Write cv.yml but no job.txt
	dataDir := filepath.Join(cvPath, "data")
	if err := os.MkdirAll(dataDir, 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "cv.yml"), []byte("skills: go"), 0640); err != nil {
		t.Fatal(err)
	}

	_, err := store.SkillsGap("2024-01-nojob")
	if err == nil {
		t.Fatal("expected error for missing job.txt")
	}
	if !strings.Contains(err.Error(), "job.txt") {
		t.Errorf("expected 'job.txt' in error, got %q", err.Error())
	}
}

// ------------------------------------------------------------------ Search

func TestSearch_FindsMatches(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-search", `
company: SearchCorp
position: Engineer
outcome: applied
created: "2024-01"
`)

	if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte("We require experience with microservices architecture"), 0640); err != nil {
		t.Fatal(err)
	}

	result, err := store.Search("microservices", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Results) == 0 {
		t.Fatal("expected at least one search result")
	}
	if result.Results[0].Name != "2024-01-search" {
		t.Errorf("expected 2024-01-search, got %q", result.Results[0].Name)
	}
	if len(result.Results[0].Matches) == 0 {
		t.Fatal("expected match snippets")
	}
	if result.Results[0].Matches[0].File != "job.txt" {
		t.Errorf("expected match in job.txt, got %q", result.Results[0].Matches[0].File)
	}
}

func TestSearch_NoMatch(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-nosearch", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)
	if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte("ordinary job description"), 0640); err != nil {
		t.Fatal(err)
	}

	result, err := store.Search("xylophone", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Results) != 0 {
		t.Errorf("expected empty results, got %d", len(result.Results))
	}
}

func TestSearch_RespectsMaxResults(t *testing.T) {
	store, cvPath := newTestStorage(t)

	// Create 5 apps each with matching job.txt
	for i := 0; i < 5; i++ {
		name := fmt.Sprintf("2024-01-app%d", i)
		appDir := makeTestApp(t, cvPath, name, fmt.Sprintf(`
company: Corp%d
position: Dev
outcome: applied
created: "2024-01"
`, i))
		if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte("golang developer required"), 0640); err != nil {
			t.Fatal(err)
		}
	}

	result, err := store.Search("golang", 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Results) > 3 {
		t.Errorf("expected max 3 results, got %d", len(result.Results))
	}
}

func TestSearch_ReturnsSnippets(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-snippet", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)
	if err := os.WriteFile(filepath.Join(appDir, "job.txt"),
		[]byte("We are looking for a golang developer with strong experience in concurrency patterns"),
		0640); err != nil {
		t.Fatal(err)
	}

	result, err := store.Search("golang", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Results) == 0 {
		t.Fatal("expected results")
	}
	snippet := result.Results[0].Matches[0].Snippet
	if snippet == "" {
		t.Error("expected non-empty snippet")
	}
	if !strings.Contains(strings.ToLower(snippet), "golang") {
		t.Errorf("expected snippet to contain 'golang', got %q", snippet)
	}
}

func TestSearch_CaseInsensitive(t *testing.T) {
	store, cvPath := newTestStorage(t)
	appDir := makeTestApp(t, cvPath, "2024-01-case", `
company: Corp
position: Dev
outcome: applied
created: "2024-01"
`)
	if err := os.WriteFile(filepath.Join(appDir, "job.txt"), []byte("Experience with KUBERNETES required"), 0640); err != nil {
		t.Fatal(err)
	}

	result, err := store.Search("kubernetes", 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Results) == 0 {
		t.Error("expected case-insensitive match")
	}
}

// ------------------------------------------------------------------ GetDashboard

func TestGetDashboard_Totals(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-dash1", `
company: Corp1
position: Dev
outcome: applied
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-02-dash2", `
company: Corp2
position: Dev
outcome: interviewing
created: "2024-02"
`)
	makeTestApp(t, cvPath, "2024-03-dash3", `
company: Corp3
position: Dev
outcome: applied
created: "2024-03"
`)

	dash, err := store.GetDashboard()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dash.TotalApplications != 3 {
		t.Errorf("expected 3 total, got %d", dash.TotalApplications)
	}
}

func TestGetDashboard_ByStatus(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-s1", `
company: Corp1
position: Dev
outcome: applied
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-02-s2", `
company: Corp2
position: Dev
outcome: applied
created: "2024-02"
`)
	makeTestApp(t, cvPath, "2024-03-s3", `
company: Corp3
position: Dev
outcome: interviewing
created: "2024-03"
`)

	dash, err := store.GetDashboard()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dash.ByStatus["applied"] != 2 {
		t.Errorf("expected 2 applied, got %d", dash.ByStatus["applied"])
	}
	if dash.ByStatus["interviewing"] != 1 {
		t.Errorf("expected 1 interviewing, got %d", dash.ByStatus["interviewing"])
	}
}

func TestGetDashboard_EmptyDir(t *testing.T) {
	store, _ := newTestStorage(t)

	dash, err := store.GetDashboard()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dash.TotalApplications != 0 {
		t.Errorf("expected 0, got %d", dash.TotalApplications)
	}
}

func TestGetDashboard_RecentApplicationsCapped(t *testing.T) {
	store, cvPath := newTestStorage(t)

	// Create 15 apps
	for i := 0; i < 15; i++ {
		name := fmt.Sprintf("2024-%02d-corp%d", (i%12)+1, i)
		makeTestApp(t, cvPath, name, fmt.Sprintf(`
company: Corp%d
position: Dev
outcome: applied
created: "2024-%02d"
`, i, (i%12)+1))
	}

	dash, err := store.GetDashboard()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dash.RecentApplications) > 10 {
		t.Errorf("expected max 10 recent apps, got %d", len(dash.RecentApplications))
	}
}

// ------------------------------------------------------------------ GetStats

func TestGetStats_FunnelAndTimeline(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-01-stats1", `
company: Corp1
position: Dev
outcome: applied
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-01-stats2", `
company: Corp2
position: Dev
outcome: interviewing
created: "2024-01"
`)
	makeTestApp(t, cvPath, "2024-02-stats3", `
company: Corp3
position: Dev
outcome: applied
created: "2024-02"
`)

	stats, err := store.GetStats()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if stats.Funnel["applied"] != 2 {
		t.Errorf("expected 2 applied in funnel, got %d", stats.Funnel["applied"])
	}
	if stats.Funnel["interviewing"] != 1 {
		t.Errorf("expected 1 interviewing in funnel, got %d", stats.Funnel["interviewing"])
	}

	// Timeline should have entries
	if len(stats.Timeline) == 0 {
		t.Error("expected timeline entries")
	}

	// Find 2024-01 entry (should have count 2)
	var jan, feb int
	for _, entry := range stats.Timeline {
		if entry.Date == "2024-01" {
			jan = entry.Count
		}
		if entry.Date == "2024-02" {
			feb = entry.Count
		}
	}
	if jan != 2 {
		t.Errorf("expected 2024-01 count=2, got %d", jan)
	}
	if feb != 1 {
		t.Errorf("expected 2024-02 count=1, got %d", feb)
	}
}

func TestGetStats_TimelineSortedAsc(t *testing.T) {
	store, cvPath := newTestStorage(t)
	makeTestApp(t, cvPath, "2024-03-later", `
company: Later Corp
position: Dev
outcome: applied
created: "2024-03"
`)
	makeTestApp(t, cvPath, "2024-01-earlier", `
company: Earlier Corp
position: Dev
outcome: applied
created: "2024-01"
`)

	stats, err := store.GetStats()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(stats.Timeline) < 2 {
		t.Skip("need at least 2 timeline entries")
	}
	if stats.Timeline[0].Date >= stats.Timeline[1].Date {
		t.Errorf("timeline not sorted ascending: %v", stats.Timeline)
	}
}

// ------------------------------------------------------------------ ReadSettings / WriteSettings

func TestReadSettings_MissingFileReturnsDefaults(t *testing.T) {
	store, _ := newTestStorage(t)

	settings, err := store.ReadSettings()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if settings.Theme == "" {
		t.Error("expected default theme")
	}
	if settings.DefaultView == "" {
		t.Error("expected default default_view")
	}
}

func TestWriteSettings_RoundTrip(t *testing.T) {
	store, _ := newTestStorage(t)

	original := models.Settings{
		Theme:       "light",
		DefaultView: "list",
	}
	if err := store.WriteSettings(original); err != nil {
		t.Fatalf("write error: %v", err)
	}

	got, err := store.ReadSettings()
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if got.Theme != "light" {
		t.Errorf("expected theme light, got %q", got.Theme)
	}
	if got.DefaultView != "list" {
		t.Errorf("expected default_view list, got %q", got.DefaultView)
	}
}

func TestWriteSettings_OverwritesPreviousSettings(t *testing.T) {
	store, _ := newTestStorage(t)

	if err := store.WriteSettings(models.Settings{Theme: "dark", DefaultView: "dashboard"}); err != nil {
		t.Fatal(err)
	}
	if err := store.WriteSettings(models.Settings{Theme: "light", DefaultView: "list"}); err != nil {
		t.Fatal(err)
	}

	got, err := store.ReadSettings()
	if err != nil {
		t.Fatal(err)
	}
	if got.Theme != "light" {
		t.Errorf("expected light after overwrite, got %q", got.Theme)
	}
}

// ------------------------------------------------------------------ tokenize (internal)

func TestTokenize_ReturnsSet(t *testing.T) {
	result := tokenize("Go Kubernetes Docker go kubernetes")
	if !result["kubernetes"] {
		t.Error("expected 'kubernetes' in token set")
	}
	if !result["docker"] {
		t.Error("expected 'docker' in token set")
	}
	// "go" is 2 chars — below minimum length of 4
	if result["go"] {
		t.Error("expected 'go' to be filtered (too short)")
	}
}

func TestTokenize_FiltersStopwords(t *testing.T) {
	// "with" is a stopword
	result := tokenize("experience with golang")
	if result["with"] {
		t.Error("expected 'with' to be filtered (stopword)")
	}
	if !result["golang"] {
		t.Error("expected 'golang' in result")
	}
}

func TestTokenize_FiltersShortWords(t *testing.T) {
	result := tokenize("a ab abc abcd")
	for _, short := range []string{"a", "ab", "abc"} {
		if result[short] {
			t.Errorf("expected %q filtered (too short)", short)
		}
	}
	if !result["abcd"] {
		t.Error("expected 'abcd' (4 chars) to be included")
	}
}

// ------------------------------------------------------------------ sanitizeDirName (internal)

func TestSanitizeDirName_Basic(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"Google LLC", "google-llc"},
		{"Meta Platforms Inc.", "meta-platforms-inc"},
		{"ACME_CORP", "acme-corp"},
		{"double  space", "double-space"},
		{"trailing-", "trailing"},
		{"-leading", "leading"},
		// Non-alphanumeric chars that are not space/underscore/hyphen are dropped (no separator inserted)
		{"spec!al@chars#", "specalchars"},
	}

	for _, tc := range cases {
		t.Run(tc.input, func(t *testing.T) {
			got := sanitizeDirName(tc.input)
			if got != tc.expected {
				t.Errorf("sanitizeDirName(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}

func TestSanitizeDirName_TruncatesLongNames(t *testing.T) {
	long := strings.Repeat("a", 100)
	got := sanitizeDirName(long)
	if len(got) > 50 {
		t.Errorf("expected max 50 chars, got %d", len(got))
	}
}
