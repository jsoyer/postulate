package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jsoyer/cv-api/internal/auth"
)

// okHandler is a trivial handler that writes 200 OK.
var okHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
})

// requestWithRole returns a request whose context contains the given role.
func requestWithRole(role auth.Role) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := WithRole(r.Context(), role)
	return r.WithContext(ctx)
}

func TestRequireRole_AdminCanAccessAdmin(t *testing.T) {
	handler := RequireRole(auth.RoleAdmin)(okHandler)

	r := requestWithRole(auth.RoleAdmin)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRequireRole_EditorBlockedFromAdmin(t *testing.T) {
	handler := RequireRole(auth.RoleAdmin)(okHandler)

	r := requestWithRole(auth.RoleEditor)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestRequireRole_ViewerBlockedFromEditor(t *testing.T) {
	handler := RequireRole(auth.RoleEditor)(okHandler)

	r := requestWithRole(auth.RoleViewer)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestRequireRole_ViewerCanAccessViewer(t *testing.T) {
	handler := RequireRole(auth.RoleViewer)(okHandler)

	r := requestWithRole(auth.RoleViewer)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRequireRole_EditorCanAccessEditor(t *testing.T) {
	handler := RequireRole(auth.RoleEditor)(okHandler)

	r := requestWithRole(auth.RoleEditor)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRequireRole_AdminCanAccessEditor(t *testing.T) {
	handler := RequireRole(auth.RoleEditor)(okHandler)

	r := requestWithRole(auth.RoleAdmin)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestRoleFromContext_RoundTrip(t *testing.T) {
	tests := []struct {
		name string
		role auth.Role
	}{
		{name: "admin", role: auth.RoleAdmin},
		{name: "editor", role: auth.RoleEditor},
		{name: "viewer", role: auth.RoleViewer},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			ctx := WithRole(r.Context(), tc.role)
			got := RoleFromContext(ctx)
			if got != tc.role {
				t.Fatalf("expected %q, got %q", tc.role, got)
			}
		})
	}
}

func TestRoleFromContext_EmptyContext(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	role := RoleFromContext(r.Context())
	if role != "" {
		t.Fatalf("expected empty role from empty context, got %q", role)
	}
}
