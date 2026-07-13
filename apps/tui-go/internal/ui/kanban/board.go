package kanban

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

type appsMsg struct{ apps []api.Application }
type errMsg struct{ err error }

// statusUpdatedMsg is emitted after a successful PATCH status update.
type statusUpdatedMsg struct {
	appName   string
	newStatus string
}

// statusErrMsg is emitted when a PATCH status update fails; it carries the
// original state so the optimistic update can be rolled back.
type statusErrMsg struct {
	appName    string
	origStatus string
	app        api.Application
	err        error
}

var columns = []string{"applied", "interview", "offer", "rejected", "ghosted"}

// BoardModel is the kanban board view.
type BoardModel struct {
	client    *api.Client
	apps      []api.Application
	byStatus  map[string][]api.Application
	col       int // focused column
	row       int // focused row within column
	err       error
	loading   bool
	spinner   spinner.Model
	width     int
	height    int
	statusMsg string // transient status / error feedback line
}

// NewBoard creates a new kanban board.
func NewBoard(client *api.Client) BoardModel {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(common.ColorBlue)
	return BoardModel{
		client:   client,
		byStatus: make(map[string][]api.Application),
		loading:  true,
		spinner:  s,
	}
}

// Init starts the data fetch.
func (m BoardModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, m.fetchApps())
}

// Update handles messages.
func (m BoardModel) Update(msg tea.Msg) (BoardModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
	case appsMsg:
		m.apps = msg.apps
		m.byStatus = make(map[string][]api.Application)
		for _, app := range m.apps {
			m.byStatus[app.Status] = append(m.byStatus[app.Status], app)
		}
		m.loading = false
	case errMsg:
		m.err = msg.err
		m.loading = false
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case statusUpdatedMsg:
		m.statusMsg = common.SuccessStyle.Render("  Moved to " + msg.newStatus)
		return m, nil

	case statusErrMsg:
		// Roll back the optimistic update: remove the card from wherever it ended
		// up and put it back in origStatus.
		for _, col := range columns {
			apps := m.byStatus[col]
			for i, a := range apps {
				if a.Name == msg.appName {
					m.byStatus[col] = append(apps[:i], apps[i+1:]...)
					break
				}
			}
		}
		m.byStatus[msg.origStatus] = append([]api.Application{msg.app}, m.byStatus[msg.origStatus]...)
		m.statusMsg = common.ErrorStyle.Render("  Error: " + msg.err.Error())
		return m, nil

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, common.Keys.Left):
			if m.col > 0 {
				m.col--
				m.clampRow()
			}
		case key.Matches(msg, common.Keys.Right):
			if m.col < len(columns)-1 {
				m.col++
				m.clampRow()
			}
		case key.Matches(msg, common.Keys.Up):
			if m.row > 0 {
				m.row--
			}
		case key.Matches(msg, common.Keys.Down):
			colApps := m.byStatus[columns[m.col]]
			if m.row < len(colApps)-1 {
				m.row++
			}
		case key.Matches(msg, common.Keys.Select):
			return m.moveCardRight()
		case key.Matches(msg, common.Keys.Refresh):
			m.loading = true
			m.statusMsg = ""
			return m, tea.Batch(m.spinner.Tick, m.fetchApps())
		}
	}
	return m, nil
}

// moveCardRight moves the focused card to the next column (optimistic update).
func (m BoardModel) moveCardRight() (BoardModel, tea.Cmd) {
	colApps := m.byStatus[columns[m.col]]
	if len(colApps) == 0 {
		return m, nil
	}
	if m.row >= len(colApps) {
		return m, nil
	}
	nextCol := m.col + 1
	if nextCol >= len(columns) {
		// Already in the last column — no further movement.
		return m, nil
	}

	app := colApps[m.row]
	origStatus := columns[m.col]
	newStatus := columns[nextCol]

	// Optimistic update: remove from current column, insert at head of next.
	remaining := make([]api.Application, 0, len(colApps)-1)
	remaining = append(remaining, colApps[:m.row]...)
	remaining = append(remaining, colApps[m.row+1:]...)
	m.byStatus[origStatus] = remaining
	m.byStatus[newStatus] = append([]api.Application{app}, m.byStatus[newStatus]...)

	// Clamp cursor.
	if m.row >= len(remaining) && m.row > 0 {
		m.row--
	}
	m.statusMsg = ""

	// Update the master list entry too.
	for i, a := range m.apps {
		if a.Name == app.Name {
			m.apps[i].Status = newStatus
			break
		}
	}

	appCopy := app
	client := m.client
	return m, func() tea.Msg {
		if err := client.UpdateApplicationStatus(appCopy.Name, newStatus); err != nil {
			return statusErrMsg{
				appName:    appCopy.Name,
				origStatus: origStatus,
				app:        appCopy,
				err:        err,
			}
		}
		return statusUpdatedMsg{appName: appCopy.Name, newStatus: newStatus}
	}
}

func (m *BoardModel) clampRow() {
	colApps := m.byStatus[columns[m.col]]
	if m.row >= len(colApps) {
		m.row = max(0, len(colApps)-1)
	}
}

// View renders the kanban board.
func (m BoardModel) View() string {
	if m.loading {
		return m.spinner.View() + " Loading kanban board..."
	}
	if m.err != nil {
		return common.ErrorStyle.Render("Error: " + m.err.Error())
	}

	title := common.TitleStyle.Render("Kanban Board")

	colWidth := max(20, (m.width-4)/len(columns))
	maxCards := max(1, m.height-8)

	var renderedCols []string
	for ci, status := range columns {
		renderedCols = append(renderedCols, m.renderColumn(ci, status, colWidth, maxCards))
	}

	board := lipgloss.JoinHorizontal(lipgloss.Top, renderedCols...)
	help := common.HelpStyle.Render("  h/l columns  j/k cards  enter move  R refresh")

	footer := "\n\n" + help
	if m.statusMsg != "" {
		footer = "\n" + m.statusMsg + "\n" + help
	}

	return title + "\n\n" + board + footer
}

func (m BoardModel) renderColumn(colIdx int, status string, width, maxCards int) string {
	apps := m.byStatus[status]
	isFocused := colIdx == m.col

	// Column header
	color, ok := common.StatusColors[status]
	if !ok {
		color = common.ColorOverlay0
	}
	headerStyle := lipgloss.NewStyle().
		Width(width - 2).
		Bold(true).
		Foreground(color).
		Align(lipgloss.Center)

	header := headerStyle.Render(fmt.Sprintf("%s (%d)", status, len(apps)))

	// Cards
	var cards []string
	limit := min(len(apps), maxCards)
	for i := 0; i < limit; i++ {
		cards = append(cards, m.renderCard(apps[i], colIdx, i, width-4))
	}
	if len(apps) > maxCards {
		cards = append(cards, common.MutedStyle.Render(fmt.Sprintf("  +%d more", len(apps)-maxCards)))
	}

	content := strings.Join(cards, "\n")

	// Column border
	style := lipgloss.NewStyle().
		Width(width).
		Padding(0, 1)

	if isFocused {
		style = style.
			Border(lipgloss.RoundedBorder()).
			BorderForeground(common.ColorBlue)
	} else {
		style = style.
			Border(lipgloss.RoundedBorder()).
			BorderForeground(common.ColorSurface1)
	}

	return style.Render(header + "\n" + content)
}

func (m BoardModel) renderCard(app api.Application, colIdx, rowIdx, width int) string {
	isSelected := colIdx == m.col && rowIdx == m.row

	company := app.Company
	if len(company) > width-2 {
		company = company[:width-3] + "…"
	}
	position := app.Position
	if len(position) > width-2 {
		position = position[:width-3] + "…"
	}

	content := lipgloss.NewStyle().Bold(true).Render(company) + "\n" +
		common.MutedStyle.Render(position)

	if isSelected {
		return common.FocusedCardStyle.Width(width).Render(content)
	}
	return common.CardStyle.Width(width).Render(content)
}

func (m BoardModel) fetchApps() tea.Cmd {
	return func() tea.Msg {
		apps, err := m.client.ListApplications()
		if err != nil {
			return errMsg{err}
		}
		return appsMsg{apps}
	}
}
