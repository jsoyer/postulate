package actions

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// TestRunnerViewportScroll verifies that the viewport is initialized in the
// constructor and resized correctly when a WindowSizeMsg is received.
func TestRunnerViewportScroll(t *testing.T) {
	runner := NewRunner(nil, "")

	// Viewport should be initialized with default dimensions.
	if runner.vp.Width != 80 {
		t.Errorf("expected initial viewport width 80, got %d", runner.vp.Width)
	}
	if runner.vp.Height != 20 {
		t.Errorf("expected initial viewport height 20, got %d", runner.vp.Height)
	}

	// Simulate a terminal resize.
	updated, _ := runner.Update(tea.WindowSizeMsg{Width: 120, Height: 40})

	// Width should match terminal width.
	if updated.vp.Width != 120 {
		t.Errorf("expected viewport width 120 after resize, got %d", updated.vp.Width)
	}
	// Height should be terminal height minus header/footer overhead (8 lines).
	wantHeight := 40 - 8
	if updated.vp.Height != wantHeight {
		t.Errorf("expected viewport height %d after resize, got %d", wantHeight, updated.vp.Height)
	}
}
