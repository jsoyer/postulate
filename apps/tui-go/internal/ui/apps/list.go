package apps

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

type appsMsg struct{ apps []api.Application }
type errMsg struct{ err error }

// SelectedMsg is sent when an application is selected for detail view.
type SelectedMsg struct{ App api.Application }

// ListModel is the applications list view.
type ListModel struct {
	client    *api.Client
	apps      []api.Application
	filtered  []api.Application
	cursor    int
	offset    int
	err       error
	loading   bool
	spinner   spinner.Model
	filtering bool
	filter    textinput.Model
	width     int
	height    int
}

// NewList creates a new applications list model.
func NewList(client *api.Client) ListModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(common.ColorBlue)

	fi := textinput.New()
	fi.Placeholder = "Filter..."
	fi.CharLimit = 50

	return ListModel{
		client:  client,
		loading: true,
		spinner: s,
		filter:  fi,
	}
}

// Init starts the data fetch.
func (m ListModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchApps())
}

// Update handles messages.
func (m ListModel) Update(msg tea.Msg) (ListModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case appsMsg:
		m.apps = msg.apps
		m.filtered = msg.apps
		m.loading = false
		m.err = nil

	case errMsg:
		m.err = msg.err
		m.loading = false

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tea.KeyMsg:
		if m.filtering {
			return m.handleFilterKey(msg)
		}
		return m.handleNormalKey(msg)
	}

	return m, nil
}

func (m ListModel) handleNormalKey(msg tea.KeyMsg) (ListModel, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Down):
		if m.cursor < len(m.filtered)-1 {
			m.cursor++
			m.ensureVisible()
		}
	case key.Matches(msg, common.Keys.Up):
		if m.cursor > 0 {
			m.cursor--
			m.ensureVisible()
		}
	case key.Matches(msg, common.Keys.Top):
		m.cursor = 0
		m.offset = 0
	case key.Matches(msg, common.Keys.Bottom):
		m.cursor = max(0, len(m.filtered)-1)
		m.ensureVisible()
	case key.Matches(msg, common.Keys.Select):
		if m.cursor < len(m.filtered) {
			return m, func() tea.Msg {
				return SelectedMsg{App: m.filtered[m.cursor]}
			}
		}
	case key.Matches(msg, common.Keys.Filter):
		m.filtering = true
		m.filter.Focus()
		return m, textinput.Blink
	case key.Matches(msg, common.Keys.Refresh):
		m.loading = true
		return m, tea.Batch(m.spinner.Tick, m.fetchApps())
	}
	return m, nil
}

func (m ListModel) handleFilterKey(msg tea.KeyMsg) (ListModel, tea.Cmd) {
	switch msg.String() {
	case "esc":
		m.filtering = false
		m.filter.SetValue("")
		m.filter.Blur()
		m.filtered = m.apps
		m.cursor = 0
		m.offset = 0
		return m, nil
	case "enter":
		m.filtering = false
		m.filter.Blur()
		return m, nil
	}

	var cmd tea.Cmd
	m.filter, cmd = m.filter.Update(msg)
	m.applyFilter()
	return m, cmd
}

func (m *ListModel) applyFilter() {
	query := m.filter.Value()
	if query == "" {
		m.filtered = m.apps
	} else {
		m.filtered = nil
		for _, app := range m.apps {
			if contains(app.Company, query) || contains(app.Position, query) || contains(app.Name, query) {
				m.filtered = append(m.filtered, app)
			}
		}
	}
	m.cursor = 0
	m.offset = 0
}

func (m *ListModel) ensureVisible() {
	visible := m.visibleRows()
	if m.cursor < m.offset {
		m.offset = m.cursor
	}
	if m.cursor >= m.offset+visible {
		m.offset = m.cursor - visible + 1
	}
}

func (m ListModel) visibleRows() int {
	return max(1, m.height-8) // reserve space for header/footer
}

// View renders the applications list.
func (m ListModel) View() string {
	if m.loading {
		return m.spinner.View() + " Loading applications..."
	}
	if m.err != nil {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}

	var s string

	// Title + count
	title := common.TitleStyle.Render("Applications")
	count := common.MutedStyle.Render(fmt.Sprintf("(%d)", len(m.filtered)))
	s += title + " " + count + "\n"

	// Filter input
	if m.filtering {
		s += "  " + m.filter.View() + "\n"
	} else if m.filter.Value() != "" {
		s += common.MutedStyle.Render("  filter: "+m.filter.Value()) + "\n"
	}

	s += "\n"

	// Header
	header := fmt.Sprintf("  %-12s %-10s %-25s %s", "DATE", "STATUS", "COMPANY", "POSITION")
	s += common.SubtitleStyle.Render(header) + "\n"

	// Rows
	visible := m.visibleRows()
	end := min(m.offset+visible, len(m.filtered))

	for i := m.offset; i < end; i++ {
		app := m.filtered[i]
		date := app.CreatedAt.Format("2006-01-02")
		status := common.StatusBadge(app.Status)
		company := truncate(app.Company, 25)
		position := truncate(app.Position, 30)

		line := fmt.Sprintf("  %-12s %-22s %-25s %s", date, status, company, position)

		if i == m.cursor {
			s += common.SelectedStyle.Render("> "+line[2:]) + "\n"
		} else {
			s += line + "\n"
		}
	}

	// Footer
	s += "\n"
	if m.filtering {
		s += common.HelpStyle.Render("  esc cancel  enter apply")
	} else {
		s += common.HelpStyle.Render("  j/k navigate  enter open  / filter  R refresh  n new")
	}

	return s
}

func (m ListModel) fetchApps() tea.Cmd {
	return func() tea.Msg {
		apps, err := m.client.ListApplications()
		if err != nil {
			return errMsg{err}
		}
		return appsMsg{apps}
	}
}

func contains(s, substr string) bool {
	sl := len(s)
	subl := len(substr)
	if subl > sl {
		return false
	}
	for i := 0; i <= sl-subl; i++ {
		match := true
		for j := 0; j < subl; j++ {
			sc := s[i+j]
			qc := substr[j]
			// case-insensitive
			if sc >= 'A' && sc <= 'Z' {
				sc += 32
			}
			if qc >= 'A' && qc <= 'Z' {
				qc += 32
			}
			if sc != qc {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-1] + "…"
}
