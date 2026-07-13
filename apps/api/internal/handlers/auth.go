package handlers

import (
	"net/http"
	"time"

	"github.com/jsoyer/cv-api/internal/audit"
	"github.com/jsoyer/cv-api/internal/auth"
	"github.com/jsoyer/cv-api/internal/middleware"
	"github.com/jsoyer/cv-api/internal/models"
)

// AuthHandler handles login and logout endpoints.
type AuthHandler struct {
	provider     *auth.Provider
	cookieDomain string
	cookieSecure bool
	audit        *audit.Logger
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(provider *auth.Provider, domain string, secure bool, auditLog *audit.Logger) *AuthHandler {
	return &AuthHandler{
		provider:     provider,
		cookieDomain: domain,
		cookieSecure: secure,
		audit:        auditLog,
	}
}

// Login validates credentials and issues a JWT session cookie.
// POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.Username == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Username and password are required")
		return
	}

	if err := h.provider.ValidateLogin(req.Username, req.Password, req.TOTP); err != nil {
		if h.audit != nil {
			h.audit.Log(r.Context(), audit.Entry{
				Action: "login",
				User:   req.Username,
				IP:     audit.IPFromRequest(r),
				Result: "denied",
				Detail: "invalid credentials",
			})
		}
		respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	token, exp, err := h.provider.IssueJWT(req.Username, auth.RoleAdmin, r.Header.Get("User-Agent"), audit.IPFromRequest(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     h.provider.CookieName(),
		Value:    token,
		Path:     "/",
		Domain:   h.cookieDomain,
		Expires:  exp,
		MaxAge:   int(time.Until(exp).Seconds()),
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action: "login",
			User:   req.Username,
			IP:     audit.IPFromRequest(r),
			Result: "ok",
		})
	}

	respondJSON(w, http.StatusOK, models.LoginResponse{
		Token:     token,
		ExpiresAt: exp.Unix(),
	})
}

// Logout clears the session cookie.
// POST /api/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     h.provider.CookieName(),
		Value:    "",
		Path:     "/",
		Domain:   h.cookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})

	if h.audit != nil {
		h.audit.Log(r.Context(), audit.Entry{
			Action: "logout",
			User:   middleware.UserFromContext(r.Context()),
			IP:     audit.IPFromRequest(r),
			Result: "ok",
		})
	}

	w.WriteHeader(http.StatusNoContent)
}
