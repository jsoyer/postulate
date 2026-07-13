// Package settings provides the settings view for displaying API configuration.
package settings

import (
	"fmt"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

type dataMsg struct{ data map[string]any }
type errMsg struct{ err error }

// Model is the settings view.
type Model struct {
	client  *api.Client
	data    map[string]any
	err     error
	loading bool
	spinner spinner.Model
	width   int
	height  int
}

// New creates a new settings model.
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

// Init starts the settings data fetch.
func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchData())
}

// Update handles messages for the settings view.
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
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case tea.KeyMsg:
		if key.Matches(msg, common.Keys.Refresh) {
			m.loading = true
			m.err = nil
			return m, tea.Batch(m.spinner.Tick, m.fetchData())
		}
	}

	return m, nil
}

// View renders the settings.
func (m Model) View() string {
	if m.loading {
		return m.spinner.View() + " Loading settings..."
	}

	var b strings.Builder
	b.WriteString(common.TitleStyle.Render("Settings"))
	b.WriteString("\n\n")

	if m.err != nil {
		b.WriteString(common.ErrorStyle.Render("Error: "+m.err.Error()) + "\n\n")
		b.WriteString(common.HelpStyle.Render("  q back  R refresh"))
		return b.String()
	}

	if len(m.data) == 0 {
		b.WriteString(common.MutedStyle.Render("  No settings found."))
		b.WriteString("\n")
	} else {
		// Deterministic order: sort keys alphabetically.
		keys := make([]string, 0, len(m.data))
		for k := range m.data {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			v := m.data[k]
			b.WriteString("  ")
			b.WriteString(common.SubtitleStyle.Render(k))
			b.WriteString(": ")
			b.WriteString(common.MutedStyle.Render(fmt.Sprintf("%v", v)))
			b.WriteString("\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  q back  R refresh"))
	return b.String()
}

func (m Model) fetchData() tea.Cmd {
	return func() tea.Msg {
		data, err := m.client.GetSettings()
		if err != nil {
			return errMsg{err}
		}
		return dataMsg{data}
	}
}
