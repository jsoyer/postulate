// Package audit provides the audit view for evaluating application quality.
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

// AuditResult is parsed from the stdout JSON emitted by the audit action.
type AuditResult struct {
	Score         float64            `json:"score"`
	Metrics       map[string]float64 `json:"metrics"`
	Duplicates    []string           `json:"duplicates"`
	OverusedWords []string           `json:"overused_words"`
}

type appsMsg struct{ apps []api.Application }
type streamMsg struct{ msg api.WSMessage }
type errMsg struct{ err error }
type doneMsg struct{}

type streamChan chan api.WSMessage

// Model is the audit view.
type Model struct {
	client   *api.Client
	apps     []api.Application
	cursor   int
	output   []string
	result   *AuditResult
	running  bool
	done     bool
	err      error
	loading  bool
	spinner  spinner.Model
	streamCh streamChan
	phase    int // 0=select app, 1=running/output
	width    int
	height   int
	vp       viewport.Model
}

// New creates a new audit model.
func New(client *api.Client) Model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(common.ColorTeal)
	return Model{
		client:  client,
		loading: true,
		spinner: s,
		vp:      viewport.New(80, 20),
	}
}

// Init loads the application list.
func (m Model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchApps())
}

// Update handles messages.
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.vp.Width = msg.Width
		m.vp.Height = max(1, msg.Height-8)

	case appsMsg:
		m.apps = msg.apps
		m.loading = false

	case streamMsg:
		if msg.msg.Data != "" {
			m.output = append(m.output, msg.msg.Data)
		}
		if msg.msg.Type == "exit" || msg.msg.Type == "error" {
			m.running = false
			m.done = true
			m.result = parseAuditResult(m.output)
			if m.result != nil {
				m.vp.SetContent(m.renderResult())
			} else {
				m.vp.SetContent(strings.Join(m.output, "\n"))
			}
			m.vp.GotoTop()
			return m, nil
		}
		// While streaming, show raw output scrolled to the bottom.
		m.vp.SetContent(strings.Join(m.output, "\n"))
		m.vp.GotoBottom()
		if m.streamCh != nil {
			return m, readNextStream(m.streamCh)
		}

	case doneMsg:
		m.running = false
		m.done = true
		m.result = parseAuditResult(m.output)
		if m.result != nil {
			m.vp.SetContent(m.renderResult())
		} else {
			m.vp.SetContent(strings.Join(m.output, "\n"))
		}
		m.vp.GotoTop()

	case errMsg:
		m.err = msg.err
		m.loading = false
		m.running = false

	case spinner.TickMsg:
		if m.running || m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case tea.KeyMsg:
		switch m.phase {
		case 0:
			return m.handleAppSelect(msg)
		case 1:
			return m.handleOutput(msg)
		}
	}

	return m, nil
}

func (m Model) handleAppSelect(msg tea.KeyMsg) (Model, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Down):
		if m.cursor < len(m.apps)-1 {
			m.cursor++
		}
	case key.Matches(msg, common.Keys.Up):
		if m.cursor > 0 {
			m.cursor--
		}
	case key.Matches(msg, common.Keys.Select):
		if m.cursor < len(m.apps) {
			m.phase = 1
			m.running = true
			m.output = nil
			m.result = nil
			m.done = false
			m.err = nil
			return m, tea.Batch(m.spinner.Tick, m.startStream())
		}
	}
	return m, nil
}

func (m Model) handleOutput(msg tea.KeyMsg) (Model, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Back):
		m.phase = 0
		m.output = nil
		m.result = nil
		m.done = false
		m.err = nil
		m.streamCh = nil
		m.vp.SetContent("")
		return m, nil
	case key.Matches(msg, common.Keys.Run):
		if m.done {
			m.running = true
			m.done = false
			m.output = nil
			m.result = nil
			m.vp.SetContent("")
			return m, tea.Batch(m.spinner.Tick, m.startStream())
		}
	}
	// Delegate all other keys to the viewport for scrolling.
	var cmd tea.Cmd
	m.vp, cmd = m.vp.Update(msg)
	return m, cmd
}

// View renders the audit view.
func (m Model) View() string {
	if m.loading {
		return m.spinner.View() + " Loading applications..."
	}
	if m.err != nil && m.phase != 1 {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}

	switch m.phase {
	case 0:
		return m.viewAppSelect()
	case 1:
		return m.viewOutput()
	}
	return ""
}

func (m Model) viewAppSelect() string {
	var b strings.Builder
	b.WriteString(common.TitleStyle.Render("Audit Application"))
	b.WriteString("\n")
	b.WriteString(common.MutedStyle.Render("  Select an application to audit its resume quality."))
	b.WriteString("\n\n")

	visible := max(1, m.height-8)
	offset := 0
	if m.cursor >= visible {
		offset = m.cursor - visible + 1
	}
	end := min(offset+visible, len(m.apps))

	for i := offset; i < end; i++ {
		app := m.apps[i]
		line := fmt.Sprintf("  %-30s %s", app.Company+" / "+app.Position, common.StatusBadge(app.Status))
		if i == m.cursor {
			b.WriteString(common.SelectedStyle.Render("> " + strings.TrimPrefix(line, "  ")))
		} else {
			b.WriteString(line)
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  j/k navigate  enter audit"))
	return b.String()
}

func (m Model) viewOutput() string {
	var b strings.Builder

	appName := ""
	if m.cursor < len(m.apps) {
		appName = m.apps[m.cursor].Name
	}
	b.WriteString(common.TitleStyle.Render("Audit: " + appName))
	b.WriteString("\n")

	if m.running {
		b.WriteString("  " + m.spinner.View() + " Running audit...\n\n")
	}

	if m.err != nil {
		b.WriteString(common.ErrorStyle.Render("  Error: "+m.err.Error()) + "\n")
	}

	b.WriteString(m.vp.View())

	b.WriteString("\n\n")
	if m.done {
		b.WriteString(common.HelpStyle.Render("  esc back  r re-run  up/down PgUp/PgDn scroll"))
	}
	return b.String()
}

func (m Model) renderResult() string {
	r := m.result
	var b strings.Builder

	b.WriteString("\n")
	scoreBar := renderProgressBar(r.Score/100.0, 28)
	fmt.Fprintf(&b, "  Health Score: %s%s  %.0f/100\n\n",
		lipgloss.NewStyle().Foreground(common.ColorTeal).Bold(true).Render(fmt.Sprintf("%.0f%%  ", r.Score)),
		scoreBar,
		r.Score,
	)

	if len(r.Metrics) > 0 {
		b.WriteString(common.SubtitleStyle.Render("  Metrics:"))
		b.WriteString("\n")

		// Deterministic metric order by iterating a predefined list first.
		knownOrder := []string{"clarity", "conciseness", "keywords", "impact", "format"}
		printed := make(map[string]bool)
		for _, name := range knownOrder {
			if val, ok := r.Metrics[name]; ok {
				b.WriteString(renderMetricLine(name, val))
				printed[name] = true
			}
		}
		for name, val := range r.Metrics {
			if !printed[name] {
				b.WriteString(renderMetricLine(name, val))
			}
		}
	}

	if len(r.Duplicates) > 0 {
		b.WriteString("\n")
		b.WriteString(common.SubtitleStyle.Render("  Duplicate phrases:"))
		b.WriteString("\n")
		for _, d := range r.Duplicates {
			b.WriteString(common.MutedStyle.Render("    - " + d))
			b.WriteString("\n")
		}
	}

	if len(r.OverusedWords) > 0 {
		b.WriteString("\n")
		b.WriteString(common.SubtitleStyle.Render("  Overused words:"))
		b.WriteString("\n")
		b.WriteString(common.MutedStyle.Render("    " + strings.Join(r.OverusedWords, ", ")))
		b.WriteString("\n")
	}

	return b.String()
}

func renderMetricLine(name string, val float64) string {
	bar := renderProgressBar(val/100.0, 28)
	label := fmt.Sprintf("  %-14s", name)
	return label + bar + fmt.Sprintf("  %.0f\n", val)
}

func renderProgressBar(fraction float64, width int) string {
	if fraction < 0 {
		fraction = 0
	}
	if fraction > 1 {
		fraction = 1
	}
	filled := int(math.Round(fraction * float64(width)))
	empty := width - filled
	return lipgloss.NewStyle().Foreground(common.ColorTeal).Render(strings.Repeat("█", filled)) +
		lipgloss.NewStyle().Foreground(common.ColorSurface1).Render(strings.Repeat("░", empty))
}

func (m *Model) startStream() tea.Cmd {
	ch := make(streamChan, 100)
	m.streamCh = ch

	appName := ""
	if m.cursor < len(m.apps) {
		appName = m.apps[m.cursor].Name
	}
	client := m.client

	go func() {
		defer close(ch)
		_ = client.StreamAction(context.Background(), "audit", appName, func(msg api.WSMessage) {
			ch <- msg
		})
	}()

	return readNextStream(ch)
}

func readNextStream(ch streamChan) tea.Cmd {
	return func() tea.Msg {
		msg, ok := <-ch
		if !ok {
			return doneMsg{}
		}
		return streamMsg{msg}
	}
}

func (m Model) fetchApps() tea.Cmd {
	return func() tea.Msg {
		apps, err := m.client.ListApplications()
		if err != nil {
			return errMsg{err}
		}
		return appsMsg{apps}
	}
}

// parseAuditResult tries to parse JSON from the collected output lines.
// It looks for a JSON object, trying each line and also the whole buffer.
func parseAuditResult(output []string) *AuditResult {
	full := strings.Join(output, "\n")

	// Try full buffer first.
	var r AuditResult
	if err := json.Unmarshal([]byte(full), &r); err == nil {
		return &r
	}

	// Try each line individually.
	for _, line := range output {
		line = strings.TrimSpace(line)
		if len(line) == 0 || line[0] != '{' {
			continue
		}
		if err := json.Unmarshal([]byte(line), &r); err == nil {
			return &r
		}
	}

	return nil
}
