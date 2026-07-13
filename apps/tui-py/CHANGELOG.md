# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-10

### Added

- **Dashboard screen** — pipeline funnel with progress bars, recent applications DataTable
- **Applications screen** — searchable DataTable with async health score column (green/yellow/red)
- **Kanban board** — card columns per status (applied, interview, offer, rejected, ghosted)
- **Actions screen** — ListView of all Make targets grouped by category, WebSocket streaming output
- **Stats screen** — funnel chart and weekly timeline DataTable
- **Audit screen** — CV health audit with 7 metrics as progress bars
- **Detail screen** — full application view with quick-action buttons
- **Theme modal** — interactive theme selector before running tailor action (6 themes)
- **Notes editor** — per-application markdown notes stored in platformdirs config directory
- **Batch theme generation** — generates all 4 theme variant PDFs in one action (detail screen)
- **AI provider badge** — shows which AI provider (Gemini, Claude, OpenAI) was used after each run
- **`ApplicationStatus` enum** — `StrEnum` with `pipeline_order()` and `kanban_columns()` helpers
- **TTL request cache** — 60-second in-memory cache for applications, dashboard, stats; 5-minute for targets
- **WebSocket streaming** — real-time action output via `stream_action()` in `OutputPanel` widget
- **`cv-tui health` subcommand** — API connectivity report with exit code 0/1
- **`-v` / `--verbose` flag** — enables DEBUG logging for troubleshooting
- **GitHub Actions CI** — lint + type-check + test matrix (ubuntu + windows, Python 3.12 + 3.13)
- **PyPI release pipeline** — OIDC trusted publishing on `v*.*.*` tags
- **Dependabot** — weekly dependency and GitHub Actions updates
- **Windows support** — `platformdirs` replaces hard-coded `~/.config/cv` paths
- **Coverage enforcement** — pytest-cov with 75% minimum line coverage gate

### Changed

- Migrated from plain `Static` string rendering to native Textual widgets (DataTable, ListView, ProgressBar)
- Replaced hardcoded status strings with `ApplicationStatus` StrEnum throughout dashboard, kanban, stats

### Fixed

- Cache invalidation: `create_application` clears application cache entries; `execute_action` clears dashboard and stats
- Test assertions aligned with TTL cache behaviour (second call within TTL returns cached result)

## [0.1.0] - 2026-02-01

### Added

- Initial Python TUI migrated from shell scripts
- Basic screen layout with Textual TabbedContent
- `CvApiClient` async HTTP client with Pydantic v2 models
- Catppuccin Mocha theme
