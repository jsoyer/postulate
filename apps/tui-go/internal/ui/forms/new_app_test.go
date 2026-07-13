package forms_test

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/jsoyer/cv-tui-go/internal/ui/forms"
)

// collectMsgs executes a command and returns resulting messages (nil-safe).
func collectMsgs(cmd tea.Cmd) []tea.Msg {
	if cmd == nil {
		return nil
	}
	msg := cmd()
	if msg == nil {
		return nil
	}
	return []tea.Msg{msg}
}

// typeText types a string character-by-character into the form.
func typeText(m forms.NewAppForm, text string) forms.NewAppForm {
	for _, r := range text {
		m, _ = m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{r}})
	}
	return m
}

func TestNewAppFormValidationEmptyCompany(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(0, 0)

	// Press Enter without filling in company.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	msgs := collectMsgs(cmd)

	for _, msg := range msgs {
		if _, ok := msg.(forms.NewAppSubmittedMsg); ok {
			t.Error("should not emit NewAppSubmittedMsg when company is empty")
		}
	}
}

func TestNewAppFormSubmit(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(0, 0)

	// Type company name.
	m = typeText(m, "Acme")

	// Tab to position field.
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})

	// Type position.
	m = typeText(m, "SRE")

	// Tab to URL field (leave it empty).
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})

	// Submit with Enter on URL field.
	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEnter})
	msgs := collectMsgs(cmd)

	var found bool
	for _, msg := range msgs {
		if sub, ok := msg.(forms.NewAppSubmittedMsg); ok {
			found = true
			if sub.Company != "Acme" {
				t.Errorf("expected company 'Acme', got %q", sub.Company)
			}
			if sub.Position != "SRE" {
				t.Errorf("expected position 'SRE', got %q", sub.Position)
			}
			if sub.URL != "" {
				t.Errorf("expected empty URL, got %q", sub.URL)
			}
		}
	}
	if !found {
		t.Error("expected NewAppSubmittedMsg to be emitted")
	}
}

func TestNewAppFormCancel(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(0, 0)

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyEsc})
	msgs := collectMsgs(cmd)

	var found bool
	for _, msg := range msgs {
		if _, ok := msg.(forms.NewAppCancelledMsg); ok {
			found = true
		}
	}
	if !found {
		t.Error("expected NewAppCancelledMsg when Esc is pressed")
	}
}

func TestNewAppFormTabCycles(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(0, 0)

	// Initial focus should be on company (field 0).
	if m.FocusedField() != 0 {
		t.Fatalf("expected initial focus on field 0, got %d", m.FocusedField())
	}

	// Tab → position (field 1).
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	if m.FocusedField() != 1 {
		t.Errorf("after 1 Tab: expected field 1, got %d", m.FocusedField())
	}

	// Tab → url (field 2).
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	if m.FocusedField() != 2 {
		t.Errorf("after 2 Tabs: expected field 2, got %d", m.FocusedField())
	}

	// Tab → wraps back to company (field 0).
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyTab})
	if m.FocusedField() != 0 {
		t.Errorf("after 3 Tabs: expected field 0 (wrap), got %d", m.FocusedField())
	}
}

func TestNewAppFormShiftTabCyclesBackward(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(0, 0)

	// Shift-Tab from field 0 → wraps to last field (2).
	m, _ = m.Update(tea.KeyMsg{Type: tea.KeyShiftTab})
	if m.FocusedField() != 2 {
		t.Errorf("ShiftTab from field 0: expected field 2, got %d", m.FocusedField())
	}
}

func TestNewAppFormView(t *testing.T) {
	t.Parallel()

	m := forms.NewNewAppForm(80, 24)
	view := m.View()
	if view == "" {
		t.Error("View() should not return empty string")
	}
}
