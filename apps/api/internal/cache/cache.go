// Package cache provides a generic in-memory TTL cache backed by a sync.RWMutex.
package cache

import (
	"sync"
	"time"
)

// Entry holds a cached value with its expiration time.
type Entry[V any] struct {
	value     V
	expiresAt time.Time
}

// Cache is a generic in-memory TTL cache.
type Cache[K comparable, V any] struct {
	mu  sync.RWMutex
	ttl time.Duration
	m   map[K]Entry[V]
}

// New creates a Cache with the given TTL.
func New[K comparable, V any](ttl time.Duration) *Cache[K, V] {
	return &Cache[K, V]{
		ttl: ttl,
		m:   make(map[K]Entry[V]),
	}
}

// Set stores a value under key, expiring after TTL.
func (c *Cache[K, V]) Set(key K, value V) {
	c.mu.Lock()
	c.m[key] = Entry[V]{value: value, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

// Get returns the value for key and whether it was found and not expired.
func (c *Cache[K, V]) Get(key K) (V, bool) {
	c.mu.RLock()
	e, ok := c.m[key]
	c.mu.RUnlock()

	if !ok || time.Now().After(e.expiresAt) {
		var zero V
		return zero, false
	}
	return e.value, true
}

// Delete removes a key from the cache.
func (c *Cache[K, V]) Delete(key K) {
	c.mu.Lock()
	delete(c.m, key)
	c.mu.Unlock()
}

// Flush removes all entries from the cache.
func (c *Cache[K, V]) Flush() {
	c.mu.Lock()
	c.m = make(map[K]Entry[V])
	c.mu.Unlock()
}
