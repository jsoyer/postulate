package actions

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

type targetsMsg struct {
	targets  []api.Target
	appNames []string
}

type resultMsg struct{ result *api.ActionResult }
type streamMsg struct{ msg api.WSMessage }
type errMsg struct{ err error }
type doneMsg struct{}

type streamChan chan api.WSMessage

// RunnerModel is the action runner view.
type RunnerModel struct {
	client       *api.Client
	targets      []api.Target
	filtered     []api.Target
	cursor       int
	appInput     textinput.Model
	argInputs    map[string]textinput.Model
	output       []string
	running      bool
	done         bool
	err          error
	loading      bool
	spinner      spinner.Model
	phase        int // 0=select target, 1=enter args, 2=running/output
	selected     *api.Target
	appName      string // pre-filled app name if navigated from detail
	preTarget    string // auto-select this target name on load
	PreArgs      map[string]string
	streamCh     streamChan
	streamCancel context.CancelFunc
	width        int
	height       int
	provider     string
	appNames     []string
	appCursor    int
	vp           viewport.Model
}

// NewRunner creates a new action runner.
func NewRunner(client *api.Client, appName string) RunnerModel {
	return newRunnerFull(client, appName, "")
}

// NewRunnerWithTarget creates an action runner that auto-selects the given target.
func NewRunnerWithTarget(client *api.Client, appName, preTarget string) RunnerModel {
	return newRunnerFull(client, appName, preTarget)
}

func newRunnerFull(client *api.Client, appName, preTarget string) RunnerModel {
	s := spinner.New()
	s.Spinner = spinner.Line
	s.Style = lipgloss.NewStyle().Foreground(common.ColorGreen)

	ai := textinput.New()
	ai.Placeholder = "application name"
	ai.CharLimit = 128

	if appName != "" {
		ai.SetValue(appName)
	}

	return RunnerModel{
		client:    client,
		loading:   true,
		spinner:   s,
		appInput:  ai,
		argInputs: make(map[string]textinput.Model),
		appName:   appName,
		preTarget: preTarget,
		vp:        viewport.New(80, 20),
	}
}

// Init loads the target list.
func (m RunnerModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchTargets())
}

// Update handles messages.
func (m RunnerModel) Update(msg tea.Msg) (RunnerModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.vp.Width = msg.Width
		m.vp.Height = max(1, msg.Height-8)

	case targetsMsg:
		m.targets = msg.targets
		m.filtered = msg.targets
		m.appNames = msg.appNames
		m.loading = false

		// Auto-select preTarget if set.
		if m.preTarget != "" {
			for i, t := range m.filtered {
				if t.Name == m.preTarget {
					m.cursor = i
					target := m.filtered[i]
					m.selected = &target
					m.phase = 1

					for _, arg := range target.Args {
						ti := textinput.New()
						ti.Placeholder = arg
						ti.CharLimit = 256
						m.argInputs[arg] = ti
					}

					// Pre-fill from PreArgs.
					for arg, val := range m.PreArgs {
						if ti, ok := m.argInputs[arg]; ok {
							ti.SetValue(val)
							m.argInputs[arg] = ti
						}
					}

					if hasArg(target.Args, "app") {
						m.appInput.Focus()
						return m, textinput.Blink
					} else if len(target.Args) > 0 {
						first := target.Args[0]
						ti := m.argInputs[first]
						ti.Focus()
						m.argInputs[first] = ti
						return m, textinput.Blink
					}
					// No args needed, go straight to streaming.
					m.phase = 2
					m.running = true
					m.output = nil
					m.provider = ""
					return m, tea.Batch(m.spinner.Tick, m.startStream())
				}
			}
		}

	case resultMsg:
		m.running = false
		m.done = true
		if msg.result.Stdout != "" {
			lines := strings.Split(msg.result.Stdout, "\n")
			for _, l := range lines {
				m.appendOutputLine(l)
			}
		}
		if msg.result.Stderr != "" {
			lines := strings.Split(msg.result.Stderr, "\n")
			for _, l := range lines {
				m.appendOutputLine(l)
			}
		}
		m.vp.SetContent(strings.Join(m.output, "\n"))
		m.vp.GotoBottom()

	case streamMsg:
		m.appendOutputLine(msg.msg.Data)
		m.vp.SetContent(strings.Join(m.output, "\n"))
		m.vp.GotoBottom()
		if msg.msg.Type == "exit" || msg.msg.Type == "error" {
			m.running = false
			m.done = true
			return m, nil
		}
		// Continue reading from the channel.
		if m.streamCh != nil {
			return m, readNextStream(m.streamCh)
		}

	case doneMsg:
		m.running = false
		m.done = true

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
			return m.handleTargetSelect(msg)
		case 1:
			return m.handleArgInput(msg)
		case 2:
			return m.handleOutput(msg)
		}
	}

	return m, nil
}

// appendOutputLine adds a line to output and runs provider detection.
func (m *RunnerModel) appendOutputLine(line string) {
	if line != "" {
		m.output = append(m.output, line)
	}
	if m.provider == "" {
		if p := detectProvider(line); p != "" {
			m.provider = p
		}
	}
}

func (m RunnerModel) handleTargetSelect(msg tea.KeyMsg) (RunnerModel, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Down):
		if m.cursor < len(m.filtered)-1 {
			m.cursor++
		}
	case key.Matches(msg, common.Keys.Up):
		if m.cursor > 0 {
			m.cursor--
		}
	case key.Matches(msg, common.Keys.Select):
		if m.cursor < len(m.filtered) {
			target := m.filtered[m.cursor]
			m.selected = &target
			m.phase = 1

			// Prepare arg inputs.
			for _, arg := range target.Args {
				ti := textinput.New()
				ti.Placeholder = arg
				ti.CharLimit = 256
				m.argInputs[arg] = ti
			}

			// Pre-fill from PreArgs.
			for arg, val := range m.PreArgs {
				if ti, ok := m.argInputs[arg]; ok {
					ti.SetValue(val)
					m.argInputs[arg] = ti
				}
			}

			// Focus first input.
			if hasArg(target.Args, "app") {
				m.appInput.Focus()
				return m, textinput.Blink
			} else if len(target.Args) > 0 {
				first := target.Args[0]
				ti := m.argInputs[first]
				ti.Focus()
				m.argInputs[first] = ti
				return m, textinput.Blink
			}
			// No args needed, skip to streaming.
			m.phase = 2
			m.running = true
			m.output = nil
			m.provider = ""
			return m, tea.Batch(m.spinner.Tick, m.startStream())
		}
	}
	return m, nil
}

// isAppPickerMode returns true when the NAME arg should show a picker.
func (m RunnerModel) isAppPickerMode() bool {
	if m.selected == nil {
		return false
	}
	for _, a := range m.selected.Args {
		if strings.EqualFold(a, "NAME") {
			return len(m.appNames) > 0
		}
	}
	return false
}

func (m RunnerModel) handleArgInput(msg tea.KeyMsg) (RunnerModel, tea.Cmd) {
	// App picker mode for NAME arg.
	if m.isAppPickerMode() {
		switch msg.String() {
		case "j", "down":
			if m.appCursor < len(m.appNames)-1 {
				m.appCursor++
			}
			return m, nil
		case "k", "up":
			if m.appCursor > 0 {
				m.appCursor--
			}
			return m, nil
		case "enter":
			if m.appCursor < len(m.appNames) {
				m.appInput.SetValue(m.appNames[m.appCursor])
			}
			m.phase = 2
			m.running = true
			m.output = nil
			m.provider = ""
			return m, tea.Batch(m.spinner.Tick, m.startStream())
		case "esc":
			m.phase = 0
			m.selected = nil
			return m, nil
		}
		return m, nil
	}

	switch msg.String() {
	case "enter":
		m.phase = 2
		m.running = true
		m.output = nil
		m.provider = ""
		return m, tea.Batch(m.spinner.Tick, m.startStream())
	case "esc":
		m.phase = 0
		m.selected = nil
		return m, nil
	}

	// Update the focused input.
	if hasArg(m.selected.Args, "app") {
		var cmd tea.Cmd
		m.appInput, cmd = m.appInput.Update(msg)
		return m, cmd
	}
	for name, ti := range m.argInputs {
		if ti.Focused() {
			var cmd tea.Cmd
			ti, cmd = ti.Update(msg)
			m.argInputs[name] = ti
			return m, cmd
		}
	}
	return m, nil
}

func (m RunnerModel) handleOutput(msg tea.KeyMsg) (RunnerModel, tea.Cmd) {
	switch {
	case key.Matches(msg, common.Keys.Back):
		if m.streamCancel != nil {
			m.streamCancel()
			m.streamCancel = nil
		}
		m.phase = 0
		m.selected = nil
		m.output = nil
		m.done = false
		m.err = nil
		m.streamCh = nil
		m.provider = ""
		m.vp.SetContent("")
		return m, nil
	case key.Matches(msg, common.Keys.Run):
		if m.done && m.selected != nil {
			m.running = true
			m.done = false
			m.output = nil
			m.provider = ""
			m.vp.SetContent("")
			return m, tea.Batch(m.spinner.Tick, m.startStream())
		}
	}
	// Delegate all other keys to the viewport for scrolling.
	var cmd tea.Cmd
	m.vp, cmd = m.vp.Update(msg)
	return m, cmd
}

// View renders the action runner.
func (m RunnerModel) View() string {
	if m.loading {
		return m.spinner.View() + " Loading targets..."
	}
	if m.err != nil && m.phase != 2 {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}

	switch m.phase {
	case 0:
		return m.viewTargetSelect()
	case 1:
		return m.viewArgInput()
	case 2:
		return m.viewOutput()
	}
	return ""
}

func (m RunnerModel) viewTargetSelect() string {
	var b strings.Builder
	b.WriteString(common.TitleStyle.Render("Run Action"))
	b.WriteString("\n")

	visible := max(1, m.height-6)
	offset := 0
	if m.cursor >= visible {
		offset = m.cursor - visible + 1
	}
	end := min(offset+visible, len(m.filtered))

	for i := offset; i < end; i++ {
		t := m.filtered[i]
		cat := common.MutedStyle.Render(fmt.Sprintf("[%s]", t.Category))
		line := fmt.Sprintf("  %-20s %s %s", t.Name, cat, t.Description)
		if i == m.cursor {
			b.WriteString(common.SelectedStyle.Render("> " + line[2:]))
		} else {
			b.WriteString(line)
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  j/k navigate  enter select"))
	return b.String()
}

func (m RunnerModel) viewArgInput() string {
	var b strings.Builder
	b.WriteString(common.TitleStyle.Render("Run: " + m.selected.Name))
	b.WriteString("\n")
	b.WriteString(common.MutedStyle.Render("  " + m.selected.Description))
	b.WriteString("\n\n")

	if hasArg(m.selected.Args, "app") {
		b.WriteString("  Application: ")
		b.WriteString(m.appInput.View())
		b.WriteString("\n")
	}

	for _, arg := range m.selected.Args {
		if arg == "app" {
			continue
		}
		// Show picker for NAME arg when app names are available.
		if strings.EqualFold(arg, "NAME") && len(m.appNames) > 0 {
			b.WriteString("  Application (NAME):\n")
			visible := max(1, m.height-10)
			offset := 0
			if m.appCursor >= visible {
				offset = m.appCursor - visible + 1
			}
			end := min(offset+visible, len(m.appNames))
			for i := offset; i < end; i++ {
				if i == m.appCursor {
					b.WriteString(common.SelectedStyle.Render("  > " + m.appNames[i]))
				} else {
					b.WriteString("    " + m.appNames[i])
				}
				b.WriteString("\n")
			}
			continue
		}
		ti := m.argInputs[arg]
		fmt.Fprintf(&b, "  %s: %s\n", arg, ti.View())
	}

	b.WriteString("\n")
	b.WriteString(common.HelpStyle.Render("  enter run  esc cancel"))
	return b.String()
}

func (m RunnerModel) viewOutput() string {
	var b strings.Builder
	b.WriteString(common.TitleStyle.Render("Output: " + m.selected.Name))
	b.WriteString("\n")

	if m.provider != "" {
		providerStyle := providerColor(m.provider)
		b.WriteString("  Provider: ")
		b.WriteString(providerStyle.Render(m.provider))
		b.WriteString("\n")
	}

	if m.running {
		b.WriteString("  " + m.spinner.View() + " Running...\n\n")
	} else if m.done {
		b.WriteString("  " + common.SuccessStyle.Render("Done") + "\n\n")
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

// startStream launches the WebSocket stream in a goroutine and returns the
// first read command.
func (m *RunnerModel) startStream() tea.Cmd {
	ch := make(streamChan, 100)
	m.streamCh = ch

	target := m.selected.Name
	app := m.appInput.Value()
	if m.appName != "" && app == "" {
		app = m.appName
	}

	args := make(map[string]string)
	for name, ti := range m.argInputs {
		if name != "app" && ti.Value() != "" {
			args[name] = ti.Value()
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.streamCancel = cancel

	client := m.client
	go func() {
		defer close(ch)
		_ = client.StreamAction(ctx, target, app, func(msg api.WSMessage) {
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

func (m RunnerModel) fetchTargets() tea.Cmd {
	return func() tea.Msg {
		targets, err := m.client.ListTargets()
		if err != nil {
			return errMsg{err}
		}
		apps, _ := m.client.ListApplications() // best-effort
		names := make([]string, len(apps))
		for i, a := range apps {
			names[i] = a.Name
		}
		return targetsMsg{targets: targets, appNames: names}
	}
}

// detectProvider scans a line for known AI provider keywords.
// Returns the provider name or empty string.
func detectProvider(line string) string {
	lower := strings.ToLower(line)
	switch {
	case strings.Contains(lower, "gemini"):
		return "Gemini"
	case strings.Contains(lower, "claude") || strings.Contains(lower, "anthropic"):
		return "Claude"
	case strings.Contains(lower, "openai") || strings.Contains(lower, "gpt"):
		return "OpenAI"
	case strings.Contains(lower, "mistral"):
		return "Mistral"
	case strings.Contains(lower, "ollama"):
		return "Ollama (local)"
	}
	return ""
}

// providerColor returns a lipgloss style for the given provider name.
func providerColor(provider string) lipgloss.Style {
	switch provider {
	case "Gemini":
		return lipgloss.NewStyle().Foreground(common.ColorYellow)
	case "Claude":
		return lipgloss.NewStyle().Foreground(common.ColorMauve)
	case "OpenAI":
		return lipgloss.NewStyle().Foreground(common.ColorGreen)
	case "Mistral":
		return lipgloss.NewStyle().Foreground(common.ColorPeach)
	case "Ollama (local)":
		return lipgloss.NewStyle().Foreground(common.ColorTeal)
	}
	return lipgloss.NewStyle().Foreground(common.ColorSubtext0)
}

func hasArg(args []string, name string) bool {
	for _, a := range args {
		if a == name {
			return true
		}
	}
	return false
}
