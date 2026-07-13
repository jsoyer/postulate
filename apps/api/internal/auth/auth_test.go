package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newTestProvider() *Provider {
	return NewProvider(
		"test-secret-that-is-at-least-32-characters-long",
		"testuser",
		"testpass",
		"",
		[]string{"valid-api-key-1", "valid-api-key-2"},
		nil,
		time.Hour,
	)
}

func TestValidateLogin_Success(t *testing.T) {
	p := newTestProvider()
	if err := p.ValidateLogin("testuser", "testpass", ""); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateLogin_WrongPassword(t *testing.T) {
	p := newTestProvider()
	if err := p.ValidateLogin("testuser", "wrong", ""); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestValidateLogin_WrongUsername(t *testing.T) {
	p := newTestProvider()
	if err := p.ValidateLogin("wrong", "testpass", ""); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestJWT_IssueAndValidate(t *testing.T) {
	p := newTestProvider()
	token, _, err := p.IssueJWT("testuser", RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	subject, _, role, err := p.ValidateJWT(token)
	if err != nil {
		t.Fatalf("validate: %v", err)
	}
	if subject != "testuser" {
		t.Fatalf("expected testuser, got %s", subject)
	}
	if role != RoleAdmin {
		t.Fatalf("expected admin role, got %s", role)
	}
}

func TestJWT_InvalidToken(t *testing.T) {
	p := newTestProvider()
	_, _, _, err := p.ValidateJWT("garbage.token.here")
	if err != ErrInvalidToken {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

func TestJWT_ExpiredToken(t *testing.T) {
	p := NewProvider(
		"test-secret-that-is-at-least-32-characters-long",
		"testuser", "testpass", "", nil, nil,
		-1*time.Hour,
	)
	token, _, err := p.IssueJWT("testuser", RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	_, _, _, err = p.ValidateJWT(token)
	if err != ErrExpiredToken {
		t.Fatalf("expected ErrExpiredToken, got %v", err)
	}
}

func TestJWT_RejectsNoneAlgorithm(t *testing.T) {
	p := newTestProvider()
	_, _, _, err := p.ValidateJWT("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJoYWNrZXIifQ.")
	if err == nil {
		t.Fatal("expected error for none algorithm, got nil")
	}
}

func TestValidateAPIKey_Valid(t *testing.T) {
	p := newTestProvider()
	if _, err := p.ValidateAPIKey("valid-api-key-1"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if _, err := p.ValidateAPIKey("valid-api-key-2"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateAPIKey_Invalid(t *testing.T) {
	p := newTestProvider()
	if _, err := p.ValidateAPIKey("invalid-key"); err != ErrInvalidAPIKey {
		t.Fatalf("expected ErrInvalidAPIKey, got %v", err)
	}
}

func TestValidateAPIKey_NoKeys(t *testing.T) {
	p := NewProvider(strings.Repeat("x", 32), "u", "p", "", nil, nil, time.Hour)
	if _, err := p.ValidateAPIKey("any-key"); err != ErrInvalidAPIKey {
		t.Fatalf("expected ErrInvalidAPIKey, got %v", err)
	}
}

func TestExtractCredentials_APIKey(t *testing.T) {
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-API-Key", "my-key")

	kind, cred := p.ExtractCredentials(r)
	if kind != AuthKindAPIKey || cred != "my-key" {
		t.Fatalf("expected apikey/my-key, got %s/%s", kind, cred)
	}
}

func TestExtractCredentials_Bearer(t *testing.T) {
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer my-jwt")

	kind, cred := p.ExtractCredentials(r)
	if kind != AuthKindJWT || cred != "my-jwt" {
		t.Fatalf("expected jwt/my-jwt, got %s/%s", kind, cred)
	}
}

func TestExtractCredentials_Cookie(t *testing.T) {
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(&http.Cookie{Name: p.CookieName(), Value: "cookie-jwt"})

	kind, cred := p.ExtractCredentials(r)
	if kind != AuthKindJWT || cred != "cookie-jwt" {
		t.Fatalf("expected jwt/cookie-jwt, got %s/%s", kind, cred)
	}
}

// Security regression (commit 5aa4f0d): JWT tokens MUST NOT be accepted from the
// URL query string — they leak into access logs, proxies, referrers and browser
// history. WebSocket clients must authenticate via the JWT cookie or the
// Authorization header instead.
func TestExtractCredentials_QueryTokenRejected(t *testing.T) {
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/?token=ws-token", nil)

	kind, cred := p.ExtractCredentials(r)
	if kind != AuthKindNone || cred != "" {
		t.Fatalf("expected query token to be rejected (none/\"\"), got %s/%s", kind, cred)
	}
}

func TestExtractCredentials_None(t *testing.T) {
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/", nil)

	kind, _ := p.ExtractCredentials(r)
	if kind != AuthKindNone {
		t.Fatalf("expected none, got %s", kind)
	}
}

func TestExtractCredentials_Priority(t *testing.T) {
	// X-API-Key takes priority over Bearer and cookie
	p := newTestProvider()
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("X-API-Key", "apikey")
	r.Header.Set("Authorization", "Bearer jwt")
	r.AddCookie(&http.Cookie{Name: p.CookieName(), Value: "cookie"})

	kind, cred := p.ExtractCredentials(r)
	if kind != AuthKindAPIKey || cred != "apikey" {
		t.Fatalf("expected apikey/apikey, got %s/%s", kind, cred)
	}
}
