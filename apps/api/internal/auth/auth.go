// Package auth implements JWT session management, API key validation,
// and optional TOTP verification.
//
// Security properties:
//   - JWT: HS256, httpOnly cookie, configurable expiry
//   - API keys: constant-time comparison to prevent timing attacks
//   - TOTP: time-based OTP with +-1 step tolerance
//   - Password: constant-time comparison
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidTOTP        = errors.New("invalid TOTP code")
	ErrExpiredToken       = errors.New("token expired")
	ErrInvalidToken       = errors.New("invalid token")
	ErrInvalidAPIKey      = errors.New("invalid API key")
	ErrNoCredentials      = errors.New("no credentials provided")
)

// Role represents an authorization level for authenticated subjects.
type Role string

const (
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

// roleRank maps each role to a numeric rank for ordered comparison.
// Higher rank means more permissions.
var roleRank = map[Role]int{
	RoleViewer: 1,
	RoleEditor: 2,
	RoleAdmin:  3,
}

// HasMinimumRole reports whether r meets or exceeds the minimum required role.
func HasMinimumRole(r, minimum Role) bool {
	return roleRank[r] >= roleRank[minimum]
}

// Claims embeds standard JWT claims with a role field.
type Claims struct {
	jwt.RegisteredClaims
	Role Role `json:"role"`
}

// generateJTI generates a random hex-encoded 16-byte token ID.
func generateJTI() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback: use time-based value when crypto/rand fails (very unlikely).
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// Provider handles all authentication operations.
type Provider struct {
	secret     []byte
	username   string
	password   string
	totpSecret string
	mu         sync.RWMutex
	apiKeys    []apiKeyEntry
	viewerKeys []apiKeyEntry
	expiry     time.Duration
	cookieName string
	Sessions   *SessionStore
}

type apiKeyEntry struct {
	key     string
	addedAt time.Time
}

// NewProvider creates an auth provider with the given configuration.
// Keys present in viewerKeys are granted RoleViewer; all other keys in
// apiKeys are granted RoleEditor.
func NewProvider(secret, username, password, totpSecret string, apiKeys []string, viewerKeys []string, expiry time.Duration) *Provider {
	p := &Provider{
		secret:     []byte(secret),
		username:   username,
		password:   password,
		totpSecret: totpSecret,
		expiry:     expiry,
		cookieName: "cv_session",
		Sessions:   NewSessionStore(),
	}
	now := time.Now()
	for _, k := range apiKeys {
		p.apiKeys = append(p.apiKeys, apiKeyEntry{key: k, addedAt: now})
	}
	for _, k := range viewerKeys {
		p.viewerKeys = append(p.viewerKeys, apiKeyEntry{key: k, addedAt: now})
	}
	return p
}

// CookieName returns the session cookie name.
func (p *Provider) CookieName() string {
	return p.cookieName
}

// ValidateLogin checks username/password and optional TOTP.
// Uses constant-time comparison to prevent timing side-channels.
func (p *Provider) ValidateLogin(username, password, totpCode string) error {
	userOK := subtle.ConstantTimeCompare([]byte(username), []byte(p.username)) == 1
	passOK := subtle.ConstantTimeCompare([]byte(password), []byte(p.password)) == 1
	if !userOK || !passOK {
		return ErrInvalidCredentials
	}

	if p.totpSecret != "" {
		if totpCode == "" {
			return ErrInvalidTOTP
		}
		if !totp.Validate(totpCode, p.totpSecret) {
			return ErrInvalidTOTP
		}
	}

	return nil
}

// IssueJWT creates a signed JWT for the given username and role, recording the
// session in the store with the provided user-agent and IP metadata.
func (p *Provider) IssueJWT(username string, role Role, userAgent, ip string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(p.expiry)
	jti := generateJTI()

	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   username,
			Issuer:    "cv-api",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
		Role: role,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(p.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign JWT: %w", err)
	}

	p.Sessions.Add(&Session{
		ID:        jti,
		Subject:   username,
		Role:      role,
		IssuedAt:  now,
		ExpiresAt: exp,
		UserAgent: userAgent,
		IP:        ip,
	})

	return signed, exp, nil
}

// ValidateJWT checks a JWT token string and returns the subject, jti, and role.
// Only accepts HS256 to prevent algorithm confusion attacks.
// JWTs issued before the role field was introduced default to RoleAdmin for
// backward compatibility (only the main user can obtain JWTs via login).
func (p *Provider) ValidateJWT(tokenStr string) (subject, jti string, role Role, err error) {
	token, parseErr := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return p.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))

	if parseErr != nil {
		if errors.Is(parseErr, jwt.ErrTokenExpired) {
			return "", "", "", ErrExpiredToken
		}
		return "", "", "", ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || claims == nil {
		return "", "", "", ErrInvalidToken
	}

	sub, subErr := claims.GetSubject()
	if subErr != nil || sub == "" {
		return "", "", "", ErrInvalidToken
	}

	r := claims.Role
	if r == "" {
		// Tokens issued before RBAC default to admin (only the main user
		// can obtain a JWT through the login endpoint).
		r = RoleAdmin
	}

	jtiVal := claims.ID
	if jtiVal != "" {
		if _, active := p.Sessions.Get(jtiVal); !active {
			return "", "", "", ErrInvalidToken
		}
	}

	return sub, jtiVal, r, nil
}

// RevokeSession removes a session from the session store by jti.
func (p *Provider) RevokeSession(jti string) {
	p.Sessions.Revoke(jti)
}

// APIKeyInfo holds non-sensitive information about a stored API key.
type APIKeyInfo struct {
	Prefix  string    `json:"prefix"`
	Role    Role      `json:"role"`
	AddedAt time.Time `json:"added_at"`
}

// AddAPIKey adds a new key to the in-memory key store with the given role.
func (p *Provider) AddAPIKey(key string, role Role) {
	entry := apiKeyEntry{key: key, addedAt: time.Now()}
	p.mu.Lock()
	switch role {
	case RoleViewer:
		p.viewerKeys = append(p.viewerKeys, entry)
	default:
		p.apiKeys = append(p.apiKeys, entry)
	}
	p.mu.Unlock()
}

// RevokeAPIKey removes all keys whose first 8 characters match the given prefix.
func (p *Provider) RevokeAPIKey(key string) {
	p.mu.Lock()
	p.apiKeys = filterKeys(p.apiKeys, key)
	p.viewerKeys = filterKeys(p.viewerKeys, key)
	p.mu.Unlock()
}

func filterKeys(entries []apiKeyEntry, key string) []apiKeyEntry {
	out := entries[:0:0]
	for _, e := range entries {
		if subtle.ConstantTimeCompare([]byte(e.key), []byte(key)) != 1 {
			out = append(out, e)
		}
	}
	return out
}

// RevokeAPIKeyByPrefix removes all keys whose first 8-character prefix matches.
func (p *Provider) RevokeAPIKeyByPrefix(prefix string) {
	p.mu.Lock()
	p.apiKeys = filterKeysByPrefix(p.apiKeys, prefix)
	p.viewerKeys = filterKeysByPrefix(p.viewerKeys, prefix)
	p.mu.Unlock()
}

func filterKeysByPrefix(entries []apiKeyEntry, prefix string) []apiKeyEntry {
	out := entries[:0:0]
	for _, e := range entries {
		keyPrefix := e.key
		if len(keyPrefix) > 8 {
			keyPrefix = keyPrefix[:8]
		}
		if keyPrefix != prefix {
			out = append(out, e)
		}
	}
	return out
}

// ListAPIKeys returns prefix and role metadata for all stored keys.
// The full key value is never returned.
func (p *Provider) ListAPIKeys() []APIKeyInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	out := make([]APIKeyInfo, 0, len(p.apiKeys)+len(p.viewerKeys))
	for _, e := range p.viewerKeys {
		prefix := e.key
		if len(prefix) > 8 {
			prefix = prefix[:8]
		}
		out = append(out, APIKeyInfo{Prefix: prefix, Role: RoleViewer, AddedAt: e.addedAt})
	}
	for _, e := range p.apiKeys {
		prefix := e.key
		if len(prefix) > 8 {
			prefix = prefix[:8]
		}
		out = append(out, APIKeyInfo{Prefix: prefix, Role: RoleEditor, AddedAt: e.addedAt})
	}
	return out
}

// GenerateAPIKey generates a cryptographically random URL-safe base64 key (32 bytes).
func GenerateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate key: %w", err)
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// RoleFromKey returns the role associated with a given API key.
// Viewer keys return RoleViewer, all other valid keys return RoleEditor.
// An empty string is returned for unrecognised keys.
func (p *Provider) RoleFromKey(key string) Role {
	keyBytes := []byte(key)
	p.mu.RLock()
	defer p.mu.RUnlock()
	for _, vk := range p.viewerKeys {
		if subtle.ConstantTimeCompare(keyBytes, []byte(vk.key)) == 1 {
			return RoleViewer
		}
	}
	for _, ak := range p.apiKeys {
		if subtle.ConstantTimeCompare(keyBytes, []byte(ak.key)) == 1 {
			return RoleEditor
		}
	}
	return ""
}

// ValidateAPIKey checks the given key against all configured API keys
// using constant-time comparison. It returns the role for the key.
func (p *Provider) ValidateAPIKey(key string) (Role, error) {
	role := p.RoleFromKey(key)
	if role == "" {
		return "", ErrInvalidAPIKey
	}
	return role, nil
}

// AuthKind identifies the type of credential found in a request.
type AuthKind string

const (
	AuthKindJWT    AuthKind = "jwt"
	AuthKindAPIKey AuthKind = "apikey"
	AuthKindNone   AuthKind = "none"
)

// ExtractCredentials retrieves credentials from the request.
// Check order: X-API-Key header, Authorization: Bearer header, session cookie.
func (p *Provider) ExtractCredentials(r *http.Request) (AuthKind, string) {
	if key := r.Header.Get("X-API-Key"); key != "" {
		return AuthKindAPIKey, key
	}

	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		return AuthKindJWT, strings.TrimPrefix(auth, "Bearer ")
	}

	if c, err := r.Cookie(p.cookieName); err == nil && c.Value != "" {
		return AuthKindJWT, c.Value
	}

	return AuthKindNone, ""
}

// Authenticate validates the credentials from a request and returns the subject, jti, and role.
// For API key authentication jti is always empty.
func (p *Provider) Authenticate(r *http.Request) (subject, jti string, role Role, err error) {
	kind, cred := p.ExtractCredentials(r)
	switch kind {
	case AuthKindAPIKey:
		r, keyErr := p.ValidateAPIKey(cred)
		if keyErr != nil {
			return "", "", "", keyErr
		}
		return "apikey-user", "", r, nil
	case AuthKindJWT:
		sub, j, ro, jwtErr := p.ValidateJWT(cred)
		if jwtErr != nil {
			return "", "", "", jwtErr
		}
		return sub, j, ro, nil
	default:
		return "", "", "", ErrNoCredentials
	}
}
