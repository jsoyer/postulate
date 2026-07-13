package ui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/ui/actions"
	"github.com/jsoyer/cv-tui-go/internal/ui/apps"
	"github.com/jsoyer/cv-tui-go/internal/ui/audit"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
	"github.com/jsoyer/cv-tui-go/internal/ui/dashboard"
	"github.com/jsoyer/cv-tui-go/internal/ui/forms"
	"github.com/jsoyer/cv-tui-go/internal/ui/kanban"
	"github.com/jsoyer/cv-tui-go/internal/ui/settings"
	"github.com/jsoyer/cv-tui-go/internal/ui/stats"
)

// View represents the current active view.
type View int

const (
	ViewDashboard View = iota
	ViewApplications
	ViewApplicationDetail
	ViewKanban
	ViewActions
	ViewStats
	ViewAudit
	ViewSettings
)

var tabNames = []string{"Dashboard", "Applications", "Kanban", "Actions", "Stats", "Audit"}

// App is the root Bubbletea model.
type App struct {
	client *api.Client

	currentView View
	prevView    View
	width       int
	height      int

	dashboard     dashboard.Model
	appList       apps.ListModel
	appDetail     apps.DetailModel
	kanban        kanban.BoardModel
	runner        actions.RunnerModel
	stats         stats.Model
	auditModel    audit.Model
	settingsModel settings.Model

	// Modal state for new-app form overlay.
	modalActive bool
	newAppForm  forms.NewAppForm

	initialized map[View]bool
}

// New creates a new App model.
func New(client *api.Client) App {
	return App{
		client:        client,
		currentView:   ViewDashboard,
		dashboard:     dashboard.New(client),
		appList:       apps.NewList(client),
		kanban:        kanban.NewBoard(client),
		runner:        actions.NewRunner(client, ""),
		stats:         stats.New(client),
		auditModel:    audit.New(client),
		settingsModel: settings.New(client),
		initialized:   make(map[View]bool),
	}
}

// Init initializes the first view.
func (a App) Init() tea.Cmd {
	a.initialized[ViewDashboard] = true
	return a.dashboard.Init()
}

// Update handles messages for the root model.
func (a App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	// Handle modal overlay first — it captures all input.
	if a.modalActive {
		return a.updateModal(msg)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height

	case tea.KeyMsg:
		switch a.currentView {
		case ViewApplicationDetail:
			// In detail view, q goes back instead of quitting.
			if key.Matches(msg, common.Keys.Quit) || key.Matches(msg, common.Keys.Back) {
				a.currentView = ViewApplications
				return a, nil
			}

		case ViewSettings:
			// In settings view, q/Esc returns to the previous view.
			if key.Matches(msg, common.Keys.Quit) || key.Matches(msg, common.Keys.Back) {
				a.currentView = a.prevView
				return a, nil
			}

		default:
			// Global navigation keys for all other views.
			switch {
			case key.Matches(msg, common.Keys.Quit):
				return a, tea.Quit
			case key.Matches(msg, common.Keys.View1):
				return a, a.switchView(ViewDashboard)
			case key.Matches(msg, common.Keys.View2):
				return a, a.switchView(ViewApplications)
			case key.Matches(msg, common.Keys.View3):
				return a, a.switchView(ViewKanban)
			case key.Matches(msg, common.Keys.View4):
				return a, a.switchView(ViewActions)
			case key.Matches(msg, common.Keys.View5):
				return a, a.switchView(ViewStats)
			case key.Matches(msg, common.Keys.View6):
				return a, a.switchView(ViewAudit)
			case key.Matches(msg, common.Keys.Tab):
				return a, a.nextTab()
			case msg.String() == "s":
				return a, a.switchView(ViewSettings)
			case key.Matches(msg, common.Keys.New) && a.currentView == ViewApplications:
				a.newAppForm = forms.NewNewAppForm(a.width, a.height)
				a.modalActive = true
				return a, a.newAppForm.Init()
			}
		}

	// Navigation messages from sub-views.
	case apps.SelectedMsg:
		a.appDetail = apps.NewDetail(a.client, msg.App.Name)
		a.prevView = a.currentView
		a.currentView = ViewApplicationDetail
		return a, a.appDetail.Init()

	case apps.RunActionMsg:
		a.runner = actions.NewRunner(a.client, msg.AppName)
		a.currentView = ViewActions
		a.initialized[ViewActions] = true
		return a, a.runner.Init()

	case apps.QuickActionMsg:
		runner := actions.NewRunnerWithTarget(a.client, msg.AppName, msg.Target)
		if msg.Theme != "" {
			runner.PreArgs = map[string]string{"THEME": msg.Theme}
		}
		a.runner = runner
		a.currentView = ViewActions
		a.initialized[ViewActions] = true
		return a, a.runner.Init()

	case refreshAppsMsg:
		a.appList = apps.NewList(a.client)
		a.currentView = ViewApplications
		a.initialized[ViewApplications] = true
		return a, a.appList.Init()

	// New-app form messages (forwarded from modal handler, but handle here too).
	case forms.NewAppSubmittedMsg:
		return a.handleNewAppSubmit(msg)

	case forms.NewAppCancelledMsg:
		a.modalActive = false
		return a, nil
	}

	// Delegate to the active view.
	var cmd tea.Cmd
	switch a.currentView {
	case ViewDashboard:
		a.dashboard, cmd = a.dashboard.Update(msg)
	case ViewApplications:
		a.appList, cmd = a.appList.Update(msg)
	case ViewApplicationDetail:
		a.appDetail, cmd = a.appDetail.Update(msg)
	case ViewKanban:
		a.kanban, cmd = a.kanban.Update(msg)
	case ViewActions:
		a.runner, cmd = a.runner.Update(msg)
	case ViewStats:
		a.stats, cmd = a.stats.Update(msg)
	case ViewAudit:
		a.auditModel, cmd = a.auditModel.Update(msg)
	case ViewSettings:
		a.settingsModel, cmd = a.settingsModel.Update(msg)
	}

	return a, cmd
}

func (a App) updateModal(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.newAppForm = a.newAppForm.SetSize(msg.Width, msg.Height)
		return a, nil

	case forms.NewAppSubmittedMsg:
		return a.handleNewAppSubmit(msg)

	case forms.NewAppCancelledMsg:
		a.modalActive = false
		return a, nil

	case newAppErrMsg:
		// API call failed — keep modal open and show the error.
		a.newAppForm = a.newAppForm.SetErr(msg.err)
		return a, nil

	case refreshAppsMsg:
		// API call succeeded — close modal and refresh the list.
		a.modalActive = false
		a.appList = apps.NewList(a.client)
		a.currentView = ViewApplications
		a.initialized[ViewApplications] = true
		return a, a.appList.Init()
	}

	var cmd tea.Cmd
	a.newAppForm, cmd = a.newAppForm.Update(msg)
	return a, cmd
}

// newAppErrMsg is returned when CreateApplication fails; the modal stays open.
type newAppErrMsg struct{ err string }

func (a App) handleNewAppSubmit(msg forms.NewAppSubmittedMsg) (tea.Model, tea.Cmd) {
	// Keep modal open while the API call is in flight.
	client := a.client
	return a, func() tea.Msg {
		_, err := client.CreateApplication(msg.Company, msg.Position, msg.URL)
		if err != nil {
			return newAppErrMsg{err: err.Error()}
		}
		return refreshAppsMsg{}
	}
}

// refreshAppsMsg triggers an apps list refresh and closes the modal.
type refreshAppsMsg struct{}

// View renders the app.
func (a App) View() string {
	// Full-screen modal overlay.
	if a.modalActive {
		return a.newAppForm.View()
	}

	// Tab bar.
	tabs := a.renderTabs()

	// Content.
	var content string
	switch a.currentView {
	case ViewDashboard:
		content = a.dashboard.View()
	case ViewApplications:
		content = a.appList.View()
	case ViewApplicationDetail:
		content = a.appDetail.View()
	case ViewKanban:
		content = a.kanban.View()
	case ViewActions:
		content = a.runner.View()
	case ViewStats:
		content = a.stats.View()
	case ViewAudit:
		content = a.auditModel.View()
	case ViewSettings:
		content = a.settingsModel.View()
	}

	// Status bar.
	statusBar := a.renderStatusBar()

	return tabs + "\n" + content + "\n\n" + statusBar
}

func (a App) renderTabs() string {
	viewToTab := map[View]int{
		ViewDashboard:         0,
		ViewApplications:      1,
		ViewApplicationDetail: 1,
		ViewKanban:            2,
		ViewActions:           3,
		ViewStats:             4,
		ViewAudit:             5,
	}

	activeTab := viewToTab[a.currentView]

	var rendered []string
	for i, name := range tabNames {
		label := fmt.Sprintf(" %d %s ", i+1, name)
		if i == activeTab {
			rendered = append(rendered, common.ActiveTabStyle.Render(label))
		} else {
			rendered = append(rendered, common.TabStyle.Render(label))
		}
	}

	return lipgloss.JoinHorizontal(lipgloss.Bottom, rendered...)
}

func (a App) renderStatusBar() string {
	left := common.MutedStyle.Render("  q quit  tab next  1-6 views  ? help")
	right := common.MutedStyle.Render(a.client.BaseURL() + "  ")

	gap := a.width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 0 {
		gap = 0
	}

	return common.StatusBarStyle.Width(a.width).Render(
		left + lipgloss.NewStyle().Width(gap).Render("") + right,
	)
}

func (a *App) switchView(v View) tea.Cmd {
	if v == a.currentView {
		return nil
	}

	a.prevView = a.currentView
	a.currentView = v

	if !a.initialized[v] {
		a.initialized[v] = true
		switch v {
		case ViewDashboard:
			return a.dashboard.Init()
		case ViewApplications:
			return a.appList.Init()
		case ViewKanban:
			return a.kanban.Init()
		case ViewActions:
			return a.runner.Init()
		case ViewStats:
			return a.stats.Init()
		case ViewAudit:
			return a.auditModel.Init()
		case ViewSettings:
			return a.settingsModel.Init()
		}
	}
	return nil
}

func (a *App) nextTab() tea.Cmd {
	order := []View{ViewDashboard, ViewApplications, ViewKanban, ViewActions, ViewStats, ViewAudit}
	for i, v := range order {
		if v == a.currentView {
			next := order[(i+1)%len(order)]
			return a.switchView(next)
		}
	}
	return a.switchView(ViewDashboard)
}
