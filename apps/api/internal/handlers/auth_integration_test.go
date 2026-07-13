package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/models"
)

// TestLoginLogoutFlow verifies the full login → authenticated access → logout cycle.
func TestLoginLogoutFlow(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	// Step 1: login with valid credentials.
	loginBody := `{"username":"testuser","password":"testpass"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	(*handler).ServeHTTP(loginW, loginReq)

	if loginW.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", loginW.Code, loginW.Body.String())
	}

	var loginResp models.LoginResponse
	if err := json.NewDecoder(loginW.Body).Decode(&loginResp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if loginResp.Token == "" {
		t.Fatal("expected non-empty token in login response")
	}

	cookies := loginW.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "cv_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected cv_session cookie to be set after login")
	}

	// Step 2: use the cookie to access a protected endpoint.
	authedReq := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	authedReq.AddCookie(sessionCookie)
	authedW := httptest.NewRecorder()
	(*handler).ServeHTTP(authedW, authedReq)

	if authedW.Code != http.StatusOK {
		t.Fatalf("authenticated request: expected 200, got %d", authedW.Code)
	}

	// Step 3: logout.
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	logoutW := httptest.NewRecorder()
	(*handler).ServeHTTP(logoutW, logoutReq)

	if logoutW.Code != http.StatusOK && logoutW.Code != http.StatusNoContent {
		t.Fatalf("logout: expected 200 or 204, got %d: %s", logoutW.Code, logoutW.Body.String())
	}

	// Step 4: after logout the server clears the cookie; a raw JWT that is still
	// valid should still work (JWTs are stateless), but a missing or empty cookie
	// with no other credentials must be rejected.
	noCredReq := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	noCredW := httptest.NewRecorder()
	(*handler).ServeHTTP(noCredW, noCredReq)

	if noCredW.Code != http.StatusUnauthorized {
		t.Fatalf("post-logout unauthenticated request: expected 401, got %d", noCredW.Code)
	}
}

// TestLoginRateLimit verifies that repeated failed login attempts trigger 429.
func TestLoginRateLimit(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	wrongBody := `{"username":"testuser","password":"wrongpassword"}`

	var lastCode int
	for i := range 7 {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(wrongBody))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "10.0.0.1:12345"
		w := httptest.NewRecorder()
		(*handler).ServeHTTP(w, req)
		lastCode = w.Code
		if w.Code == http.StatusTooManyRequests {
			t.Logf("rate limited at attempt %d", i+1)
			return
		}
	}
	if lastCode != http.StatusTooManyRequests {
		t.Fatalf("expected 429 after repeated failures, last code was %d", lastCode)
	}
}

// TestAPIKeyAuth_ValidKey verifies that a valid X-API-Key header grants access.
func TestAPIKeyAuth_ValidKey(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	req.Header.Set("X-API-Key", "test-api-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("valid API key: expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// TestAPIKeyAuth_InvalidKey verifies that a wrong X-API-Key is rejected.
func TestAPIKeyAuth_InvalidKey(t *testing.T) {
	handler, _, _ := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/applications", nil)
	req.Header.Set("X-API-Key", "not-a-valid-key")
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("invalid API key: expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestJWTAuth_ValidTokenAccessesProtectedRoute verifies a valid Bearer JWT works.
func TestJWTAuth_ValidTokenAccessesProtectedRoute(t *testing.T) {
	handler, provider, _ := setupTestRouter(t)

	token, _, err := provider.IssueJWT("testuser", auth.RoleAdmin, "", "")
	if err != nil {
		t.Fatalf("issue JWT: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	(*handler).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("valid JWT: expected 200, got %d: %s", w.Code, w.Body.String())
	}
}
