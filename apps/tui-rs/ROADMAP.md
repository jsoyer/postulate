# cv-tui-rs Roadmap

A living document outlining planned features, improvements, and architectural enhancements for cv-tui-rs. This roadmap is organized by category and represents both short-term improvements and longer-term vision for the project.

## UI & Navigation

- [ ] **Multi-pane detail view** - Split application list and detail pane side-by-side for faster context switching
- [ ] **Vim search and navigation** - Add Vim-style search with `/` and `?` for backward search, with jump-to-match support
- [ ] **Mouse support enhancement** - Expand mouse click support for tab switching, list selection, and modal buttons
- [ ] **Customizable keybindings** - Allow users to define custom keybindings via config file with default presets (vim, emacs, nano)
- [ ] **Help pane interactive mode** - Make the help overlay searchable and navigable with examples for each command
- [ ] **Breadcrumb navigation** - Display navigation path (Dashboard > Applications > Detail) to clarify context

## Features & Data Management

- [ ] **Application detail editor** - Inline YAML editor for meta.yml with syntax highlighting and validation
- [ ] **Bulk operations** - Select multiple applications and run actions, move to stage, or delete in batch
- [ ] **Notes/comments feature** - Add per-application notes with timestamps and edit history
- [ ] **File browser integration** - View application directory structure, preview files (CV, cover letter, etc.)
- [ ] **Tag/label system** - Create and filter applications by custom tags for better organization
- [ ] **Advanced filtering** - Combine multiple filters (status + date range + company) with saved filter presets
- [ ] **Export functionality** - Export application list as CSV, JSON, or markdown for reporting

## Performance & Scalability

- [ ] **HTTP/2 and connection pooling** - Upgrade reqwest configuration for persistent connections and HTTP/2 support
- [x] **Response caching layer** - Cache API responses (with TTL) to reduce network calls for frequently accessed data
- [ ] **Async improvements** - Implement proper task cancellation and graceful shutdown for long-running operations
- [ ] **Lazy loading** - Load application details on-demand instead of fetching all data at startup
- [x] **Streaming responses** - WebSocket support for stats and action output

## Configuration & Customization

- [x] **Environment variable overrides** - Support CV_API_URL, CV_API_KEY, CV_TIMEOUT for easy config overrides
- [ ] **Config auto-reload** - Detect config file changes and reload theme/settings without restart
- [ ] **Theme builder UI** - Interactive theme customization mode to create and preview custom color schemes
- [ ] **Per-view settings** - Allow users to configure layout, sorting, and filtering preferences per view
- [ ] **Custom column layout** - Let users choose which columns to display in the applications list
- [ ] **Status bar customization** - Configurable status bar with pluggable information widgets

## Platform & Integration

- [ ] **System clipboard integration** - Copy application URLs, paths, and formatted data to system clipboard
- [ ] **Desktop notifications** - Alert user when long-running actions complete
- [ ] **Shell completion scripts** - Generate bash, zsh, and fish completion for flags and subcommands
- [ ] **Windows support** - Test and fix platform-specific terminal handling for Windows PowerShell and Windows Terminal
- [ ] **macOS system integration** - Native menu bar support and Spotlight integration for quick launch

## Testing & Code Quality

- [ ] **Snapshot testing** - Implement ratatui snapshot tests for UI components and views
- [ ] **Integration tests** - Create test suite that mocks cv-api responses and validates view rendering
- [ ] **Performance benchmarks** - Establish baseline metrics for startup time, memory usage, and render latency
- [ ] **E2E test harness** - Build test framework for simulating user workflows (navigation, filtering, actions)
- [ ] **Property-based testing** - Use proptest to validate data parsing and edge cases

## CI/CD & Release Management

- [ ] **Cross-platform builds** - Automated GitHub Actions workflow for macOS (Intel + Apple Silicon), Linux, and Windows
- [ ] **Binary releases** - Publish pre-built binaries on GitHub Releases for all major platforms
- [ ] **Homebrew formula** - Publish to Homebrew for easy installation on macOS (`brew install cv-rs`)
- [ ] **AUR package** - Publish to Arch User Repository for Linux users
- [ ] **Automated changelog** - Generate CHANGELOG.md from conventional commits during releases
- [ ] **Version bump automation** - Automatically update version in Cargo.toml and create git tags

## Developer Experience

- [ ] **Structured logging** - Add tracing/log crate with configurable log levels (--log-level debug)
- [ ] **Debug mode** - Enable verbose API request/response logging and UI state inspection
- [ ] **Better error messages** - Improve error display with suggestions for common issues (missing config, API unreachable)
- [ ] **Architecture documentation** - Create docs/ARCHITECTURE.md explaining module structure and data flow
- [ ] **Contributing guide** - Write CONTRIBUTING.md with setup instructions, code style, and PR process
- [ ] **Plugin system sketches** - Explore architecture for user-defined actions/commands as external processes

## Long-term Vision

- [ ] **Protocol abstraction** - Allow alternative backends beyond cv-api (direct Makefile execution, other systems)
- [ ] **Local-first mode** - Cache all data locally with offline support and sync when online
- [ ] **Time tracking** - Integrate with action runner to track time spent on applications
- [ ] **Analytics & insights** - Build dashboard showing conversion rates, time-to-offer, success metrics
- [ ] **Collaborative features** - Share application status with team members via cv-api integrations

## CV Integration

### Theme Support

- [ ] Theme preview action -- add `preview` action in application detail view that generates PDF with selected theme and opens in default viewer
- [ ] Theme selector -- interactive theme picker (arrow keys) listing tech-blue, startup-orange, executive-dark, cyber-red
- [ ] Default theme in config -- allow setting preferred theme in config.toml, applied to all previews

### Data Quality

- [x] **Quick-launch actions** - Keybindings t/v/b/s/p/a for Tailor, Review, Build, Score, Prep, Audit from detail view
- [x] **CV health audit** - Full audit screen with app selection, scoring (0-100), metric bars, duplicates/overused words
- [ ] CV health indicator -- show audit score (0-100) as a column in the applications list view
- [ ] Duplicate detection highlights -- in detail view, visually highlight near-duplicate bullets with similarity score

### UI Features

- [x] **Create application dialog** - Inline form (n key) with Company, Position, URL fields
- [ ] Application detail editor -- Inline YAML editor for meta.yml with syntax highlighting and validation

### AI & Debug

- [ ] AI provider status in status bar -- show current AI provider (e.g. "gemini" or "claude (fallback)") in bottom status bar
- [ ] --log-level CLI flag -- support `cv-rs --log-level debug` for verbose API and UI logging

---

## Current Status

- **Latest version**: 0.1.0
- **Active maintainer**: [@jsoyer](https://github.com/jsoyer)
- **Last updated**: March 2026

For questions or feature requests, please open an [issue on GitHub](https://github.com/jsoyer/cv-tui-rs/issues).
