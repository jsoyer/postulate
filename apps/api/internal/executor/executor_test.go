package executor

import (
	"testing"
)

func TestValidateAppName_Valid(t *testing.T) {
	valid := []string{
		"2024-03-company-x",
		"2024-01-google",
		"my-app",
		"my_app",
		"my.app",
		"a",
		"app123",
	}
	for _, name := range valid {
		if err := ValidateAppName(name); err != nil {
			t.Errorf("expected %q to be valid, got %v", name, err)
		}
	}
}

func TestValidateAppName_Invalid(t *testing.T) {
	invalid := []string{
		"../etc/passwd",
		"../../secret",
		".hidden",
		"-starts-with-dash",
		"has space",
		"has/slash",
		"has\\backslash",
		"has;semicolon",
		"has|pipe",
		"has`backtick",
		"has$dollar",
		"has&amp",
		string(make([]byte, 200)), // too long
	}
	for _, name := range invalid {
		if err := ValidateAppName(name); err == nil {
			t.Errorf("expected %q to be invalid, got nil", name)
		}
	}
}

func TestValidateAppName_Empty(t *testing.T) {
	if err := ValidateAppName(""); err != nil {
		t.Errorf("empty name should be allowed, got %v", err)
	}
}

func TestValidateAppName_PathTraversal(t *testing.T) {
	if err := ValidateAppName("foo..bar"); err == nil {
		t.Error("expected path traversal detection for 'foo..bar'")
	}
}
