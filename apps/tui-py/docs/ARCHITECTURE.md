# cv-tui-py Architecture

A detailed guide to the codebase structure, design patterns, and key decisions in cv-tui-py.

## Table of Contents

1. [Module Structure](#module-structure)
2. [Application Lifecycle](#application-lifecycle)
3. [Screen Loading Pattern](#screen-loading-pattern)
4. [API Client Design](#api-client-design)
5. [Configuration System](#configuration-system)
6. [Data Flow](#data-flow)
7. [Key Design Decisions](#key-design-decisions)

## Module Structure

The project is organized as follows:

```
src/cv_tui/
├── __init__.py              # Package version (__version__)
├── __main__.py              # CLI entry point (argparse, --config, --version)
├── app.py                   # CVApp — root Textual App, tab management
├── config.py                # load_config() — TOML + env var overrides
├── api/
│   ├── __init__.py
│   ├── client.py            # CvApiClient — async httpx, TTL cache, retry logic
│   └── models.py            # Pydantic v2 models (Application, DashboardData, etc.)
├── screens/
│   ├── __init__.py
│   ├── dashboard.py         # Tab 1 — pipeline funnel + recent applications
│   ├── applications.py      # Tab 2 — searchable DataTable of all applications
│   ├── kanban.py            # Tab 3 — 5-column Kanban board by status
│   ├── actions.py           # Tab 4 — Make target runner with streaming output
│   ├── stats.py             # Tab 5 — funnel chart + timeline visualization
│   ├── detail.py            # Pushed screen — full application detail view
│   └── dialogs.py           # Modal dialogs (NewApplicationDialog)
├── theme/
│   ├── __init__.py
│   └── catppuccin.py        # Catppuccin Mocha color palette + CSS
└── widgets/
    ├── __init__.py
    ├── status_badge.py      # Status display widget
    ├── action_button.py     # Action button widget
    └── output_panel.py      # Real-time streaming output display
```

### Core Files Overview

- **`__main__.py`**: Argument parsing (--config, --version), config loading, client instantiation, and app launch
- **`app.py`**: Root Textual application with tab-based navigation, global key bindings (1-5 for tabs, n for new app, q to quit)
- **`config.py`**: TOML configuration loader with environment variable overrides (CV_API_URL, CV_API_KEY, CV_TIMEOUT)
- **`api/client.py`**: Async HTTP client wrapping all cv-api endpoints with built-in retry and caching
- **`api/models.py`**: Pydantic v2 data classes mirroring cv-api Go structs

## Application Lifecycle

The application follows this startup and runtime sequence:

### 1. Launch

```bash
python -m cv_tui [--config /path/to/config.toml] [--version]
```

`__main__.py::main()` parses arguments, loads configuration, initializes `CvApiClient`, and creates the root `CVApp`.

### 2. Root App Initialization

`CVApp.__init__()` receives the `CvApiClient` instance and stores it for screen access.

### 3. Compose

`CVApp.compose()` yields:
- `Header()` — displays app title and subtitle
- `TabbedContent()` with 5 tab panes:
  - Tab 1: `DashboardScreen` — overview
  - Tab 2: `ApplicationsScreen` — full list
  - Tab 3: `KanbanScreen` — columns by status
  - Tab 4: `ActionsScreen` — Make targets
  - Tab 5: `StatsScreen` — charts and timeline
- `Static` status bar showing API health
- `Footer()` — displays active key bindings

### 4. Mount

`CVApp.on_mount()` calls `client.health()` to verify the backend is reachable and updates the status bar.

### 5. Screen Lifecycle

Each tab screen (inheriting from `Screen`) follows its own lifecycle:

```
on_mount()
  └─ run_worker(self._load(), exclusive=True)
      └─ async _load()
          └─ await client.get_*()
             └─ update widget content
```

Each screen's `on_mount()` spawns an async worker to load initial data without blocking the UI.

### 6. Global Key Bindings

| Key | Action | Handler |
|-----|--------|---------|
| `1-5` | Switch tabs | `action_switch_tab(tab_id)` |
| `n` | New application | `action_new_application()` → `NewApplicationDialog` |
| `ctrl+r` | Refresh all screens | `action_refresh_all()` |
| `q` | Quit | Built-in quit action |

Screen-specific bindings (e.g., `r` to refresh, `/` to search) are defined in each screen.

### 7. Shutdown

`CVApp.on_unmount()` closes the HTTP client with `await client.close()` to clean up resources.

## Screen Loading Pattern

All data-loading screens follow this pattern:

### Standard Screen Structure

```python
class MyScreen(Screen):
    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client

    def compose(self) -> ComposeResult:
        # Yield widgets with initial placeholder state
        yield Static("Loading...")

    def on_mount(self) -> None:
        # Kick off data load without blocking UI
        self.run_worker(self._load(), exclusive=True)

    def action_refresh(self) -> None:
        # Allow manual refresh via 'r' key
        self.run_worker(self._load(), exclusive=True)

    async def _load(self) -> None:
        try:
            data = await self._client.get_dashboard()
            # Update widgets with data
            widget.update(self._build_content(data))
        except Exception as exc:
            # Show error in UI
            widget.update(f"[red]Error: {exc}[/red]")

    def _build_content(self, data: SomeModel) -> str:
        # Format data for display
        return "..."
```

### Key Points

1. **Async Loading**: All API calls are async and run in a worker thread, keeping the TUI responsive
2. **Error Handling**: Caught exceptions are displayed inline rather than crashing the app
3. **Refresh Pattern**: `run_worker(..., exclusive=True)` ensures only one load happens at a time
4. **Widget Updates**: Content is built in synchronous `_build_*()` methods, then pushed to widgets

### Example: ApplicationsScreen

```python
async def _load(self) -> None:
    self._apps = await self._client.list_applications()
    self._populate(self._apps)

def on_input_changed(self, event: Input.Changed) -> None:
    # Live filter as user types
    if query := event.value.lower():
        filtered = [a for a in self._apps if query in a.name]
        self._populate(filtered)
    else:
        self._populate(self._apps)
```

Screens can hold state (e.g., `_apps` list) and respond to user events without re-fetching.

## API Client Design

### CvApiClient Overview

`CvApiClient` is the single source of truth for all communication with cv-api. It wraps httpx with:

- **Async operations**: All methods are `async def`
- **Error handling**: Raises `APIError` on non-2xx responses
- **TTL caching**: In-memory cache for read operations (optional optimization)
- **Retry logic**: Exponential backoff on `TransportError`
- **WebSocket streaming**: Real-time output from long-running actions

### Constructor

```python
CvApiClient(
    base_url: str,              # e.g., "http://localhost:3001"
    api_key: str,               # Sent as X-API-Key header
    timeout: float = 30.0       # Request timeout in seconds
)
```

### Endpoints & Methods

#### Health

- `async health() -> bool`: Ping `/health` to check if the backend is up

#### Applications

- `async list_applications(status: str | None = None) -> list[Application]`: GET `/api/applications?status=...`
- `async get_application(name: str) -> Application`: GET `/api/applications/{name}`
- `async create_application(company: str, position: str, url: str) -> Application`: POST `/api/applications`

#### Dashboard & Stats

- `async get_dashboard() -> DashboardData`: GET `/api/dashboard` — aggregated funnel data
- `async get_stats() -> StatsData`: GET `/api/stats` — timeline and funnel metrics

#### Targets & Actions

- `async list_targets() -> list[Target]`: GET `/api/targets` — all allowed Make targets
- `async execute_action(target: str, app: str = "", args: dict[str, str] | None = None) -> ActionResult`: POST `/api/actions/{target}` — synchronous execution with fallback
- `async get_action_status(job_id: str) -> ActionResult`: GET `/api/actions/jobs/{job_id}` — poll job status
- `async stream_action(target: str, app: str = "") -> AsyncIterator[str]`: WebSocket `/ws/actions/{target}` — real-time output streaming

#### Settings

- `async get_settings() -> dict[str, Any]`: GET `/api/settings`
- `async update_settings(settings: dict[str, Any]) -> dict[str, Any]`: PUT `/api/settings`

#### Lifecycle

- `async close() -> None`: Close the underlying httpx client
- `async __aenter__() -> CvApiClient`: Context manager entry
- `async __aexit__() -> None`: Context manager exit (calls close)

### Error Handling

All non-2xx responses raise `APIError`:

```python
class APIError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message
```

The client parses JSON response bodies to extract the `"message"` field; if that fails, `resp.text` is used.

### WebSocket Streaming

`stream_action()` connects to a WebSocket endpoint and yields raw JSON strings:

```python
async for raw in client.stream_action("tailor", app="my-app"):
    msg = json.loads(raw)  # {"type": "stdout", "data": "..."}
    if msg["type"] == "stdout":
        output.append(msg["data"])
```

The `ActionsScreen` parses these messages and displays them in real-time.

## Configuration System

### load_config(path: str | None = None) -> dict[str, Any]

Loads configuration from a TOML file with environment variable overrides.

### Lookup Order

1. File at `path` (if provided via `--config`)
2. `~/.config/cv/config.toml` (shared config location)
3. Built-in defaults

### Structure

```toml
[api]
base_url = "http://localhost:3001"
api_key = "your-api-key"
timeout = 30.0

[ui]
theme = "catppuccin-mocha"
date_format = "%Y-%m-%d"
```

### Environment Overrides

Set these variables to override config file values:

- `CV_API_URL` → `api.base_url`
- `CV_API_KEY` → `api.api_key`
- `CV_TIMEOUT` → `api.timeout` (converted to float)

### Implementation

`load_config()` performs a deep merge: file values override defaults, then environment variables override both.

Example:
```python
cfg = load_config()
base_url = cfg["api"]["base_url"]     # From file or env
api_key = cfg["api"]["api_key"]       # Required for auth
```

## Data Flow

### High-Level Architecture

```
CLI Entry
  └─ __main__.py::main()
      ├─ Parse arguments (--config, --version)
      ├─ load_config() → dict[str, Any]
      ├─ CvApiClient(base_url, api_key, timeout)
      └─ CVApp(client)
          └─ on_mount()
              ├─ client.health()
              └─ DashboardScreen, ApplicationsScreen, ...
                  └─ on_mount()
                      └─ run_worker(self._load())
                          └─ await client.list_applications()
                              └─ httpx.get("/api/applications")
                                  └─ [Application.model_validate(...)]
                                      └─ widget.update(...)
```

### Request Flow

1. **Screen** calls `await client.method(...)`
2. **CvApiClient** constructs httpx request with headers and parameters
3. **httpx** sends HTTP request to cv-api
4. **cv-api** returns JSON
5. **CvApiClient** parses with Pydantic and returns typed model
6. **Screen** formats data and updates UI widgets

### Error Propagation

Errors bubble up to the calling screen's exception handler:

```python
try:
    data = await client.get_dashboard()
except APIError as e:
    widget.update(f"[red]API Error: {e.message}[/red]")
except Exception as e:
    widget.update(f"[red]Unexpected error: {e}[/red]")
```

## Key Design Decisions

### 1. Pydantic v2 for Models

**Why**: Type safety, runtime validation, and easy JSON serialization.

**Benefits**:
- Automatic validation when parsing API responses
- IDE autocomplete for model fields
- Clear schema documentation
- Easy to extend with custom validators

**Example**:
```python
app = Application.model_validate(resp.json())
# Raises ValidationError if response doesn't match schema
```

### 2. TTL In-Memory Cache (Future Enhancement)

**Why**: Reduce API load for frequently accessed static data (e.g., targets list).

**How**: Store responses with timestamp; reuse if `time.monotonic() - entry.timestamp < TTL`.

**When to invalidate**: After mutations (create, update, delete), refresh on manual `Ctrl+R`.

### 3. Cross-Platform Configuration via Standard Paths

**Why**: Support macOS, Linux, Windows with a single approach.

**How**: Uses `~/.config/cv/config.toml` (Linux/macOS standard).

**Future**: Migrate to `platformdirs` for OS-specific paths:
- macOS: `~/Library/Application Support/cv/config.toml`
- Windows: `%APPDATA%\cv\config.toml`
- Linux: `~/.config/cv/config.toml`

### 4. StrEnum for Application Status

**Why**: Bridge between Python enums and API string responses.

**How**: `class ApplicationStatus(StrEnum): APPLIED = "applied"` can be used as a string directly.

**Benefit**: Type-safe status comparisons while maintaining JSON/API compatibility.

### 5. WebSocket for Streaming Output

**Why**: Real-time, bidirectional communication for long-running Make targets.

**How**: Use `websockets` library for async WebSocket support.

**Advantage over polling**:
- No latency between output lines and display
- Single persistent connection vs. repeated HTTP requests
- Clean closure when action completes

**Fallback**: If WebSocket fails, `ActionsScreen` falls back to `execute_action()` (synchronous).

### 6. Async/Await Everywhere

**Why**: TUI remains responsive while loading data or running actions.

**How**: All screens use `run_worker(async_task)` to avoid blocking the main thread.

**Pattern**:
```python
def on_mount(self) -> None:
    self.run_worker(self._load(), exclusive=True)

async def _load(self) -> None:
    # Long-running I/O doesn't block UI
    data = await client.get_dashboard()
```

### 7. Modular Screen Architecture

**Why**: Each tab is independent, making the app scalable and testable.

**How**: All screens inherit from `Screen`, receive `client` at init, and manage their own state.

**Benefits**:
- Easy to add new tabs (just subclass `Screen`)
- Screens load data independently; one slow screen doesn't block others
- Pushed screens (detail, dialogs) don't interfere with tab state

### 8. Textual Framework Choice

**Why**: Mature TUI framework with Pythonic API, theme support, and async-first design.

**Features used**:
- `TabbedContent` for tab navigation
- `DataTable` for sortable lists
- `Screen` for pushing modal dialogs
- Built-in key binding system
- CSS styling with theme variables

---

## Contributing

When adding new features, follow these patterns:

1. **New tab screen?** Inherit from `Screen`, implement `compose()`, `on_mount()` with `_load()`, and add to `CVApp` tabs.
2. **New API endpoint?** Add method to `CvApiClient`, define Pydantic model in `models.py`.
3. **New data model?** Subclass `BaseModel` in `models.py` with field type hints.
4. **Error case?** Catch and display in the UI; don't crash the app.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and style guidelines.
