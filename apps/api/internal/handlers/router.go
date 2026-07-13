package handlers

import (
	"github.com/go-chi/chi/v5"
	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/executor"
	"github.com/jsoyer/cv-api/internal/metrics"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
	"github.com/jsoyer/cv-api/internal/storage"
)

// RouterConfig holds dependencies needed to build the router.
type RouterConfig struct {
	AuthProvider     *auth.Provider
	Executor         *executor.Executor
	Storage          *storage.Storage
	Audit            *audit.Logger
	Metrics          *metrics.Registry
	AllowedOrigins   []string
	CookieDomain     string
	CookieSecure     bool
	CVPath           string
	Targets          []models.Target
	ExpensiveTargets []string
}

// NewRouter builds the Chi router with all routes and middleware.
func NewRouter(cfg RouterConfig) *chi.Mux {
	r := chi.NewRouter()

	// Global middleware (applied to all routes)
	r.Use(middleware.RequestID)
	r.Use(middleware.SecurityHeaders)
	r.Use(middleware.CORS(cfg.AllowedOrigins))
	r.Use(middleware.Logger)
	r.Use(middleware.RateLimit(10))
	r.Use(middleware.RequestSize(1 * 1024 * 1024)) // 1 MB max body

	// Public routes (no auth required)
	healthHandler := NewHealthHandler(cfg.Executor, cfg.CVPath, cfg.Targets, cfg.Metrics)
	r.Get("/health", healthHandler.ServeHTTP)

	// OpenAPI docs (public)
	docsHandler := NewDocsHandler()
	r.Get("/docs", docsHandler.ServeUI)
	r.Get("/docs/openapi.yml", docsHandler.ServeSpec)

	// Prometheus metrics endpoint (public — scraper access)
	if cfg.Metrics != nil {
		metricsHandler := NewMetricsHandler(cfg.Metrics)
		r.Get("/metrics", metricsHandler.ServeHTTP)
	}

	// Auth routes (rate-limited separately)
	authHandler := NewAuthHandler(cfg.AuthProvider, cfg.CookieDomain, cfg.CookieSecure, cfg.Audit)
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(middleware.LoginRateLimit())
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
	})

	// Protected routes (auth required)
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(cfg.AuthProvider))
		r.Use(middleware.PerTokenRateLimit(30))

		// Audit log — admin only
		auditHandler := NewAuditHandler(cfg.Audit)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Get("/api/audit-log", auditHandler.List)

		// Applications — reads are viewer+, writes are editor+
		appsHandler := NewApplicationsHandler(cfg.Storage, cfg.Audit, cfg.Executor, cfg.CVPath, cfg.Metrics)
		r.Get("/api/applications", appsHandler.List)
		r.With(middleware.RequireRole(auth.RoleEditor)).Post("/api/applications", appsHandler.Create)
		r.With(middleware.RequireRole(auth.RoleEditor)).Patch("/api/applications", appsHandler.BulkUpdate)
		r.Get("/api/applications/export", appsHandler.Export)
		r.Get("/api/applications/{name}", appsHandler.Get)
		r.With(middleware.RequireRole(auth.RoleEditor)).Patch("/api/applications/{name}", appsHandler.Update)
		r.Get("/api/applications/{name}/notes", appsHandler.GetNotes)
		r.With(middleware.RequireRole(auth.RoleEditor)).Put("/api/applications/{name}/notes", appsHandler.UpdateNotes)
		r.Get("/api/applications/{name}/notes/versions", appsHandler.ListNoteVersions)
		r.Get("/api/applications/{name}/notes/versions/{filename}", appsHandler.GetNoteVersion)
		r.With(middleware.RequireRole(auth.RoleEditor)).
			With(middleware.RequestSize(10 * 1024 * 1024)).
			Post("/api/applications/{name}/files", appsHandler.UploadFile)
		r.Get("/api/applications/{name}/files/{filename}", appsHandler.GetFile)
		r.Get("/api/applications/{name}/skills-gap", appsHandler.SkillsGap)
		r.Get("/api/applications/{name}/health-audit", appsHandler.HealthAudit)
		r.Get("/api/applications/{name}/health-audit/history", appsHandler.HealthAuditHistory)
		r.Get("/api/applications/{name}/preview", appsHandler.Preview)

		// Job Match AI — reads are viewer+, execution is editor+
		jobMatchHandler := NewJobMatchHandler(cfg.Storage, cfg.Executor, cfg.Audit, cfg.CVPath)
		r.Get("/api/applications/{name}/match", jobMatchHandler.GetJobMatch)
		r.With(middleware.RequireRole(auth.RoleEditor)).Post("/api/applications/{name}/match", jobMatchHandler.RunJobMatch)

		// Search
		r.Get("/api/search", appsHandler.Search)

		// Themes
		themesHandler := NewThemesHandler(cfg.Metrics)
		r.Get("/api/themes", themesHandler.List)

		// Actions — editor+
		actionsHandler := NewActionsHandler(cfg.Executor, cfg.Audit)
		r.With(middleware.RequireRole(auth.RoleEditor)).
			With(middleware.CostBasedRateLimit(cfg.ExpensiveTargets)).
			Post("/api/actions/{target}", actionsHandler.Execute)
		r.Get("/api/actions/jobs/{jobId}", actionsHandler.Status)
		r.Get("/api/targets", actionsHandler.ListTargets)

		// Dashboard & stats
		statsHandler := NewStatsHandler(cfg.Storage, cfg.Metrics)
		r.Get("/api/dashboard", statsHandler.Dashboard)
		r.Get("/api/stats", statsHandler.Stats)

		// Settings — read is viewer+, write is admin only
		settingsHandler := NewSettingsHandler(cfg.Storage, cfg.Audit)
		r.Get("/api/settings", settingsHandler.Get)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Put("/api/settings", settingsHandler.Update)

		// Backup — admin only
		backupHandler := NewBackupHandler(cfg.CVPath)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Get("/api/backup", backupHandler.ServeHTTP)
		r.With(middleware.RequireRole(auth.RoleAdmin)).
			With(middleware.RequestSize(restoreMaxBytes)).
			Post("/api/restore", backupHandler.Restore)

		// Sessions — admin only
		sessHandler := NewSessionsHandler(cfg.AuthProvider)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Get("/api/sessions", sessHandler.List)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Delete("/api/sessions/{id}", sessHandler.Revoke)

		// API keys — admin only
		apiKeysHandler := NewAPIKeysHandler(cfg.AuthProvider)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Get("/api/api-keys", apiKeysHandler.List)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Post("/api/api-keys", apiKeysHandler.Generate)
		r.With(middleware.RequireRole(auth.RoleAdmin)).Delete("/api/api-keys/{prefix}", apiKeysHandler.Revoke)
	})

	// WebSocket routes (auth checked during handshake)
	wsHandler := NewWSHandler(cfg.Executor, cfg.AuthProvider, cfg.Metrics)
	r.Get("/ws/actions/{target}", wsHandler.Stream)

	// SSE routes (auth checked inline, same pattern as WebSocket)
	sseHandler := NewSSEHandler(cfg.Executor, cfg.AuthProvider)
	r.Get("/api/stream/{target}", sseHandler.Stream)

	return r
}
