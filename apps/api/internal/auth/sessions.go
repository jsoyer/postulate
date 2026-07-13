package auth

import (
	"sort"
	"sync"
	"time"
)

// Session represents an active JWT session.
type Session struct {
	ID        string    `json:"id"`
	Subject   string    `json:"subject"`
	Role      Role      `json:"role"`
	IssuedAt  time.Time `json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
	UserAgent string    `json:"user_agent"`
	IP        string    `json:"ip"`
}

// SessionStore tracks active sessions in memory with TTL cleanup.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

// NewSessionStore creates a new empty SessionStore.
func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*Session),
	}
}

// Add inserts or replaces the session keyed by its ID (jti).
func (s *SessionStore) Add(sess *Session) {
	s.mu.Lock()
	s.sessions[sess.ID] = sess
	s.mu.Unlock()
}

// Get retrieves a session by jti. Returns false if not found.
func (s *SessionStore) Get(jti string) (*Session, bool) {
	s.mu.RLock()
	sess, ok := s.sessions[jti]
	s.mu.RUnlock()
	return sess, ok
}

// Revoke removes a session from the store.
func (s *SessionStore) Revoke(jti string) {
	s.mu.Lock()
	delete(s.sessions, jti)
	s.mu.Unlock()
}

// List returns all non-expired sessions sorted by issued_at descending.
func (s *SessionStore) List() []*Session {
	now := time.Now()
	s.mu.RLock()
	out := make([]*Session, 0, len(s.sessions))
	for _, sess := range s.sessions {
		if sess.ExpiresAt.After(now) {
			out = append(out, sess)
		}
	}
	s.mu.RUnlock()

	sort.Slice(out, func(i, j int) bool {
		return out[i].IssuedAt.After(out[j].IssuedAt)
	})
	return out
}

// PruneExpired removes all sessions that have passed their expiry time.
func (s *SessionStore) PruneExpired() {
	now := time.Now()
	s.mu.Lock()
	for jti, sess := range s.sessions {
		if !sess.ExpiresAt.After(now) {
			delete(s.sessions, jti)
		}
	}
	s.mu.Unlock()
}
