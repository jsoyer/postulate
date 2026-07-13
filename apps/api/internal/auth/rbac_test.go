package auth

import (
	"net/http/httptest"
	"net/http"
	"testing"
	"time"
)

func newRBACProvider() *Provider {
	return NewProvider(
		"test-secret-that-is-at-least-32-characters-long",
		"testuser",
		"testpass",
		"",
		[]string{"editor-api-key"},
		[]string{"viewer-api-key"},
		time.Hour,
	)
}

func TestRoleFromKey_ViewerKey(t *testing.T) {
	p := newRBACProvider()
	role := p.RoleFromKey("viewer-api-key")
	if role != RoleViewer {
		t.Fatalf("expected viewer, got %q", role)
	}
}

func TestRoleFromKey_EditorKey(t *testing.T) {
	p := newRBACProvider()
	role := p.RoleFromKey("editor-api-key")
	if role != RoleEditor {
		t.Fatalf("expected editor, got %q", role)
	}
}

func TestRoleFromKey_UnknownKey(t *testing.T) {
	p := newRBACProvider()
	role := p.RoleFromKey("unknown-key")
	if role != "" {
		t.Fatalf("expected empty role for unknown key, got %q", role)
	}
}

func TestAuthenticate_ReturnsRole(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		wantRole Role
	}{
		{name: "viewer key", key: "viewer-api-key", wantRole: RoleViewer},
		{name: "editor key", key: "editor-api-key", wantRole: RoleEditor},
	}

	p := newRBACProvider()
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.Header.Set("X-API-Key", tc.key)

			_, _, role, err := p.Authenticate(r)
			if err != nil {
				t.Fatalf("authenticate: %v", err)
			}
			if role != tc.wantRole {
				t.Fatalf("expected role %q, got %q", tc.wantRole, role)
			}
		})
	}
}

func TestValidateJWT_ContainsRole(t *testing.T) {
	p := newRBACProvider()

	tests := []struct {
		name string
		role Role
	}{
		{name: "admin role", role: RoleAdmin},
		{name: "editor role", role: RoleEditor},
		{name: "viewer role", role: RoleViewer},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			token, _, err := p.IssueJWT("testuser", tc.role, "", "")
			if err != nil {
				t.Fatalf("issue JWT: %v", err)
			}

			subject, _, role, err := p.ValidateJWT(token)
			if err != nil {
				t.Fatalf("validate JWT: %v", err)
			}
			if subject != "testuser" {
				t.Fatalf("expected subject testuser, got %q", subject)
			}
			if role != tc.role {
				t.Fatalf("expected role %q, got %q", tc.role, role)
			}
		})
	}
}

func TestHasMinimumRole(t *testing.T) {
	tests := []struct {
		name    string
		role    Role
		minimum Role
		want    bool
	}{
		{name: "admin meets admin", role: RoleAdmin, minimum: RoleAdmin, want: true},
		{name: "admin meets editor", role: RoleAdmin, minimum: RoleEditor, want: true},
		{name: "admin meets viewer", role: RoleAdmin, minimum: RoleViewer, want: true},
		{name: "editor meets editor", role: RoleEditor, minimum: RoleEditor, want: true},
		{name: "editor meets viewer", role: RoleEditor, minimum: RoleViewer, want: true},
		{name: "editor blocked from admin", role: RoleEditor, minimum: RoleAdmin, want: false},
		{name: "viewer meets viewer", role: RoleViewer, minimum: RoleViewer, want: true},
		{name: "viewer blocked from editor", role: RoleViewer, minimum: RoleEditor, want: false},
		{name: "viewer blocked from admin", role: RoleViewer, minimum: RoleAdmin, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := HasMinimumRole(tc.role, tc.minimum)
			if got != tc.want {
				t.Fatalf("HasMinimumRole(%q, %q) = %v, want %v", tc.role, tc.minimum, got, tc.want)
			}
		})
	}
}
