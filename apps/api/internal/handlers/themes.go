package handlers

import (
	"net/http"

	"github.com/jsoyer/cv-api/internal/metrics"
)

// Theme describes a CV presentation theme.
type Theme struct {
	Name         string `json:"name"`
	DisplayName  string `json:"display_name"`
	PrimaryColor string `json:"primary_color"`
	FontSize     string `json:"font_size"`
	Description  string `json:"description"`
	UsageCount   int64  `json:"usage_count"`
}

// ThemesHandler serves the list of available CV themes.
type ThemesHandler struct {
	metrics *metrics.Registry
}

// NewThemesHandler creates a new ThemesHandler.
func NewThemesHandler(reg *metrics.Registry) *ThemesHandler {
	return &ThemesHandler{metrics: reg}
}

// availableThemes is the hard-coded list of CV themes from the CV project.
var availableThemes = []Theme{
	{
		Name:        "tech-blue",
		DisplayName: "Tech Blue",
		PrimaryColor: "#0066CC",
		FontSize:    "11pt",
		Description: "Clean technical style with blue accents, ideal for engineering roles.",
	},
	{
		Name:        "startup-orange",
		DisplayName: "Startup Orange",
		PrimaryColor: "#FF6600",
		FontSize:    "11pt",
		Description: "Energetic orange palette suited for startup and product roles.",
	},
	{
		Name:        "executive-dark",
		DisplayName: "Executive Dark",
		PrimaryColor: "#1A1A2E",
		FontSize:    "12pt",
		Description: "Dark, formal aesthetic for senior leadership and executive positions.",
	},
	{
		Name:        "cyber-red",
		DisplayName: "Cyber Red",
		PrimaryColor: "#CC0000",
		FontSize:    "11pt",
		Description: "Bold red theme for security, DevOps, and high-impact technical roles.",
	},
	{
		Name:        "minimal-clean",
		DisplayName: "Minimal Clean",
		PrimaryColor: "#333333",
		FontSize:    "11pt",
		Description: "Minimalist monochrome design for a timeless, distraction-free read.",
	},
	{
		Name:        "academic-classic",
		DisplayName: "Academic Classic",
		PrimaryColor: "#4B0082",
		FontSize:    "12pt",
		Description: "Traditional serif-influenced layout for academic and research positions.",
	},
}

// List returns all available CV themes with usage counts.
// GET /api/themes
func (h *ThemesHandler) List(w http.ResponseWriter, r *http.Request) {
	out := make([]Theme, len(availableThemes))
	for i, t := range availableThemes {
		out[i] = t
		if h.metrics != nil {
			out[i].UsageCount = h.metrics.ThemeCount(t.Name)
		}
	}
	respondJSON(w, http.StatusOK, out)
}
