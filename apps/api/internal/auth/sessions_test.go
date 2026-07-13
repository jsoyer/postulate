package auth

import (
	"testing"
	"time"
)

func makeSession(jti string, issued, expires time.Time) *Session {
	return &Session{
		ID:        jti,
		Subject:   "testuser",
		Role:      RoleAdmin,
		IssuedAt:  issued,
		ExpiresAt: expires,
		UserAgent: "go-test",
		IP:        "127.0.0.1",
	}
}

func TestSessionStore_AddAndGet(t *testing.T) {
	s := NewSessionStore()
	now := time.Now()
	sess := makeSession("jti-1", now, now.Add(time.Hour))
	s.Add(sess)

	got, ok := s.Get("jti-1")
	if !ok {
		t.Fatal("expected session to be found")
	}
	if got.ID != "jti-1" {
		t.Fatalf("expected ID jti-1, got %q", got.ID)
	}

	_, ok = s.Get("nonexistent")
	if ok {
		t.Fatal("expected false for nonexistent jti")
	}
}

func TestSessionStore_Revoke(t *testing.T) {
	s := NewSessionStore()
	now := time.Now()
	s.Add(makeSession("jti-1", now, now.Add(time.Hour)))
	s.Add(makeSession("jti-2", now, now.Add(time.Hour)))

	s.Revoke("jti-1")

	if _, ok := s.Get("jti-1"); ok {
		t.Fatal("expected jti-1 to be revoked")
	}
	if _, ok := s.Get("jti-2"); !ok {
		t.Fatal("expected jti-2 to still exist")
	}
}

func TestSessionStore_ListFiltersExpired(t *testing.T) {
	s := NewSessionStore()
	now := time.Now()

	s.Add(makeSession("active", now.Add(-time.Minute), now.Add(time.Hour)))
	s.Add(makeSession("expired", now.Add(-2*time.Hour), now.Add(-time.Hour)))

	list := s.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 active session, got %d", len(list))
	}
	if list[0].ID != "active" {
		t.Fatalf("expected session ID 'active', got %q", list[0].ID)
	}
}

func TestSessionStore_ListSortedByIssuedAtDesc(t *testing.T) {
	s := NewSessionStore()
	now := time.Now()

	s.Add(makeSession("first", now.Add(-2*time.Minute), now.Add(time.Hour)))
	s.Add(makeSession("second", now.Add(-time.Minute), now.Add(time.Hour)))

	list := s.List()
	if len(list) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(list))
	}
	if list[0].ID != "second" {
		t.Fatalf("expected most recent first; got %q", list[0].ID)
	}
}

func TestSessionStore_PruneExpired(t *testing.T) {
	s := NewSessionStore()
	now := time.Now()

	s.Add(makeSession("active", now.Add(-time.Minute), now.Add(time.Hour)))
	s.Add(makeSession("expired", now.Add(-2*time.Hour), now.Add(-time.Hour)))

	s.PruneExpired()

	if _, ok := s.Get("expired"); ok {
		t.Fatal("expected expired session to be pruned")
	}
	if _, ok := s.Get("active"); !ok {
		t.Fatal("expected active session to remain after prune")
	}
}
