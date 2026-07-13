package dashboard

import (
	"strings"
	"testing"
)

// TestDashboardHelpTextIncludesSettings verifies the dashboard help text mentions the 's' key.
func TestDashboardHelpTextIncludesSettings(t *testing.T) {
	m := New(nil)
	m.loading = false
	view := m.View()
	if !strings.Contains(view, "settings") {
		t.Error("expected dashboard help text to include 'settings' shortcut, got: " + view)
	}
}
