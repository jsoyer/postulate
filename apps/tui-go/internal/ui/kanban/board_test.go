package kanban

import (
	"errors"
	"testing"

	"github.com/jsoyer/cv-tui-go/internal/api"
)

// TestKanbanRollback verifies that a failed status update is rolled back:
// the card must be found back in its original column.
func TestKanbanRollback(t *testing.T) {
	original := api.Application{
		Name:     "test-app",
		Company:  "Acme",
		Position: "Software Engineer",
		Status:   "applied",
	}

	board := NewBoard(nil) // nil client — no real API calls in this test
	board.loading = false
	board.apps = []api.Application{original}

	// Simulate the optimistic move: card was moved to "interview" before the
	// API call failed.
	moved := original
	moved.Status = "interview"
	board.byStatus = map[string][]api.Application{
		"applied":   {},
		"interview": {moved},
		"offer":     {},
		"rejected":  {},
		"ghosted":   {},
	}
	board.col = 1 // cursor is on the interview column
	board.row = 0

	// Send the rollback message (simulates an API error response).
	errMsg := statusErrMsg{
		appName:    original.Name,
		origStatus: "applied",
		app:        original,
		err:        errors.New("connection refused"),
	}

	updated, _ := board.Update(errMsg)

	// The app must be back in "applied".
	if got := len(updated.byStatus["applied"]); got != 1 {
		t.Errorf("expected 1 app in applied after rollback, got %d", got)
	}
	if got := updated.byStatus["applied"][0].Name; got != original.Name {
		t.Errorf("expected app %q in applied, got %q", original.Name, got)
	}

	// The app must be removed from "interview".
	if got := len(updated.byStatus["interview"]); got != 0 {
		t.Errorf("expected 0 apps in interview after rollback, got %d", got)
	}

	// A non-empty error message should be displayed.
	if updated.statusMsg == "" {
		t.Error("expected a non-empty statusMsg after rollback, got empty string")
	}
}
