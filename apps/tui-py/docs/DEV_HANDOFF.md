# Dev Handoff — cv-tui-py

This document captures everything needed to resume development on a new machine from scratch. It records the current state of the project, what was built, what is pending, and how to get running immediately.

---

## Current State: v1.0.0 Released

- **Tag**: `v1.0.0` on `main` (commit `d0ffe34`)
- **PyPI**: https://pypi.org/project/cv-tui/ — live, published via OIDC trusted publishing
- **GitHub Release**: Created automatically from `CHANGELOG.md`
- **CI**: Passing — 122 tests, 92.54% coverage, mypy strict, ruff clean
- **Branch**: `main`, no open PRs, clean working tree

---

## New Machine Setup

```bash
# 1. Clone
git clone https://github.com/jsoyer/cv-tui-py.git
cd cv-tui-py

# 2. Install dependencies (includes dev extras)
uv sync --extra dev

# 3. Verify
uv run pytest            # 122 tests, ~17s
uv run mypy src/ --strict
uv run ruff check src/
```

### Config for local dev

```toml
# ~/.config/cv/config.toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-api-key"
timeout  = 30.0
```

### Run locally

```bash
uv run python -m cv_tui --config ~/.config/cv/config.toml
uv run python -m cv_tui health   # API connectivity check
uv run python -m cv_tui -v       # With debug logging
```

---

## Project Structure

```
cv-tui-py/
├── src/cv_tui/
│   ├── __init__.py          # __version__ = "1.0.0"
│   ├── __main__.py          # CLI: argparse, --config, --version, health subcommand
│   ├── app.py               # CVApp root, TabbedContent, global bindings (1-6, n, q, ctrl+r)
│   ├── config.py            # load_config() — TOML + CV_API_URL/CV_API_KEY/CV_TIMEOUT env vars
│   ├── api/
│   │   ├── client.py        # CvApiClient — httpx, TTL cache, retry backoff, WebSocket
│   │   ├── models.py        # Pydantic v2: Application, DashboardData, StatsData, Target, etc.
│   │   └── enums.py         # ApplicationStatus(StrEnum) with pipeline_order(), kanban_columns()
│   ├── screens/
│   │   ├── base.py          # LoadableScreen abstract base (on_mount, action_refresh, r binding)
│   │   ├── dashboard.py     # Tab 1 — inherits LoadableScreen
│   │   ├── applications.py  # Tab 2 — searchable DataTable, vim nav j/k/g/G, Escape blur
│   │   ├── kanban.py        # Tab 3 — 5-column board by ApplicationStatus
│   │   ├── actions.py       # Tab 4 — ListView of Make targets, WebSocket streaming, j/k nav
│   │   ├── stats.py         # Tab 5 — inherits LoadableScreen
│   │   ├── detail.py        # Pushed screen — full app view, tailor/notes buttons
│   │   ├── dialogs.py       # NewApplicationDialog modal
│   │   ├── notes_modal.py   # Per-application notes editor (platformdirs storage)
│   │   ├── theme_modal.py   # Theme selector before tailor (6 themes)
│   │   └── audit.py        # CV health audit (7 metrics) — does NOT inherit LoadableScreen (r=run_audit)
│   ├── theme/
│   │   └── catppuccin.py    # Catppuccin Mocha palette + CSS
│   └── widgets/
│       ├── status_badge.py
│       ├── action_button.py
│       └── output_panel.py  # Real-time streaming output display
├── tests/
│   ├── test_ui.py           # 25 Textual Pilot integration tests (MockCvApiClient)
│   ├── test_enums.py        # 25 tests for ApplicationStatus
│   ├── test_reconnect.py    # 4 tests for retry / backoff logic
│   ├── test_api_client.py   # API client unit tests (TTL cache, error handling)
│   ├── test_config.py       # Config loading tests
│   └── test_models.py       # Pydantic model validation tests
├── docs/
│   ├── ARCHITECTURE.md      # Full architecture reference
│   └── DEV_HANDOFF.md       # This file
├── .github/workflows/
│   ├── ci.yml               # Push/PR: lint + mypy + test matrix (ubuntu+win × 3.12+3.13)
│   └── release.yml          # v*.*.* tag: build → publish-pypi (OIDC) + github-release
├── pyproject.toml           # hatchling build, ruff, mypy, pytest, coverage config
├── CHANGELOG.md             # Keep a Changelog format
├── ROADMAP.md               # Feature roadmap with v1.0.0 done / v1.1.0 planned
├── CONTRIBUTING.md          # Dev setup, commit style, PR process
├── LICENSE                  # MIT, Copyright 2026 Jerome Soyer
├── Makefile                 # Convenience targets
└── config.example.toml      # Template config file
```

---

## Key Technical Decisions

### API Client (`api/client.py`)

- **TTL Cache**: `_CacheEntry` dataclass with `time.monotonic()`. TTLs: apps/dashboard/stats=60s, targets=300s
- **Retry**: `_request()` helper retries up to 3× on `httpx.TransportError` with 1s→2s→4s backoff
- **Cache invalidation**: `create_application()` clears app cache; `execute_action()` clears dashboard+stats
- **WebSocket**: `stream_action()` yields raw JSON strings; caller parses `{"type": "stdout", "data": "..."}`

### Screen Pattern

Screens inherit `LoadableScreen` (dashboard, stats) or implement the same pattern manually:
```python
def on_mount(self) -> None:
    self.run_worker(self._load(), exclusive=True)

def action_refresh(self) -> None:
    self.run_worker(self._load(), exclusive=True)

async def _load(self) -> None:
    # fetch data, update widgets
```

`audit.py` is intentionally excluded — `r` runs audit, not refresh.

### Testing

- `MockCvApiClient`: created with `CvApiClient.__new__()` bypassing `__init__`, then manually sets `_cache: dict = {}`, `_http`, and stubs all methods
- Tab-switch tests: check `display` **synchronously** after calling `action_switch_tab()` — do NOT `await pilot.pause()` after the action (Textual re-fires TabActivated on next tick which resets the tab)
- Textual Pilot tests use `async with app.run_test(size=(120, 40)) as pilot`

### Release Process

1. Update `__version__` in `src/cv_tui/__init__.py`
2. Add entry in `CHANGELOG.md` under `## [X.Y.Z] - YYYY-MM-DD`
3. `git tag vX.Y.Z && git push && git push --tags`
4. GitHub Actions `release.yml` fires automatically: build → publish to PyPI (OIDC) → create GitHub Release

### PyPI Trusted Publisher

Configured at https://pypi.org/manage/project/cv-tui/settings/publishing/:
- Owner: `jsoyer`
- Repository: `cv-tui-py`
- Workflow file: `release.yml`
- Environment: `pypi`

No `PYPI_TOKEN` secret needed.

---

## What Needs To Be Done Next (v1.1.0)

See `ROADMAP.md` for the full list. The highest-priority items:

### 1. Migrate remaining screens to `LoadableScreen`

`screens/base.py` exists with the base class. These screens still use the old boilerplate:
- `applications.py`
- `kanban.py`
- `actions.py`
- `detail.py` (partially — no `_load` pattern)

```python
# Before (old pattern in each screen)
def on_mount(self) -> None:
    self.run_worker(self._load(), exclusive=True)
def action_refresh(self) -> None:
    self.run_worker(self._load(), exclusive=True)
BINDINGS = [Binding("r", "refresh", "Refresh")]

# After (just inherit)
class ApplicationsScreen(LoadableScreen):
    async def _load(self) -> None:
        ...
```

### 2. Keybindings reference

Create `docs/KEYBINDINGS.md`:

| Key | Scope | Action |
|-----|-------|--------|
| `1` | Global | Switch to Dashboard |
| `2` | Global | Switch to Applications |
| `3` | Global | Switch to Kanban |
| `4` | Global | Switch to Actions |
| `5` | Global | Switch to Stats |
| `6` | Global | Switch to Audit |
| `[` / `]` | Global | Previous / Next tab |
| `n` | Global | New application dialog |
| `ctrl+r` | Global | Refresh all screens |
| `q` | Global | Quit |
| `r` | Most screens | Refresh current screen |
| `j` / `k` | Applications, Actions | Cursor down / up |
| `g` / `G` | Applications | Jump to top / bottom |
| `/` | Applications | Focus search input |
| `Escape` | Applications | Blur search, focus table |
| `Enter` | Applications | Open detail for selected row |
| `j` / `k` | Actions | Scroll target list |

### 3. Global search overlay

Ctrl+/ opens a floating modal with an Input that filters across all applications. Can be implemented as a `ModalScreen` pushed from `CVApp`.

### 4. Codecov integration

Add to `.github/workflows/ci.yml` after the test step:
```yaml
- name: Upload coverage to Codecov
  if: matrix.os == 'ubuntu-latest' && matrix.python-version == '3.12'
  uses: codecov/codecov-action@v4
  with:
    files: coverage.xml
```

---

## CI / CD Notes

- **`all-ok` job** in `ci.yml` is required for branch protection (checks both lint and test)
- **Dependabot PRs** fail occasionally when Actions bump to newer versions — check if our workflow files need updating
- **Release workflow** uses `uvx twine check dist/*` (not `uv pip install twine && twine`) — avoid `uv pip install` as `twine` doesn't land on PATH

---

## Bugs / Known Issues

None currently open. Issues fixed during v1.0.0:

| Bug | Fix |
|-----|-----|
| `DataTable.action_scroll_cursor_down()` removed in Textual ≥1.0 | Use `action_cursor_down()` instead |
| `push_screen` callback must accept `str \| None` | Signature: `def _on_theme_selected(theme: str \| None)` |
| `uvx` not found after `uv pip install twine` | Use `uvx twine` directly |
| Tab-switch tests flaky — fail when `await pilot.pause()` after `action_switch_tab()` | Remove pause; check display synchronously |

---

**Last updated**: 2026-03-10
**Author**: Jerome Soyer
