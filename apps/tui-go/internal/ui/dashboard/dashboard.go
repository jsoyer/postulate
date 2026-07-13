package dashboard

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

type dataMsg struct{ data *api.DashboardData }
type errMsg struct{ err error }

// Model is the dashboard view.
type Model struct {
	client  *api.Client
	data    *api.DashboardData
	err     error
	loading bool
	spinner spinner.Model
	width   int
	height  int
}

// New creates a new dashboard model.
func New(client *api.Client) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(common.ColorBlue)
	return Model{
		client:  client,
		loading: true,
		spinner: s,
	}
}

// Init starts the data fetch.
func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchData())
}

// Update handles messages.
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case dataMsg:
		m.data = msg.data
		m.loading = false
		m.err = nil
	case errMsg:
		m.err = msg.err
		m.loading = false
	case tea.KeyMsg:
		if key.Matches(msg, common.Keys.Refresh) {
			m.loading = true
			return m, tea.Batch(m.spinner.Tick, m.fetchData())
		}
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	}
	return m, nil
}

// View renders the dashboard.
func (m Model) View() string {
	if m.loading {
		return m.spinner.View() + " Loading dashboard..."
	}
	if m.err != nil {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}
	if m.data == nil {
		return common.TitleStyle.Render("Dashboard") + "\n\n" +
			common.MutedStyle.Render("  No data") + "\n\n" +
			common.HelpStyle.Render("  s settings  R refresh")
	}

	var b strings.Builder

	// Title
	b.WriteString(common.TitleStyle.Render("Dashboard"))
	b.WriteString("\n")

	// Stats overview
	fmt.Fprintf(&b, "  Total applications: %s\n\n",
		lipgloss.NewStyle().Bold(true).Foreground(common.ColorBlue).Render(fmt.Sprintf("%d", m.data.TotalApplications)))

	// Status breakdown
	b.WriteString(common.SubtitleStyle.Render("  Pipeline"))
	b.WriteString("\n")

	statuses := []string{"applied", "interview", "offer", "rejected", "ghosted"}
	for _, status := range statuses {
		count := m.data.ByStatus[status]
		badge := common.StatusBadge(status)
		bar := renderBar(count, m.data.TotalApplications, 20)
		fmt.Fprintf(&b, "  %-12s %s %d\n", badge, bar, count)
	}

	// Recent applications
	if len(m.data.RecentApplications) > 0 {
		b.WriteString("\n")
		b.WriteString(common.SubtitleStyle.Render("  Recent Applications"))
		b.WriteString("\n")

		limit := 8
		if len(m.data.RecentApplications) < limit {
			limit = len(m.data.RecentApplications)
		}
		for _, app := range m.data.RecentApplications[:limit] {
			date := app.CreatedAt.Format("2006-01-02")
			status := common.StatusBadge(app.Status)
			fmt.Fprintf(&b, "  %s  %-12s  %s - %s\n",
				common.MutedStyle.Render(date),
				status,
				lipgloss.NewStyle().Bold(true).Render(app.Company),
				app.Position)
		}
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  s settings  R refresh"))

	return b.String()
}

func (m Model) fetchData() tea.Cmd {
	return func() tea.Msg {
		data, err := m.client.GetDashboard()
		if err != nil {
			return errMsg{err}
		}
		return dataMsg{data}
	}
}

func renderBar(value, total, width int) string {
	if total == 0 {
		return strings.Repeat(".", width)
	}
	filled := (value * width) / total
	if filled > width {
		filled = width
	}
	return lipgloss.NewStyle().Foreground(common.ColorBlue).Render(strings.Repeat("█", filled)) +
		lipgloss.NewStyle().Foreground(common.ColorSurface1).Render(strings.Repeat("░", width-filled))
}
