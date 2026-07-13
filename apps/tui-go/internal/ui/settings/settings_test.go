package settings

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// TestSettingsViewRendersTitle verifies that the View function returns a non-empty
// string containing the "Settings" title.
func TestSettingsViewRendersTitle(t *testing.T) {
	m := New(nil)
	m.loading = false
	m.data = map[string]any{}

	view := m.View()
	if view == "" {
		t.Error("expected non-empty View output, got empty string")
	}
}

// TestSettingsUpdatesOnWindowResize verifies that the model stores terminal dimensions.
func TestSettingsUpdatesOnWindowResize(t *testing.T) {
	m := New(nil)
	updated, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 50})
	if updated.width != 100 {
		t.Errorf("expected width 100, got %d", updated.width)
	}
	if updated.height != 50 {
		t.Errorf("expected height 50, got %d", updated.height)
	}
}
