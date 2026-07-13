// Package search provides an in-memory inverted index for full-text search.
package search

import (
	"sort"
	"strings"
	"sync"
	"unicode"
)

// stopWords are common words excluded from indexing and query tokenization.
var stopWords = map[string]bool{
	"a": true, "an": true, "the": true, "and": true, "or": true,
	"is": true, "in": true, "of": true, "to": true, "for": true,
	"with": true, "on": true, "at": true, "by": true, "from": true,
}

// Index is an in-memory inverted index for full-text search.
type Index struct {
	mu    sync.RWMutex
	index map[string]map[string]struct{} // token → set of application names
	docs  map[string]string              // application name → full text content
}

// New creates a new empty Index.
func New() *Index {
	return &Index{
		index: make(map[string]map[string]struct{}),
		docs:  make(map[string]string),
	}
}

// Add indexes or re-indexes a document identified by name with the given text.
func (idx *Index) Add(name, text string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	// Remove previous index entries for this document.
	if old, ok := idx.docs[name]; ok {
		for _, tok := range tokenize(old) {
			if names, ok := idx.index[tok]; ok {
				delete(names, name)
				if len(names) == 0 {
					delete(idx.index, tok)
				}
			}
		}
	}

	idx.docs[name] = text
	for _, tok := range tokenize(text) {
		if idx.index[tok] == nil {
			idx.index[tok] = make(map[string]struct{})
		}
		idx.index[tok][name] = struct{}{}
	}
}

// Remove removes a document from the index.
func (idx *Index) Remove(name string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	text, ok := idx.docs[name]
	if !ok {
		return
	}
	delete(idx.docs, name)
	for _, tok := range tokenize(text) {
		if names, ok := idx.index[tok]; ok {
			delete(names, name)
			if len(names) == 0 {
				delete(idx.index, tok)
			}
		}
	}
}

// Search returns application names matching all query tokens, ranked by total
// token hit count (most hits first). Results are limited to limit entries.
func (idx *Index) Search(query string, limit int) []string {
	tokens := tokenize(query)
	if len(tokens) == 0 {
		return nil
	}

	idx.mu.RLock()
	defer idx.mu.RUnlock()

	// AND semantics: start with candidates from the first token, then intersect.
	first := tokens[0]
	firstSet, ok := idx.index[first]
	if !ok {
		return nil
	}

	// Build working candidate set from first token.
	candidates := make(map[string]struct{}, len(firstSet))
	for name := range firstSet {
		candidates[name] = struct{}{}
	}

	for _, tok := range tokens[1:] {
		names, ok := idx.index[tok]
		if !ok {
			return nil
		}
		for name := range candidates {
			if _, inTok := names[name]; !inTok {
				delete(candidates, name)
			}
		}
		if len(candidates) == 0 {
			return nil
		}
	}

	// Rank by total token hit count across all query tokens.
	type ranked struct {
		name  string
		score int
	}
	results := make([]ranked, 0, len(candidates))

	for name := range candidates {
		text, ok := idx.docs[name]
		if !ok {
			continue
		}
		docTokens := tokenize(text)
		counts := make(map[string]int, len(docTokens))
		for _, t := range docTokens {
			counts[t]++
		}
		score := 0
		for _, tok := range tokens {
			score += counts[tok]
		}
		results = append(results, ranked{name: name, score: score})
	}

	sort.Slice(results, func(i, j int) bool {
		if results[i].score != results[j].score {
			return results[i].score > results[j].score
		}
		return results[i].name < results[j].name
	})

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	out := make([]string, len(results))
	for i, r := range results {
		out[i] = r.name
	}
	return out
}

// tokenize lowercases the input, strips non-alphanumeric characters, splits on
// whitespace, and removes stop words. Duplicate tokens are retained so that
// frequency counting works correctly when building the score in Search.
func tokenize(s string) []string {
	s = strings.ToLower(s)

	var buf strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) {
			buf.WriteRune(r)
		} else {
			buf.WriteRune(' ')
		}
	}

	parts := strings.Fields(buf.String())
	out := parts[:0]
	for _, p := range parts {
		if !stopWords[p] && len(p) > 1 {
			out = append(out, p)
		}
	}
	return out
}
