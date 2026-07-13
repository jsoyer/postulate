# cv-tui-py Roadmap

This document outlines planned features and improvements for cv-tui-py, the Python Textual TUI for CV management. Items are organized by category and represent the evolution of the project over coming releases.

## v1.0.0 — Released 2026-03-10 ✓

All items below were delivered in the v1.0.0 release:

- [x] Dashboard screen — pipeline funnel with progress bars, recent applications DataTable
- [x] Applications screen — searchable DataTable, vim cursor nav (j/k/g/G), Escape to blur search
- [x] Kanban board — 5 columns per ApplicationStatus, cards with company/position/score
- [x] Actions screen — ListView of Make targets grouped by category, WebSocket streaming output, j/k vim nav
- [x] Stats screen — funnel chart + weekly timeline DataTable
- [x] Audit screen — 7 CV health metrics as progress bars
- [x] Detail screen — full application view with quick-action buttons, theme modal, notes
- [x] Theme modal — 6 themes, interactive selector before tailor action
- [x] Notes editor modal — per-application markdown notes via platformdirs
- [x] Batch theme generation — generates all 4 PDF variants in one go
- [x] AI provider badge — shows Gemini/Claude/OpenAI after each run in actions screen
- [x] `ApplicationStatus` StrEnum — `pipeline_order()` and `kanban_columns()` helpers
- [x] TTL request cache — 60s for apps/dashboard/stats, 5min for targets; invalidated on mutations
- [x] Exponential backoff retry — 3 retries on `TransportError`, delays 1s → 2s → 4s
- [x] `LoadableScreen` base class — `on_mount` + `action_refresh` + `r` binding (dashboard, stats)
- [x] WebSocket streaming — real-time action output in `OutputPanel` widget
- [x] `cv-tui health` subcommand — API connectivity report, exit 0/1
- [x] `-v` / `--verbose` flag — enables DEBUG logging
- [x] Plaintext HTTP warning — warns on stderr when connecting to non-localhost over HTTP
- [x] Windows support — `platformdirs` replaces hardcoded `~/.config/cv` paths
- [x] GitHub Actions CI — lint + mypy strict + test matrix (ubuntu + windows × Python 3.12 + 3.13)
- [x] PyPI release pipeline — OIDC trusted publishing on `v*.*.*` tags (secretless)
- [x] GitHub Release automation — CHANGELOG extraction via AWK, dist artifacts attached
- [x] Dependabot — weekly updates for Actions and pip dependencies
- [x] Coverage enforcement — pytest-cov with 75% gate (currently 92.54%)
- [x] 122 tests — unit, integration, UI Pilot tests
- [x] Architecture docs — `docs/ARCHITECTURE.md`
- [x] Contributing guide — `CONTRIBUTING.md`
- [x] MIT License — `LICENSE`

---

## v1.1.0 — Next Sprint (Target: Q2 2026)

### High Priority

- [ ] **Migrate remaining screens to `LoadableScreen`** — `applications.py`, `kanban.py`, `actions.py`, `detail.py` still use the old boilerplate pattern (base class exists, just not yet applied everywhere)
- [ ] **Keybindings reference doc** — `docs/KEYBINDINGS.md` with full cheat sheet (all global + per-screen bindings)
- [ ] **Global search overlay** — Ctrl+/ opens a floating search across all applications from any tab
- [ ] **Health score in Kanban cards** — show color-coded audit score on each Kanban card (already in DataTable, needs Kanban)
- [ ] **Theme config override** — allow per-view theme overrides in `~/.config/cv/config.toml` under `[ui]`

### Medium Priority

- [ ] **Advanced filtering panel** — multi-field filter (status + score + date range), toggle with `f` key
- [ ] **Bulk actions** — select multiple applications with Space, apply status change / action to all
- [ ] **Activity timeline** — per-application log of all state changes and actions run
- [ ] **Notifications bell** — widget in status bar showing pending completed async actions
- [ ] **Automated CHANGELOG generation** — from conventional commits on release (use `git-cliff` or `release-please`)
- [ ] **Codecov integration** — upload `coverage.xml` to codecov.io in CI, add badge to README

### Lower Priority

- [ ] **Snapshot tests** — `textual-snapshot` or `pytest-textual-snapshot` for visual regression
- [ ] **Property-based tests** — `hypothesis` for config loading and model parsing edge cases
- [ ] **OpenTelemetry traces** — instrument API calls and widget lifecycle for debugging

---

## v1.2.0 (Target: Q3 2026)

### UI & Navigation

- [ ] Full vim keybindings mode — `w`, `b`, `gg`, `G`, `/`, `?` motion support
- [ ] Mouse support — clickable actions and widget focus
- [ ] Breadcrumb navigation indicator
- [ ] Sidebar navigation panel
- [ ] Custom color themes — Nord, Dracula, Solarized, user-defined via config

### Features & UX

- [ ] Rich notes editor — markdown preview, multi-line inline editing
- [ ] File browser widget — preview and download cover letters, resumes
- [ ] Real-time action streaming with progress indicators — percentage, ETA, cancel button
- [ ] Interview scheduling modal with calendar integration

### Configuration

- [ ] YAML/TOML config schema for keybindings customization
- [ ] Theme generator tool
- [ ] Per-screen display preferences (columns shown, sort order, row height)
- [ ] Import/export application data (JSON, CSV)

### Performance

- [ ] Lazy loading for large application lists — virtual scrolling
- [ ] Offline mode with local SQLite fallback — cache applications, replay actions when reconnected

### Platform & Distribution

- [ ] Homebrew tap for macOS (`brew install jsoyer/tap/cv-tui`)
- [ ] Snap package for Linux
- [ ] Docker container image with cv-api sidecar for local demo setup

### Developer Experience

- [ ] Plugin system architecture — extend screens and widgets externally
- [ ] Component showcase — test widgets in isolation (similar to Storybook)
- [ ] Hot reload during development (watch mode via `textual-dev`)

---

## Known Technical Debt

| Item | Priority | Notes |
|------|----------|-------|
| Migrate `applications.py`, `kanban.py`, `actions.py`, `detail.py` to `LoadableScreen` | High | Base class exists in `screens/base.py` |
| Add type stubs for Textual dynamic attributes | Medium | Suppressed with `# type: ignore` |
| Reduce CSS duplication across theme files | Low | Only one theme currently |
| State management pattern | Low | Consider Redux-like store for complex interactions |

---

**Last Updated**: 2026-03-10
**Current Version**: 1.0.0 (released to PyPI)
**Target Release Cadence**: Quarterly feature updates + continuous bug fixes
**PyPI**: https://pypi.org/project/cv-tui/
**GitHub**: https://github.com/jsoyer/cv-tui-py
