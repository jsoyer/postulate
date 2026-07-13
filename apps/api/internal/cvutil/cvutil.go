// Package cvutil provides shared validation and configuration utilities
// used by both the cv-api and cv-runner binaries.
package cvutil

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/jsoyer/cv-api/internal/models"
	"gopkg.in/yaml.v3"
)

// ValidAppName allows only safe directory names: alphanumeric, hyphens, underscores, dots.
// Prevents path traversal attacks. Max 128 chars.
var ValidAppName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$`)

// ValidateAppName checks if an application name is safe for filesystem use.
// Returns nil if name is empty (not all targets require an app).
func ValidateAppName(name string) error {
	if name == "" {
		return nil
	}
	if !ValidAppName.MatchString(name) {
		return fmt.Errorf("invalid application name %q: must match %s", name, ValidAppName.String())
	}
	if strings.Contains(name, "..") {
		return fmt.Errorf("invalid application name %q: path traversal detected", name)
	}
	return nil
}

// LoadTargets reads and parses a targets YAML file.
func LoadTargets(path string) ([]models.Target, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var tc models.TargetConfig
	if err := yaml.Unmarshal(data, &tc); err != nil {
		return nil, fmt.Errorf("parse YAML: %w", err)
	}
	if len(tc.Targets) == 0 {
		return nil, fmt.Errorf("no targets defined in %q", path)
	}
	for i, t := range tc.Targets {
		if t.Name == "" {
			return nil, fmt.Errorf("target at index %d has no name", i)
		}
	}
	return tc.Targets, nil
}
