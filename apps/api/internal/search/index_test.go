package search

import (
	"testing"
)

func TestIndex_BasicSearch(t *testing.T) {
	idx := New()
	idx.Add("app-alpha", "golang engineer backend microservices")
	idx.Add("app-beta", "frontend react typescript developer")
	idx.Add("app-gamma", "product manager agile roadmap")

	results := idx.Search("golang", 10)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0] != "app-alpha" {
		t.Fatalf("expected app-alpha, got %s", results[0])
	}
}

func TestIndex_ANDSemantics(t *testing.T) {
	idx := New()
	idx.Add("app-alpha", "golang backend engineer cloud")
	idx.Add("app-beta", "golang frontend typescript")
	idx.Add("app-gamma", "java backend engineer")

	// Only app-alpha contains both "golang" and "backend".
	results := idx.Search("golang backend", 10)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d: %v", len(results), results)
	}
	if results[0] != "app-alpha" {
		t.Fatalf("expected app-alpha, got %s", results[0])
	}
}

func TestIndex_StopWordsIgnored(t *testing.T) {
	idx := New()
	idx.Add("app-alpha", "senior engineer golang")
	idx.Add("app-beta", "product manager")

	// "the" is a stop word; result should be same as searching "engineer".
	withStop := idx.Search("the engineer", 10)
	withoutStop := idx.Search("engineer", 10)

	if len(withStop) != len(withoutStop) {
		t.Fatalf("stop word changed result count: %v vs %v", withStop, withoutStop)
	}
	for i := range withStop {
		if withStop[i] != withoutStop[i] {
			t.Fatalf("stop word changed results at index %d: %s vs %s", i, withStop[i], withoutStop[i])
		}
	}
	if len(withStop) != 1 || withStop[0] != "app-alpha" {
		t.Fatalf("expected [app-alpha], got %v", withStop)
	}
}

func TestIndex_Remove(t *testing.T) {
	idx := New()
	idx.Add("app-alpha", "golang backend engineer")
	idx.Remove("app-alpha")

	results := idx.Search("golang", 10)
	if len(results) != 0 {
		t.Fatalf("expected 0 results after remove, got %d: %v", len(results), results)
	}
}

func TestIndex_RankByFrequency(t *testing.T) {
	idx := New()
	// app-alpha mentions "golang" three times.
	idx.Add("app-alpha", "golang golang golang backend")
	// app-beta mentions "golang" once.
	idx.Add("app-beta", "golang frontend developer")

	results := idx.Search("golang", 10)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0] != "app-alpha" {
		t.Fatalf("expected app-alpha first (higher frequency), got %s", results[0])
	}
}
