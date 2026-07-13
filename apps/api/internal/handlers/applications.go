package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/cache"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

const listCacheKey = "all"
const listCacheTTL = 30 * time.Second

// knownThemes lists the valid CV theme names accepted by the Preview endpoint.
var knownThemes = map[string]bool{
	"tech-blue":       true,
	"startup-orange":  true,
	"executive-dark":  true,
	"cyber-red":       true,
	"minimal-clean":   true,
	"academic-classic": true,
}

// ApplicationsHandler handles application CRUD operations.
type ApplicationsHandler struct {
	store     *storage.Storage
	audit     *audit.Logger
	exec      *executor.Executor
	cvPath    string
	metrics   *metrics.Registry
	listCache *cache.Cache[string, []models.Application]
}

// NewApplicationsHandler creates a new ApplicationsHandler.
func NewApplicationsHandler(store *storage.Storage, auditLog *audit.Logger, exec *executor.Executor, cvPath string, reg *metrics.Registry) *ApplicationsHandler {
	return &ApplicationsHandler{
		store:     store,
		audit:     auditLog,
		exec:      exec,
		cvPath:    cvPath,
		metrics:   reg,
		listCache: cache.New[string, []models.Application](listCacheTTL),
	}
}

// List returns a paginated, filtered list of applications.
// GET /api/applications
func (h *ApplicationsHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	limit := 20
	if l := q.Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > 100 {
		limit = 100
	}

	cursor := q.Get("cursor")

	f := models.ApplicationFilter{
		Status:  q.Get("status"),
		Company: q.Get("company"),
		Sort:    q.Get("sort"),
		Order:   q.Get("order"),
	}

	noFilter := cursor == "" && f.Status == "" && f.Company == "" && f.Sort == "" && f.Order == "" && limit == 20

	if noFilter {
		if cached, ok := h.listCache.Get(listCacheKey); ok {
			w.Header().Set("X-Total-Count", strconv.Itoa(len(cached)))
			respondJSON(w, http.StatusOK, cached)
			return
		}
	}

	apps, total, nextCursor, err := h.store.ListApplicationsPage(cursor, limit, f)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list applications")
		return
	}

	if noFilter {
		h.listCache.Set(listCacheKey, apps)
	}

	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	if nextCursor != "" {
		w.Header().Set("X-Next-Cursor", nextCursor)
	}

	respondJSON(w, http.StatusOK, apps)
}

// Export returns all applications as JSON or CSV.
// GET /api/applications/export?format=json|csv
func (h *ApplicationsHandler) Export(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	apps, err := h.store.ListApplications()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list applications")
		return
	}

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=\"applications.csv\"")
		w.WriteHeader(http.StatusOK)
		cw := csv.NewWriter(w)
		_ = cw.Write([]string{"name", "company", "position", "status", "created_at"})
		for _, app := range apps {
			_ = cw.Write([]string{
				app.Name,
				app.Company,
				app.Position,
				app.Status,
				app.CreatedAt.Format(time.RFC3339),
			})
		}
		cw.Flush()
	default:
		w.Header().Set("Content-Disposition", "attachment; filename=\"applications.json\"")
		respondJSON(w, http.StatusOK, apps)
	}
}

// invalidateListCache clears the cached applications list.
func (h *ApplicationsHandler) invalidateListCache() {
	h.listCache.Flush()
}

// BulkUpdate patches multiple applications in a single request.
// PATCH /api/applications
func (h *ApplicationsHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var req models.BulkUpdateRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if len(req.Names) == 0 {
		respondError(w, http.StatusBadRequest, "names must be a non-empty list")
		return
	}

	resp := models.BulkUpdateResponse{
		Errors: []string{},
	}

	for _, name := range req.Names {
		if _, err := h.store.UpdateApplication(name, req.Update); err != nil {
			resp.Errors = append(resp.Errors, fmt.Sprintf("%s: %s", name, err.Error()))
		} else {
			resp.Updated++
		}
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "app_update",
			Resource: strings.Join(req.Names, ","),
			User:     middleware.UserFromContext(r.Context()),
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
		})
	}

	h.invalidateListCache()
	respondJSON(w, http.StatusOK, resp)
}

// Get returns a single application by name with all associated files.
// GET /api/applications/{name}
func (h *ApplicationsHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	app, err := h.store.GetApplication(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read application")
		return
	}

	respondJSON(w, http.StatusOK, app)
}

// Create creates a new application directory.
// POST /api/applications
func (h *ApplicationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Company  string `json:"company"`
		Position string `json:"position"`
		URL      string `json:"url"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Company == "" || req.Position == "" {
		respondError(w, http.StatusBadRequest, "Company and position are required")
		return
	}

	app, err := h.store.CreateApplication(req.Company, req.Position, req.URL)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create application: "+err.Error())
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "app_create",
			Resource: app.Name,
			User:     middleware.UserFromContext(r.Context()),
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
		})
	}

	h.invalidateListCache()
	respondJSON(w, http.StatusCreated, app)
}

// Update patches writable fields on a single application.
// PATCH /api/applications/{name}
func (h *ApplicationsHandler) Update(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	var req models.UpdateApplicationRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	app, err := h.store.UpdateApplication(name, req)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to update application")
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "app_update",
			Resource: name,
			User:     middleware.UserFromContext(r.Context()),
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
		})
	}

	h.invalidateListCache()
	respondJSON(w, http.StatusOK, app)
}

// GetNotes returns the content of notes.md for an application.
// GET /api/applications/{name}/notes
func (h *ApplicationsHandler) GetNotes(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	content, err := h.store.ReadNotes(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read notes")
		return
	}

	respondJSON(w, http.StatusOK, models.NotesResponse{Content: content})
}

// UpdateNotes writes content to notes.md for an application.
// PUT /api/applications/{name}/notes
func (h *ApplicationsHandler) UpdateNotes(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	var req models.WriteNotesRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if err := h.store.WriteNotesVersioned(name, req.Content); err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to write notes")
		return
	}

	respondJSON(w, http.StatusOK, models.OKResponse{OK: true})
}

// ListNoteVersions returns version metadata for an application's notes.
// GET /api/applications/{name}/notes/versions
func (h *ApplicationsHandler) ListNoteVersions(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	versions, err := h.store.ListNoteVersions(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to list note versions")
		return
	}

	respondJSON(w, http.StatusOK, versions)
}

// GetNoteVersion reads a specific historical version of notes.
// GET /api/applications/{name}/notes/versions/{filename}
func (h *ApplicationsHandler) GetNoteVersion(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	filename := chi.URLParam(r, "filename")
	if name == "" || filename == "" {
		respondError(w, http.StatusBadRequest, "Application name and filename are required")
		return
	}

	data, err := h.store.ReadNoteVersion(name, filename)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Version not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read note version")
		return
	}

	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// UploadFile accepts a multipart upload and saves it to the application directory.
// POST /api/applications/{name}/files
func (h *ApplicationsHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		respondError(w, http.StatusBadRequest, "Failed to parse multipart form: "+err.Error())
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondError(w, http.StatusBadRequest, "Field \"file\" is required")
		return
	}
	defer func() { _ = file.Close() }()

	data, err := io.ReadAll(io.LimitReader(file, 10*1024*1024+1))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to read uploaded file")
		return
	}
	if int64(len(data)) > 10*1024*1024 {
		respondError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("File exceeds maximum size of %d bytes", 10*1024*1024))
		return
	}

	filename := header.Filename
	if err := h.store.UploadFile(name, filename, data); err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action:   "file_upload",
			Resource: name + "/" + filename,
			User:     middleware.UserFromContext(r.Context()),
			IP:       audit.IPFromRequest(r),
			Result:   "ok",
		})
	}

	respondJSON(w, http.StatusOK, models.UploadResponse{OK: true, Filename: filename})
}

// GetFile serves a raw file from the application directory.
// GET /api/applications/{name}/files/{filename}
func (h *ApplicationsHandler) GetFile(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	filename := chi.URLParam(r, "filename")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}
	if filename == "" {
		respondError(w, http.StatusBadRequest, "Filename is required")
		return
	}

	data, contentType, err := h.store.ReadFileRaw(name, filename)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "File not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	w.Write(data) //nolint:errcheck
}

// SkillsGap performs keyword gap analysis between job.txt and cv.yml.
// GET /api/applications/{name}/skills-gap
func (h *ApplicationsHandler) SkillsGap(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	result, err := h.store.SkillsGap(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application or job.txt not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to compute skills gap")
		return
	}

	respondJSON(w, http.StatusOK, result)
}

// HealthAudit performs quality checks on the application's notes file.
// GET /api/applications/{name}/health-audit
func (h *ApplicationsHandler) HealthAudit(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	content, err := h.store.ReadNotes(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read notes")
		return
	}

	checkedAt := time.Now().UTC()
	scores := computeHealthScores(content)

	entry := storage.ScoreEntry{
		CheckedAt:           checkedAt,
		QuantificationScore: scores["quantification_score"],
		ActionVerbScore:     scores["action_verb_score"],
		CompletenessScore:   scores["completeness_score"],
		OverallScore:        scores["overall_score"],
	}
	_ = h.store.AppendHealthScore(name, entry)

	respondJSON(w, http.StatusOK, map[string]any{
		"application": name,
		"scores":      scores,
		"checked_at":  checkedAt.Format(time.RFC3339),
	})
}

// HealthAuditHistory returns the stored score history for an application.
// GET /api/applications/{name}/health-audit/history
func (h *ApplicationsHandler) HealthAuditHistory(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	history, err := h.store.ListHealthScores(name)
	if err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read health score history")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"application": name,
		"history":     history,
	})
}

var (
	metricPattern    = regexp.MustCompile(`\d+[%xX]|\$[\d,]+[MmKkBb]?|\b\d+[MmKkBb]\b|\b\d{2,}\b`)
	strongActionVerbs = map[string]bool{
		"achieved": true, "built": true, "created": true, "delivered": true,
		"designed": true, "developed": true, "drove": true, "enabled": true,
		"improved": true, "increased": true, "launched": true, "led": true,
		"managed": true, "optimized": true, "reduced": true, "shipped": true,
		"scaled": true, "transformed": true,
	}
)

func computeHealthScores(content string) map[string]float64 {
	bullets := extractBullets(content)

	completeness := 0.0
	if len(content) > 100 {
		completeness = 100.0
	}

	if len(bullets) == 0 {
		avg := (0 + 0 + completeness) / 3
		return map[string]float64{
			"quantification_score": 0,
			"action_verb_score":    0,
			"completeness_score":   completeness,
			"overall_score":        avg,
		}
	}

	var quantified, actioned int
	for _, b := range bullets {
		if metricPattern.MatchString(b) {
			quantified++
		}
		first := firstWord(b)
		if strongActionVerbs[strings.ToLower(first)] {
			actioned++
		}
	}

	total := float64(len(bullets))
	qScore := (float64(quantified) / total) * 100
	aScore := (float64(actioned) / total) * 100
	overall := (qScore + aScore + completeness) / 3

	return map[string]float64{
		"quantification_score": roundTwo(qScore),
		"action_verb_score":    roundTwo(aScore),
		"completeness_score":   completeness,
		"overall_score":        roundTwo(overall),
	}
}

func extractBullets(content string) []string {
	var bullets []string
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ") {
			bullet := strings.TrimSpace(trimmed[2:])
			if bullet != "" {
				bullets = append(bullets, bullet)
			}
		}
	}
	return bullets
}

func firstWord(s string) string {
	s = strings.TrimSpace(s)
	for i, r := range s {
		if unicode.IsSpace(r) {
			return s[:i]
		}
	}
	return s
}

func roundTwo(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}

// Search performs full-text search across application files.
// GET /api/search?q=keyword
func (h *ApplicationsHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) < 3 {
		respondJSON(w, http.StatusOK, models.SearchResponse{Results: []models.SearchResult{}})
		return
	}

	result, err := h.store.Search(q, 20)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Search failed")
		return
	}

	respondJSON(w, http.StatusOK, result)
}

// Preview builds a themed PDF preview for an application via cv-runner and streams it back.
// GET /api/applications/{name}/preview?theme=<theme-name>
func (h *ApplicationsHandler) Preview(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		respondError(w, http.StatusBadRequest, "Application name is required")
		return
	}

	theme := r.URL.Query().Get("theme")
	if theme == "" {
		respondError(w, http.StatusBadRequest, "theme query parameter is required")
		return
	}
	if !knownThemes[theme] {
		respondError(w, http.StatusBadRequest, "Unknown theme '"+theme+"'. Must be one of: tech-blue, startup-orange, executive-dark, cyber-red, minimal-clean, academic-classic")
		return
	}

	if h.metrics != nil {
		h.metrics.ThemeUsage.Inc(theme)
	}

	if _, err := h.store.GetApplication(name); err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "Application not found")
			return
		}
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read application")
		return
	}

	if !h.exec.IsAllowed("preview") {
		respondError(w, http.StatusNotImplemented, "Preview target not configured — add 'preview' to targets.yml")
		return
	}

	req := models.ActionRequest{
		Target: "preview",
		Args:   map[string]string{"theme": theme, "app": name},
	}

	job, err := h.exec.Run(r.Context(), req)
	if err != nil {
		if isValidation(err) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "Preview execution failed: "+err.Error())
		return
	}

	if job.Status != executor.JobCompleted {
		respondError(w, http.StatusInternalServerError, "Preview generation failed")
		return
	}

	pdfPath := filepath.Join(h.cvPath, "applications", name, name+"-preview.pdf")
	data, err := os.ReadFile(pdfPath)
	if err != nil {
		if os.IsNotExist(err) {
			respondError(w, http.StatusInternalServerError, "Preview PDF not found after generation")
			return
		}
		respondError(w, http.StatusInternalServerError, "Failed to read preview PDF")
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+name+"-preview.pdf\"")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func isNotFound(err error) bool {
	return err != nil && (contains(err.Error(), "not found"))
}

func isValidation(err error) bool {
	return err != nil && (contains(err.Error(), "invalid") || contains(err.Error(), "traversal"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
