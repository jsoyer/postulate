package apps

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
	"github.com/jsoyer/cv-tui-go/internal/ui/forms"
)

type detailMsg struct{ app *api.Application }
type detailErrMsg struct{ err error }
type batchDoneMsg struct{}

// RunActionMsg is sent when the user wants to run an action on this app.
type RunActionMsg struct{ AppName string }

// QuickActionMsg is sent when the user selects a quick action from the detail view.
type QuickActionMsg struct {
	AppName string
	Target  string
	Theme   string // optional, for tailor
}

type detailModal int

const (
	modalNone  detailModal = iota
	modalTheme             // theme picker
	modalNotes             // notes editor
)

var batchThemes = []string{"catppuccin-mocha", "catppuccin-latte", "dracula", "nord"}

// DetailModel is the application detail view.
type DetailModel struct {
	client       *api.Client
	app          *api.Application
	appName      string
	err          error
	loading      bool
	spinner      spinner.Model
	width        int
	height       int
	modal        detailModal
	themeForm    forms.ThemeForm
	notesForm    forms.NotesForm
	batchRunning bool
	batchDone    int
	batchTotal   int
	batchErr     string
}

// NewDetail creates a new detail model for the given application.
func NewDetail(client *api.Client, appName string) DetailModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(common.ColorBlue)
	return DetailModel{
		client:  client,
		appName: appName,
		loading: true,
		spinner: s,
	}
}

// Init fetches the application data.
func (m DetailModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchDetail())
}

// Update handles messages.
func (m DetailModel) Update(msg tea.Msg) (DetailModel, tea.Cmd) {
	// Delegate to active modal first.
	if m.modal != modalNone {
		return m.updateModal(msg)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case detailMsg:
		m.app = msg.app
		m.loading = false

	case detailErrMsg:
		m.err = msg.err
		m.loading = false

	case batchDoneMsg:
		m.batchDone++
		if m.batchDone >= m.batchTotal {
			m.batchRunning = false
		}

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case tea.KeyMsg:
		return m.handleKey(msg)
	}
	return m, nil
}

func (m DetailModel) updateModal(msg tea.Msg) (DetailModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		switch m.modal {
		case modalTheme:
			m.themeForm = m.themeForm.SetSize(msg.Width, msg.Height)
		case modalNotes:
			m.notesForm = m.notesForm.SetSize(msg.Width, msg.Height)
		}
		return m, nil

	case forms.ThemeSelectedMsg:
		theme := msg.Theme
		appName := m.appName
		m.modal = modalNone
		return m, func() tea.Msg {
			return QuickActionMsg{AppName: appName, Target: "tailor", Theme: theme}
		}

	case forms.ThemeCancelledMsg:
		m.modal = modalNone
		return m, nil

	case forms.NotesSavedMsg:
		m.modal = modalNone
		return m, nil

	case forms.NotesCancelledMsg:
		m.modal = modalNone
		return m, nil
	}

	switch m.modal {
	case modalTheme:
		var cmd tea.Cmd
		m.themeForm, cmd = m.themeForm.Update(msg)
		return m, cmd
	case modalNotes:
		var cmd tea.Cmd
		m.notesForm, cmd = m.notesForm.Update(msg)
		return m, cmd
	}
	return m, nil
}

func (m DetailModel) handleKey(msg tea.KeyMsg) (DetailModel, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Run):
		if m.app != nil {
			appName := m.appName
			return m, func() tea.Msg {
				return RunActionMsg{AppName: appName}
			}
		}

	case key.Matches(msg, common.Keys.Refresh):
		m.loading = true
		return m, tea.Batch(m.spinner.Tick, m.fetchDetail())

	case key.Matches(msg, common.Keys.Tailor):
		if m.app != nil {
			// Open theme picker first.
			m.modal = modalTheme
			m.themeForm = forms.NewThemeForm(m.width, m.height)
			return m, nil
		}

	case key.Matches(msg, common.Keys.Review):
		if m.app != nil {
			appName := m.appName
			return m, func() tea.Msg {
				return QuickActionMsg{AppName: appName, Target: "review"}
			}
		}

	case key.Matches(msg, common.Keys.Build):
		if m.app != nil {
			appName := m.appName
			return m, func() tea.Msg {
				return QuickActionMsg{AppName: appName, Target: "app"}
			}
		}

	case key.Matches(msg, common.Keys.Score):
		if m.app != nil {
			appName := m.appName
			return m, func() tea.Msg {
				return QuickActionMsg{AppName: appName, Target: "score"}
			}
		}

	case key.Matches(msg, common.Keys.Prep):
		if m.app != nil {
			appName := m.appName
			return m, func() tea.Msg {
				return QuickActionMsg{AppName: appName, Target: "prep"}
			}
		}

	case key.Matches(msg, common.Keys.Batch):
		if m.app != nil && !m.batchRunning {
			return m.startBatch()
		}

	case key.Matches(msg, common.Keys.Notes):
		if m.app != nil {
			nf, err := forms.NewNotesForm(m.appName, m.width, m.height)
			if err != nil {
				m.batchErr = "Cannot open notes: " + err.Error()
				return m, nil
			}
			m.notesForm = nf
			m.modal = modalNotes
			return m, m.notesForm.Init()
		}
	}
	return m, nil
}

func (m DetailModel) startBatch() (DetailModel, tea.Cmd) {
	m.batchRunning = true
	m.batchDone = 0
	m.batchTotal = len(batchThemes)
	m.batchErr = ""
	client := m.client
	appName := m.appName

	var cmds []tea.Cmd
	for _, theme := range batchThemes {
		theme := theme // capture loop var
		cmds = append(cmds, func() tea.Msg {
			_ = client.StreamAction(context.Background(), "tailor", appName+"?theme="+theme, func(_ api.WSMessage) {})
			return batchDoneMsg{}
		})
	}
	return m, tea.Batch(cmds...)
}

// View renders the application detail.
func (m DetailModel) View() string {
	base := m.renderBase()

	switch m.modal {
	case modalTheme:
		return m.themeForm.View()
	case modalNotes:
		return m.notesForm.View()
	}

	return base
}

func (m DetailModel) renderBase() string {
	if m.loading {
		return m.spinner.View() + " Loading application..."
	}
	if m.err != nil {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}
	if m.app == nil {
		return "No data"
	}

	app := m.app
	var b strings.Builder

	// Header.
	b.WriteString(common.TitleStyle.Render(app.Company + " - " + app.Position))
	b.WriteString("\n")

	// Meta info.
	fmt.Fprintf(&b, "  Directory:  %s\n", common.MutedStyle.Render(app.Name))
	fmt.Fprintf(&b, "  Status:     %s\n", common.StatusBadge(app.Status))
	fmt.Fprintf(&b, "  Created:    %s\n", app.CreatedAt.Format("2006-01-02 15:04"))
	if app.Deadline != nil {
		fmt.Fprintf(&b, "  Deadline:   %s\n", app.Deadline.Format("2006-01-02"))
	}
	if app.Outcome != "" {
		fmt.Fprintf(&b, "  Outcome:    %s\n", app.Outcome)
	}

	// Files.
	if len(app.Files) > 0 {
		b.WriteString("\n")
		b.WriteString(common.SubtitleStyle.Render("  Files"))
		b.WriteString("\n")

		for name, content := range app.Files {
			size := len(content)
			var sizeStr string
			if size > 1024 {
				sizeStr = fmt.Sprintf("%.1f KB", float64(size)/1024)
			} else {
				sizeStr = fmt.Sprintf("%d B", size)
			}
			icon := fileIcon(name)
			fmt.Fprintf(&b, "  %s %s  %s\n", icon, name, common.MutedStyle.Render(sizeStr))
		}
	}

	// Batch progress.
	if m.batchRunning {
		b.WriteString("\n")
		b.WriteString(common.WarningStyle.Render(fmt.Sprintf("  Batch: %d/%d themes running...", m.batchDone, m.batchTotal)))
		b.WriteString("\n")
	} else if m.batchDone > 0 && !m.batchRunning {
		b.WriteString("\n")
		b.WriteString(common.SuccessStyle.Render(fmt.Sprintf("  Batch: %d themes completed", m.batchDone)))
		b.WriteString("\n")
	}
	if m.batchErr != "" {
		b.WriteString(common.ErrorStyle.Render("  " + m.batchErr))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  esc back  r run  t tailor  v review  b build  s score  p prep  B batch  N notes  R refresh"))

	return b.String()
}

func (m DetailModel) fetchDetail() tea.Cmd {
	return func() tea.Msg {
		app, err := m.client.GetApplication(m.appName)
		if err != nil {
			return detailErrMsg{err}
		}
		return detailMsg{app}
	}
}

func fileIcon(name string) string {
	if strings.HasSuffix(name, ".yml") || strings.HasSuffix(name, ".yaml") {
		return lipgloss.NewStyle().Foreground(common.ColorYellow).Render("*")
	}
	if strings.HasSuffix(name, ".md") {
		return lipgloss.NewStyle().Foreground(common.ColorBlue).Render("*")
	}
	if strings.HasSuffix(name, ".txt") {
		return lipgloss.NewStyle().Foreground(common.ColorSubtext0).Render("*")
	}
	return lipgloss.NewStyle().Foreground(common.ColorOverlay0).Render("*")
}
