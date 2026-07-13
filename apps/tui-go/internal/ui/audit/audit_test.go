package audit

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// TestAuditViewportInitialized verifies that the viewport is initialized and
// resizes correctly when a WindowSizeMsg is received.
func TestAuditViewportInitialized(t *testing.T) {
	m := New(nil)

	if m.vp.Width != 80 {
		t.Errorf("expected initial viewport width 80, got %d", m.vp.Width)
	}
	if m.vp.Height != 20 {
		t.Errorf("expected initial viewport height 20, got %d", m.vp.Height)
	}

	updated, _ := m.Update(tea.WindowSizeMsg{Width: 100, Height: 50})

	if updated.vp.Width != 100 {
		t.Errorf("expected viewport width 100 after resize, got %d", updated.vp.Width)
	}
	wantHeight := 50 - 8
	if updated.vp.Height != wantHeight {
		t.Errorf("expected viewport height %d after resize, got %d", wantHeight, updated.vp.Height)
	}
}
