# cv-tui-py

![Python](https://img.shields.io/badge/python-3.12%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PyPI](https://img.shields.io/pypi/v/cv-tui)

Terminal UI for CV management, powered by Python and [Textual](https://textual.textualize.io/). Connects to the [cv-api](https://github.com/jsoyer/cv-api) HTTP/WebSocket backend to manage job applications, generate tailored CV documents, and run health audits — all from the terminal.

## Features

- **Dashboard** — Pipeline funnel bar chart and recent applications at a glance
- **Applications** — Searchable DataTable of all applications with async health scores
- **Kanban** — Drag-free board with five columns for application status (applied, interview, offer, rejected, ghosted)
- **Actions** — Browse Make targets grouped by category, fill arguments, execute with streaming WebSocket output and AI provider detection
- **Stats** — Funnel chart showing pipeline conversion and weekly activity timeline
- **Audit** — CV health metrics and score reporting
- **Create applications** — Quick dialog to add new applications directly from the TUI
- **Catppuccin Mocha theme** — Consistent, readable color scheme throughout
- **Async streaming** — All long-running operations stream real-time output without blocking the UI

## Requirements

- Python 3.12 or later
- Running instance of [cv-api](https://github.com/jsoyer/cv-api)
- Terminal with 256-color support

## Installation

Install via pip:

```bash
pip install cv-tui
```

Or via uv:

```bash
uv add cv-tui
```

## Configuration

Create `~/.config/cv/config.toml`:

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key-here"
timeout  = 30.0
```

On Windows, use `%APPDATA%\cv\config.toml` instead.

The configuration is shared across cv-tui-py, cv-tui-go, and cv-tui-rs.

## Usage

### Launch the TUI

```bash
cv-tui
```

Or specify a custom config file:

```bash
cv-tui --config /path/to/config.toml
```

### Health Check

Check if cv-api is reachable:

```bash
cv-tui health
```

Exits with code 0 if connected, 1 if unreachable. Useful for CI/CD and monitoring.

### Debug Mode

Enable DEBUG logging:

```bash
cv-tui -v
```

## Screens

### Dashboard (Tab 1)

Shows total application count, a funnel bar chart of the pipeline (applied → interview → offer → accepted), and a list of the 10 most recent applications. Quick overview of your recruitment activity.

### Applications (Tab 2)

Searchable DataTable displaying all applications. Columns include date created, company, position, status, outcome, and health score. Press Enter to open the detail view. Use `/` to focus the search input and filter by company, position, status, or application name. Health scores are fetched asynchronously in the background via the audit action.

### Kanban (Tab 3)

Card-based board with five columns representing application status: applied, interview, offer, rejected, and ghosted. Cards are populated in real time from cv-api. Provides a visual overview of where applications stand in the pipeline.

### Actions (Tab 4)

Targets loaded from cv-api are listed and grouped by category (build, deploy, tailor, review, etc.). Select a target to view its arguments. Fill in the application name (often available via dropdown) and any other required parameters. Press Run to execute the target. Output streams via WebSocket, with automatic AI provider detection (Gemini, Claude, OpenAI, Mistral, Ollama) displayed as a badge.

### Stats (Tab 5)

Displays a funnel chart with conversion percentages at each stage (applied → interview → offer) and a weekly activity timeline showing the number of applications per week. Helps track recruitment trends over time.

### Audit (Tab 6)

Select an application and run the health audit action. Returns a composite health score (0–100) and individual metrics (structure, content, formatting, etc.). Displays structured results with progress bars, duplicated phrases, and overused words detected in the CV.

## Keybindings

| Key | Action |
|-----|--------|
| 1–6 | Switch to tab 1–6 |
| [ / ] | Previous / next tab |
| Ctrl+H / Ctrl+L | Previous / next tab |
| n | New application dialog |
| Ctrl+R | Refresh all screens |
| r | Refresh current screen |
| j / k | Cursor down / up |
| g / G | Jump to first / last row (Applications) |
| Enter | Open detail view (Applications) |
| / | Focus search (Applications) |
| q | Quit |

## Development

Clone the repository and set up the development environment:

```bash
git clone https://github.com/jsoyer/cv-tui-py
cd cv-tui-py
uv sync
```

Run tests:

```bash
uv run pytest
```

Run linting:

```bash
uv run ruff check src/
```

Run type checking:

```bash
uv run mypy src/ --strict
```

## License

MIT
