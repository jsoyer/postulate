package forms

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/jsoyer/cv-tui-go/internal/ui/common"
)

// NotesSavedMsg is sent when notes are saved successfully.
type NotesSavedMsg struct{ AppName string }

// NotesCancelledMsg is sent when the notes form is dismissed without saving.
type NotesCancelledMsg struct{}

// NotesForm is a textarea overlay for per-application markdown notes.
type NotesForm struct {
	appName  string
	textarea textarea.Model
	modified bool
	width    int
	height   int
	err      string
}

// notesDir returns the directory where notes are stored.
func notesDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}
	return filepath.Join(home, ".local", "share", "cv-tui"), nil
}

// notesPath returns the file path for a given app's notes.
func notesPath(appName string) (string, error) {
	dir, err := notesDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, appName+".md"), nil
}

// NewNotesForm creates a NotesForm and loads existing notes from disk.
// Returns an error if the notes directory cannot be read, but missing files are ok.
func NewNotesForm(appName string, width, height int) (NotesForm, error) {
	ta := textarea.New()
	ta.Placeholder = "Write notes in markdown..."
	ta.ShowLineNumbers = false
	ta.SetWidth(width - 8) // leave room for border + padding
	ta.SetHeight(height - 10)
	ta.Focus()

	path, err := notesPath(appName)
	if err != nil {
		return NotesForm{}, err
	}

	if data, err := os.ReadFile(path); err == nil {
		ta.SetValue(string(data))
	}
	// Move cursor to end.
	ta.CursorEnd()

	return NotesForm{
		appName:  appName,
		textarea: ta,
		width:    width,
		height:   height,
	}, nil
}

// SetSize updates the form dimensions.
func (m NotesForm) SetSize(width, height int) NotesForm {
	m.width = width
	m.height = height
	m.textarea.SetWidth(width - 8)
	m.textarea.SetHeight(height - 10)
	return m
}

// Init returns the blink command.
func (m NotesForm) Init() tea.Cmd {
	return textarea.Blink
}

// Update handles keypresses.
func (m NotesForm) Update(msg tea.Msg) (NotesForm, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			return m, func() tea.Msg { return NotesCancelledMsg{} }
		case "ctrl+s":
			return m.save()
		}
	}

	var cmd tea.Cmd
	m.textarea, cmd = m.textarea.Update(msg)
	m.modified = true
	return m, cmd
}

func (m NotesForm) save() (NotesForm, tea.Cmd) {
	dir, err := notesDir()
	if err != nil {
		m.err = "Cannot determine notes directory: " + err.Error()
		return m, nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		m.err = "Cannot create notes directory: " + err.Error()
		return m, nil
	}

	path, err := notesPath(m.appName)
	if err != nil {
		m.err = err.Error()
		return m, nil
	}

	content := m.textarea.Value()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		m.err = "Save failed: " + err.Error()
		return m, nil
	}

	m.modified = false
	m.err = ""
	appName := m.appName
	return m, func() tea.Msg { return NotesSavedMsg{AppName: appName} }
}

// View renders the notes form as a centered overlay.
func (m NotesForm) View() string {
	var header string
	if m.modified {
		header = common.TitleStyle.Render("Notes: "+m.appName) + common.WarningStyle.Render(" (modified)")
	} else {
		header = common.TitleStyle.Render("Notes: " + m.appName)
	}

	rows := []string{
		header,
		"",
		m.textarea.View(),
		"",
	}

	if m.err != "" {
		rows = append(rows, common.ErrorStyle.Render(m.err))
	}

	rows = append(rows, common.HelpStyle.Render("ctrl+s save  esc cancel"))

	content := strings.Join(rows, "\n")

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(common.ColorTeal).
		Padding(1, 2).
		Width(m.width - 4).
		Height(m.height - 4).
		Render(content)

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, box)
}
