package stats

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

type dataMsg struct{ data *api.StatsData }
type errMsg struct{ err error }

// Model is the stats/funnel view.
type Model struct {
	client  *api.Client
	data    *api.StatsData
	err     error
	loading bool
	spinner spinner.Model
	width   int
	height  int
}

// New creates a new stats model.
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
	case errMsg:
		m.err = msg.err
		m.loading = false
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case tea.KeyMsg:
		if key.Matches(msg, common.Keys.Refresh) {
			m.loading = true
			return m, tea.Batch(m.spinner.Tick, m.fetchData())
		}
	}
	return m, nil
}

// View renders the stats.
func (m Model) View() string {
	if m.loading {
		return m.spinner.View() + " Loading statistics..."
	}
	if m.err != nil {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}
	if m.data == nil {
		return "No data"
	}

	var b strings.Builder

	b.WriteString(common.TitleStyle.Render("Pipeline Statistics"))
	b.WriteString("\n")

	// Funnel chart
	b.WriteString(common.SubtitleStyle.Render("  Funnel"))
	b.WriteString("\n\n")

	total := 0
	for _, v := range m.data.Funnel {
		total += v
	}

	stages := []string{"applied", "interview", "offer", "rejected", "ghosted"}
	maxBarWidth := max(20, m.width-35)

	for _, stage := range stages {
		count := m.data.Funnel[stage]
		barLen := 0
		if total > 0 {
			barLen = (count * maxBarWidth) / total
		}

		color, ok := common.StatusColors[stage]
		if !ok {
			color = common.ColorOverlay0
		}

		bar := lipgloss.NewStyle().Foreground(color).Render(strings.Repeat("█", barLen))
		pct := ""
		if total > 0 {
			pct = fmt.Sprintf("%.0f%%", float64(count)/float64(total)*100)
		}

		fmt.Fprintf(&b, "  %-12s %s %d (%s)\n",
			common.StatusBadge(stage), bar, count, pct)
	}

	// Timeline
	if len(m.data.Timeline) > 0 {
		b.WriteString("\n")
		b.WriteString(common.SubtitleStyle.Render("  Monthly Activity"))
		b.WriteString("\n\n")

		maxCount := 0
		for _, e := range m.data.Timeline {
			if e.Count > maxCount {
				maxCount = e.Count
			}
		}

		barWidth := max(10, m.width-25)
		for _, entry := range m.data.Timeline {
			barLen := 0
			if maxCount > 0 {
				barLen = (entry.Count * barWidth) / maxCount
			}
			bar := lipgloss.NewStyle().Foreground(common.ColorTeal).Render(strings.Repeat("▓", barLen))
			fmt.Fprintf(&b, "  %s  %s %d\n", entry.Date, bar, entry.Count)
		}
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  R refresh"))

	return b.String()
}

func (m Model) fetchData() tea.Cmd {
	return func() tea.Msg {
		data, err := m.client.GetStats()
		if err != nil {
			return errMsg{err}
		}
		return dataMsg{data}
	}
}
