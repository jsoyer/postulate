package main

import (
	"flag"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/jsoyer/cv-tui-go/internal/api"
	"github.com/jsoyer/cv-tui-go/internal/config"
	"github.com/jsoyer/cv-tui-go/internal/ui"
)

var (
	version = "dev"
	commit  = "none"
)

func main() {
	var (
		configPath  string
		showVersion bool
		healthCheck bool
		verbose     bool
	)

	flag.StringVar(&configPath, "config", config.DefaultPath(), "path to config file")
	flag.BoolVar(&showVersion, "version", false, "print version and exit")
	flag.BoolVar(&healthCheck, "health", false, "check API health and exit")
	flag.BoolVar(&verbose, "v", false, "enable verbose logging")
	flag.Parse()

	// Support "cv health" as a subcommand in addition to "cv --health".
	if len(flag.Args()) > 0 && flag.Args()[0] == "health" {
		healthCheck = true
	}

	if showVersion {
		fmt.Printf("cv-tui %s (%s)\n", version, commit)
		os.Exit(0)
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	if verbose {
		fmt.Fprintf(os.Stderr, "config: %s\n", configPath)
		fmt.Fprintf(os.Stderr, "api:    %s\n", cfg.API.BaseURL)
	}

	client := api.New(cfg.API.BaseURL, cfg.API.APIKey, cfg.API.TimeoutDuration())

	if healthCheck {
		runHealthCheck(client, configPath, cfg.API.BaseURL)
		return
	}

	app := ui.New(client)
	p := tea.NewProgram(app, tea.WithAltScreen())

	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func runHealthCheck(client *api.Client, configPath, apiURL string) {
	fmt.Println("cv-tui health check")
	fmt.Println("---")
	fmt.Printf("Config: %s\n", configPath)
	fmt.Printf("API:    %s\n", apiURL)

	err := client.Health()
	if err != nil {
		fmt.Printf("Status: unreachable (%v)\n", err)
		os.Exit(1)
	}
	fmt.Println("Status: connected")
	os.Exit(0)
}
