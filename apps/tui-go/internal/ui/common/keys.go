package common

import "github.com/charmbracelet/bubbles/key"

// KeyMap defines all keybindings for the TUI.
type KeyMap struct {
	Quit    key.Binding
	Help    key.Binding
	Tab     key.Binding
	Back    key.Binding
	Up      key.Binding
	Down    key.Binding
	Left    key.Binding
	Right   key.Binding
	Top     key.Binding
	Bottom  key.Binding
	Select  key.Binding
	Filter  key.Binding
	New     key.Binding
	Delete  key.Binding
	Run     key.Binding
	Copy    key.Binding
	Refresh key.Binding
	View1   key.Binding
	View2   key.Binding
	View3   key.Binding
	View4   key.Binding
	View5   key.Binding
	View6   key.Binding
	// Detail view quick-action bindings
	Tailor key.Binding
	Review key.Binding
	Build  key.Binding
	Score  key.Binding
	Prep   key.Binding
	Batch  key.Binding
	Notes  key.Binding
}

// Keys is the global keybinding instance.
var Keys = KeyMap{
	Quit:    key.NewBinding(key.WithKeys("q"), key.WithHelp("q", "quit")),
	Help:    key.NewBinding(key.WithKeys("?"), key.WithHelp("?", "help")),
	Tab:     key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "next view")),
	Back:    key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "back")),
	Up:      key.NewBinding(key.WithKeys("k", "up"), key.WithHelp("k/up", "up")),
	Down:    key.NewBinding(key.WithKeys("j", "down"), key.WithHelp("j/down", "down")),
	Left:    key.NewBinding(key.WithKeys("h", "left"), key.WithHelp("h/left", "left")),
	Right:   key.NewBinding(key.WithKeys("l", "right"), key.WithHelp("l/right", "right")),
	Top:     key.NewBinding(key.WithKeys("g"), key.WithHelp("g", "top")),
	Bottom:  key.NewBinding(key.WithKeys("G"), key.WithHelp("G", "bottom")),
	Select:  key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "select")),
	Filter:  key.NewBinding(key.WithKeys("/"), key.WithHelp("/", "filter")),
	New:     key.NewBinding(key.WithKeys("n"), key.WithHelp("n", "new")),
	Delete:  key.NewBinding(key.WithKeys("d"), key.WithHelp("d", "delete")),
	Run:     key.NewBinding(key.WithKeys("r"), key.WithHelp("r", "run")),
	Copy:    key.NewBinding(key.WithKeys("y"), key.WithHelp("y", "copy")),
	Refresh: key.NewBinding(key.WithKeys("R"), key.WithHelp("R", "refresh")),
	View1:   key.NewBinding(key.WithKeys("1"), key.WithHelp("1", "dashboard")),
	View2:   key.NewBinding(key.WithKeys("2"), key.WithHelp("2", "applications")),
	View3:   key.NewBinding(key.WithKeys("3"), key.WithHelp("3", "kanban")),
	View4:   key.NewBinding(key.WithKeys("4"), key.WithHelp("4", "actions")),
	View5:   key.NewBinding(key.WithKeys("5"), key.WithHelp("5", "stats")),
	View6:   key.NewBinding(key.WithKeys("6"), key.WithHelp("6", "audit")),
	Tailor:  key.NewBinding(key.WithKeys("t"), key.WithHelp("t", "tailor")),
	Review:  key.NewBinding(key.WithKeys("v"), key.WithHelp("v", "review")),
	Build:   key.NewBinding(key.WithKeys("b"), key.WithHelp("b", "build")),
	Score:   key.NewBinding(key.WithKeys("s"), key.WithHelp("s", "score/ats")),
	Prep:    key.NewBinding(key.WithKeys("p"), key.WithHelp("p", "prep interview")),
	Batch:   key.NewBinding(key.WithKeys("B"), key.WithHelp("B", "batch themes")),
	Notes:   key.NewBinding(key.WithKeys("N"), key.WithHelp("N", "notes")),
}

// ShortHelp returns keybindings for the mini help view.
func (k KeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Help, k.Quit, k.Tab}
}

// FullHelp returns keybindings for the full help view.
func (k KeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Left, k.Right},
		{k.Select, k.Back, k.Filter},
		{k.New, k.Run, k.Delete, k.Copy},
		{k.View1, k.View2, k.View3, k.View4, k.View5, k.View6},
		{k.Tailor, k.Review, k.Build, k.Score, k.Prep, k.Batch, k.Notes},
		{k.Refresh, k.Help, k.Quit},
	}
}
