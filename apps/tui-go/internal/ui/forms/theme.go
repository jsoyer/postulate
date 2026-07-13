package forms

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

// ThemeEntry describes one selectable theme.
type ThemeEntry struct {
	Slug    string
	Display string
}

// Themes is the list of available themes.
var Themes = []ThemeEntry{
	{"catppuccin-mocha", "Catppuccin Mocha (dark)"},
	{"catppuccin-latte", "Catppuccin Latte (light)"},
	{"dracula", "Dracula"},
	{"nord", "Nord"},
	{"solarized-dark", "Solarized Dark"},
	{"solarized-light", "Solarized Light"},
}

// ThemeSelectedMsg is sent when a theme is chosen.
type ThemeSelectedMsg struct{ Theme string }

// ThemeCancelledMsg is sent when the picker is dismissed.
type ThemeCancelledMsg struct{}

// ThemeForm is a list-based theme picker modal.
type ThemeForm struct {
	cursor int
	width  int
	height int
}

// NewThemeForm creates a ThemeForm sized to the given terminal dimensions.
func NewThemeForm(width, height int) ThemeForm {
	return ThemeForm{width: width, height: height}
}

// SetSize updates the form dimensions.
func (m ThemeForm) SetSize(width, height int) ThemeForm {
	m.width = width
	m.height = height
	return m
}

// Update handles keypresses.
func (m ThemeForm) Update(msg tea.Msg) (ThemeForm, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case strings.EqualFold(msg.String(), "k") || msg.String() == "up":
			if m.cursor > 0 {
				m.cursor--
			}
		case strings.EqualFold(msg.String(), "j") || msg.String() == "down":
			if m.cursor < len(Themes)-1 {
				m.cursor++
			}
		case msg.String() == "enter":
			theme := Themes[m.cursor].Slug
			return m, func() tea.Msg { return ThemeSelectedMsg{Theme: theme} }
		case msg.String() == "esc":
			return m, func() tea.Msg { return ThemeCancelledMsg{} }
		}
	}
	return m, nil
}

// View renders the theme picker as a centered overlay.
func (m ThemeForm) View() string {
	var rows []string
	rows = append(rows, common.TitleStyle.Render("Select Theme"))
	rows = append(rows, "")

	for i, t := range Themes {
		line := "  " + t.Display
		if i == m.cursor {
			rows = append(rows, common.SelectedStyle.Render("> "+t.Display))
		} else {
			rows = append(rows, common.MutedStyle.Render(line))
		}
	}

	rows = append(rows, "")
	rows = append(rows, common.HelpStyle.Render("j/k navigate  enter select  esc cancel"))

	content := strings.Join(rows, "\n")

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(common.ColorMauve).
		Padding(1, 2).
		Width(40).
		Render(content)

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}
