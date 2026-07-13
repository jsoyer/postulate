// Package common provides shared styles and keybindings for all views.
package common

import "github.com/charmbracelet/lipgloss"

// Catppuccin Mocha palette.
var (
	ColorBase     = lipgloss.Color("#1e1e2e")
	ColorMantle   = lipgloss.Color("#181825")
	ColorCrust    = lipgloss.Color("#11111b")
	ColorSurface0 = lipgloss.Color("#313244")
	ColorSurface1 = lipgloss.Color("#45475a")
	ColorText     = lipgloss.Color("#cdd6f4")
	ColorSubtext0 = lipgloss.Color("#a6adc8")
	ColorSubtext1 = lipgloss.Color("#bac2de")
	ColorBlue     = lipgloss.Color("#89b4fa")
	ColorGreen    = lipgloss.Color("#a6e3a1")
	ColorRed      = lipgloss.Color("#f38ba8")
	ColorYellow   = lipgloss.Color("#f9e2af")
	ColorMauve    = lipgloss.Color("#cba6f7")
	ColorPeach    = lipgloss.Color("#fab387")
	ColorTeal     = lipgloss.Color("#94e2d5")
	ColorOverlay0 = lipgloss.Color("#6c7086")
)

// Status colors map application statuses to colors.
var StatusColors = map[string]lipgloss.Color{
	"applied":   ColorBlue,
	"interview": ColorYellow,
	"offer":     ColorGreen,
	"rejected":  ColorRed,
	"ghosted":   ColorOverlay0,
}

// Common styles.
var (
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorMauve).
			MarginBottom(1)

	SubtitleStyle = lipgloss.NewStyle().
			Foreground(ColorSubtext1)

	SelectedStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorBlue)

	ErrorStyle = lipgloss.NewStyle().
			Foreground(ColorRed)

	SuccessStyle = lipgloss.NewStyle().
			Foreground(ColorGreen)

	WarningStyle = lipgloss.NewStyle().
			Foreground(ColorYellow)

	MutedStyle = lipgloss.NewStyle().
			Foreground(ColorOverlay0)

	StatusBarStyle = lipgloss.NewStyle().
			Background(ColorMantle).
			Foreground(ColorSubtext0).
			Padding(0, 1)

	HelpStyle = lipgloss.NewStyle().
			Foreground(ColorOverlay0)

	TabStyle = lipgloss.NewStyle().
			Padding(0, 2).
			Foreground(ColorSubtext0)

	ActiveTabStyle = lipgloss.NewStyle().
			Padding(0, 2).
			Bold(true).
			Foreground(ColorBlue).
			Border(lipgloss.NormalBorder(), false, false, true, false).
			BorderForeground(ColorBlue)

	CardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorSurface1).
			Padding(0, 1)

	FocusedCardStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(ColorBlue).
				Padding(0, 1)
)

// StatusBadge returns a styled status string.
func StatusBadge(status string) string {
	color, ok := StatusColors[status]
	if !ok {
		color = ColorOverlay0
	}
	return lipgloss.NewStyle().
		Foreground(color).
		Bold(true).
		Render(status)
}
