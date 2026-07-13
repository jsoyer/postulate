# Architecture

cv-tui-rs is built on a modern async Rust stack with a focus on performance and correctness.

## Tech Stack

- **Ratatui**: Terminal UI framework
- **Tokio**: Async runtime
- **Crossterm**: Terminal input/output
- **Reqwest**: HTTP client
- **Tokio-Tungstenite**: WebSocket support

## High-Level Flow

```
Terminal Input (crossterm)
        ↓
    Event Loop (tokio + mpsc channels)
        ↓
    Action Processing (app.rs)
        ↓
    API Client (with cache + retry)
        ↓
    HTTP/WebSocket to cv-api
        ↓
    State Updates (Arc<Mutex<HashMap>>)
        ↓
    View Rendering (ratatui)
        ↓
    Terminal Output (crossterm)
```

## Module Structure

### Core

- **`main.rs`** - Entry point, config loading, error handling
- **`app.rs`** - Application state machine, View enum, per-view state structs
- **`events.rs`** - Event handling, keybinding mapping (Action enum)
- **`config.rs`** - Config file loading, TOML parsing, environment variable overrides

### API

- **`api/client.rs`** - HTTP/WebSocket client with TTL cache and retry logic
- **`api/models.rs`** - Data structures for API requests/responses

### UI

- **`ui/mod.rs`** - Main render dispatcher
- **`ui/apps.rs`** - Applications list and detail views
- **`ui/audit.rs`** - CV health audit overlay
- **`ui/new_app.rs`** - Create application dialog
- **`ui/dashboard.rs`** - Dashboard with stats
- **`ui/kanban.rs`** - Kanban board visualization
- **`ui/actions.rs`** - Action runner with output streaming
- **`ui/stats.rs`** - Statistics visualization
- **`ui/theme.rs`** - Theme system (Catppuccin Mocha + others)

### Utilities

- **`error.rs`** - Error types and handling
- **`utils.rs`** - Common utilities (truncate, spinner, etc.)

## Event Loop Pattern

The main event loop uses `crossterm` to poll for terminal events and feeds them through an mpsc channel:

```rust
loop {
    // Poll for terminal event (with timeout)
    if let Some(Event::Key(key)) = events::poll(50ms)? {
        action = events::handle_key(key)
    }

    // Process action and update state
    app.update(action)

    // Fetch data from API if needed
    if app.should_fetch() {
        api_client.fetch(...).await
    }

    // Render to terminal
    terminal.draw(|frame| {
        ui::render(frame, &app)
    })?
}
```

## View & State Separation

The application uses a strict separation between views (rendered UI) and state (data):

```rust
pub enum View {
    Dashboard = 0,
    Apps = 1,
    AppDetail = 2,
    Kanban = 3,
    Actions = 4,
    Stats = 5,
    Audit = 6,        // Overlay
    NewApp = 7,       // Overlay
}

pub struct App {
    current_view: View,

    // Per-view state
    dashboard: DashboardState,
    apps: AppsState,
    app_detail: AppDetailState,
    kanban: KanbanState,
    actions: ActionsState,
    stats: StatsState,
    audit: AuditState,
    new_app: NewAppState,
}
```

Views are rendered based on `current_view`, and overlay views (Audit, NewApp) are rendered on top of the base view.

## Cache Design

The API client implements a TTL (Time-To-Live) cache to reduce network calls:

```rust
struct CacheEntry {
    value: Value,
    expires: Instant,
}

type Cache = Arc<Mutex<HashMap<String, CacheEntry>>>;
```

**Cache TTLs:**
- Applications: 60 seconds
- Dashboard: 60 seconds
- Stats: 60 seconds
- Targets: 300 seconds (5 minutes)

Before making an API call, the client checks if a cached entry exists and is still valid:

```rust
if let Some(cached) = cache.get("applications") {
    if cached.is_valid() {
        return cached.value
    }
}
// Otherwise fetch from API
```

## Retry & Backoff Strategy

The API client implements exponential backoff with 3 attempts:

```
Attempt 1: 500ms delay
Attempt 2: 1s delay
Attempt 3: 2s delay
```

On failure, the client waits and retries automatically. This improves resilience for temporary network issues.

## WebSocket Streaming

For action execution, the client establishes a WebSocket connection and streams output in real-time:

```rust
let (ws_stream, _) = connect_async(&ws_url).await?;
let (mut writer, mut reader) = ws_stream.split();

// Send action request
writer.send(Message::Text(action_json)).await?;

// Stream messages
while let Some(msg) = reader.next().await {
    match msg? {
        Message::Text(text) => {
            // Append to output buffer
        }
        Message::Close(_) => break,
    }
}
```

The TUI updates the action output pane in real-time as messages arrive.

## Configuration System

Configuration is loaded in this order (later overrides earlier):

1. **Default values** - Baked into the code
2. **Config file** - `~/.config/cv/config.toml`
3. **CLI flags** - `--api-url`, `--api-key` (not yet exposed)
4. **Environment variables** - `CV_API_URL`, `CV_API_KEY`, `CV_TIMEOUT`

This allows flexibility for different environments:

```bash
# Production (from config file)
cv-rs

# Staging (override URL and key)
CV_API_URL=http://staging.api.local CV_API_KEY=staging-key cv-rs

# Testing (fast timeout)
CV_TIMEOUT=10 cv-rs
```

## Theme System

The theme system is modular and uses Catppuccin Mocha as the default:

```rust
pub struct CatppuccinMocha;

impl CatppuccinMocha {
    const BASE: Color = Color::Rgb(30, 30, 46);
    const BLUE: Color = Color::Rgb(137, 180, 250);
    const MAUVE: Color = Color::Rgb(186, 134, 254);
    // ... other colors
}
```

All UI components use colors from the theme for consistency. Themes can be swapped by changing a single constant or implementing a new theme struct.

## Error Handling

Errors are centralized in `error.rs` with an `AppError` enum:

```rust
pub enum AppError {
    Config(String),
    Api(String),
    Io(std::io::Error),
    SerdeJson(serde_json::Error),
    // ...
}

pub type Result<T> = std::result::Result<T, AppError>;
```

All error variants implement `Display` for user-friendly error messages in the UI.

## Async Pattern

The application uses Tokio's runtime with spawn tasks:

- Main event loop runs on the blocking executor
- API calls (HTTP, WebSocket) run on async tasks
- State updates are protected with `Arc<Mutex<T>>` for thread-safe sharing

```rust
let client = api_client.clone();
tokio::spawn(async move {
    match client.list_applications().await {
        Ok(apps) => app.apps.apps = apps,
        Err(e) => app.apps.error = Some(e.to_string()),
    }
});
```

## Performance Optimizations

1. **Binary size** - Minimal dependencies, ~5 MB release binary
2. **Startup time** - Direct terminal access, no external processes, <10ms
3. **Memory usage** - Efficient state structures, cached data
4. **Network** - TTL cache reduces redundant API calls
5. **Rendering** - Only changed regions re-rendered (ratatui handles this)

## Testing Strategy

Current approach:
- Integration tests mock API responses
- Manual testing for UI behavior
- Performance baseline: startup time, memory usage

Future improvements:
- Snapshot tests for UI rendering
- Property-based testing for data parsing
- E2E test harness for workflows

## Adding a New Feature

To add a new feature (e.g., a new view):

1. **Define state** - Add struct to `app.rs`
2. **Add view variant** - Add to `View` enum
3. **Add actions** - Add keybindings to `events.rs`
4. **Handle actions** - Add match arm in `app.update()`
5. **Render view** - Create `ui/myfeature.rs` and call from `ui::render()`
6. **Fetch data** - Use `api_client` to get data
7. **Update docs** - Add keybindings to `docs/keybindings.md`

Example: Adding a search view

```rust
// 1. app.rs
pub enum View {
    // ... other views
    Search = 8,
}

pub struct SearchState {
    query: String,
    results: Vec<Application>,
    // ...
}

// 2. events.rs
pub enum Action {
    // ... other actions
    Search,
}

KeyCode::Char('/') => Action::Search,

// 3. app.rs - handle action
Action::Search => {
    app.current_view = View::Search;
}

// 4. ui/search.rs
pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    // Render search results
}

// 5. Fetch data
let results = app.api_client.search(&query).await?;

// 6. docs/keybindings.md
- Add search keybindings
```

## Code Style

- **Rust**: idiomatic Rust, follow clippy lints
- **Functions**: explicit over clever, prefer readability
- **Comments**: explain "why", not "what"
- **Errors**: use `Result<T>` and propagate with `?`
- **Async**: use `.await` and Tokio spawn for background tasks

## Debugging

Enable debug output with environment variable:

```bash
RUST_LOG=debug cv-rs
```

Or rebuild with debug symbols:

```bash
make debug
```

Then use a debugger (lldb on macOS, gdb on Linux):

```bash
lldb target/debug/cv-rs
```
