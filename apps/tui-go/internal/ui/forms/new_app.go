// Package forms provides modal overlay forms for the TUI.
package forms

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

// NewAppSubmittedMsg carries the new app data on form submission.
type NewAppSubmittedMsg struct {
	Company  string
	Position string
	URL      string
}

// NewAppCancelledMsg is sent when the form is dismissed.
type NewAppCancelledMsg struct{}

// NewAppForm is a modal overlay for creating a new application.
type NewAppForm struct {
	company  textinput.Model
	position textinput.Model
	url      textinput.Model
	focused  int // 0=company, 1=position, 2=url
	width    int
	height   int
	err      string
}

// NewNewAppForm creates a new NewAppForm sized to the given terminal dimensions.
func NewNewAppForm(width, height int) NewAppForm {
	company := textinput.New()
	company.Placeholder = "Acme Corp"
	company.CharLimit = 100
	company.Focus()

	position := textinput.New()
	position.Placeholder = "Software Engineer"
	position.CharLimit = 100

	appURL := textinput.New()
	appURL.Placeholder = "https://example.com/jobs/123"
	appURL.CharLimit = 256

	return NewAppForm{
		company:  company,
		position: position,
		url:      appURL,
		focused:  0,
		width:    width,
		height:   height,
	}
}

// FocusedField returns the index of the currently focused input (0=company, 1=position, 2=url).
func (m NewAppForm) FocusedField() int {
	return m.focused
}

// SetSize updates the form dimensions (called on terminal resize).
func (m NewAppForm) SetSize(width, height int) NewAppForm {
	m.width = width
	m.height = height
	return m
}

// SetErr sets an API-level error message on the form and returns the updated
// form. This allows the parent model to display errors without closing the modal.
func (m NewAppForm) SetErr(e string) NewAppForm {
	m.err = e
	return m
}

// Init returns the blink command for the focused input.
func (m NewAppForm) Init() tea.Cmd {
	return textinput.Blink
}

// Update handles keypresses for the form.
func (m NewAppForm) Update(msg tea.Msg) (NewAppForm, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			return m, func() tea.Msg { return NewAppCancelledMsg{} }

		case "tab", "enter":
			// On last field with enter, try to submit.
			if m.focused == 2 && msg.String() == "enter" {
				return m.submit()
			}
			// Cycle focus forward.
			m.focused = (m.focused + 1) % 3
			m.company.Blur()
			m.position.Blur()
			m.url.Blur()
			switch m.focused {
			case 0:
				m.company.Focus()
			case 1:
				m.position.Focus()
			case 2:
				m.url.Focus()
			}
			return m, textinput.Blink

		case "shift+tab":
			m.focused = (m.focused + 2) % 3
			m.company.Blur()
			m.position.Blur()
			m.url.Blur()
			switch m.focused {
			case 0:
				m.company.Focus()
			case 1:
				m.position.Focus()
			case 2:
				m.url.Focus()
			}
			return m, textinput.Blink
		}

		// Delegate keypress to focused input.
		var cmd tea.Cmd
		switch m.focused {
		case 0:
			m.company, cmd = m.company.Update(msg)
		case 1:
			m.position, cmd = m.position.Update(msg)
		case 2:
			m.url, cmd = m.url.Update(msg)
		}
		m.err = ""
		return m, cmd
	}
	return m, nil
}

func (m NewAppForm) submit() (NewAppForm, tea.Cmd) {
	company := strings.TrimSpace(m.company.Value())
	position := strings.TrimSpace(m.position.Value())
	appURL := strings.TrimSpace(m.url.Value())

	if company == "" || position == "" {
		m.err = "Company and position are required"
		return m, nil
	}

	return m, func() tea.Msg {
		return NewAppSubmittedMsg{
			Company:  company,
			Position: position,
			URL:      appURL,
		}
	}
}

// View renders the form as a centered overlay.
func (m NewAppForm) View() string {
	labelStyle := lipgloss.NewStyle().Foreground(common.ColorSubtext1).Width(10)
	inputStyle := lipgloss.NewStyle().Width(36)

	var rows []string

	rows = append(rows, common.TitleStyle.Render("New Application"))
	rows = append(rows, "")

	rows = append(rows, labelStyle.Render("Company")+inputStyle.Render(m.company.View()))
	rows = append(rows, labelStyle.Render("Position")+inputStyle.Render(m.position.View()))
	rows = append(rows, labelStyle.Render("URL")+inputStyle.Render(m.url.View()))
	rows = append(rows, "")

	if m.err != "" {
		rows = append(rows, common.ErrorStyle.Render(m.err))
		rows = append(rows, "")
	}

	rows = append(rows, common.HelpStyle.Render("tab next field  enter submit  esc cancel"))

	content := strings.Join(rows, "\n")

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(common.ColorMauve).
		Padding(1, 2).
		Width(54).
		Render(content)

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}
