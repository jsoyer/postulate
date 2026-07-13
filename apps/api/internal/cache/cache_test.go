package cache

import (
	"testing"
	"time"
)

func TestCache_HitMiss(t *testing.T) {
	c := New[string, int](time.Minute)

	if _, ok := c.Get("missing"); ok {
		t.Fatal("expected miss for key that was never set")
	}

	c.Set("k", 42)

	v, ok := c.Get("k")
	if !ok {
		t.Fatal("expected hit after Set")
	}
	if v != 42 {
		t.Fatalf("expected 42, got %d", v)
	}
}

func TestCache_TTLExpiration(t *testing.T) {
	c := New[string, string](time.Millisecond)
	c.Set("key", "value")

	v, ok := c.Get("key")
	if !ok || v != "value" {
		t.Fatal("expected hit immediately after Set")
	}

	time.Sleep(5 * time.Millisecond)

	if _, ok := c.Get("key"); ok {
		t.Fatal("expected miss after TTL expired")
	}
}

func TestCache_Delete(t *testing.T) {
	c := New[string, bool](time.Minute)
	c.Set("a", true)

	c.Delete("a")

	if _, ok := c.Get("a"); ok {
		t.Fatal("expected miss after Delete")
	}

	c.Delete("nonexistent")
}

func TestCache_Flush(t *testing.T) {
	c := New[int, string](time.Minute)
	c.Set(1, "one")
	c.Set(2, "two")
	c.Set(3, "three")

	c.Flush()

	for _, key := range []int{1, 2, 3} {
		if _, ok := c.Get(key); ok {
			t.Fatalf("expected miss for key %d after Flush", key)
		}
	}
}

func TestCache_OverwriteResetsExpiry(t *testing.T) {
	c := New[string, int](time.Millisecond)
	c.Set("k", 1)
	time.Sleep(5 * time.Millisecond)

	c.Set("k", 2)

	v, ok := c.Get("k")
	if !ok {
		t.Fatal("expected hit after re-Set")
	}
	if v != 2 {
		t.Fatalf("expected 2, got %d", v)
	}
}
