# Architecture

## System overview

cv-tui-go is a pure TUI client. It holds no local state beyond what is loaded from the config file. All application data lives in cv-api, which in turn manages the CV project's filesystem (YAML files, generated PDFs, Makefile targets).

```
+---------------------+
|     cv-tui-go       |
|  (this repository)  |
|                     |
|  Bubbletea (TEA)    |
|  lipgloss styles    |
|  gorilla/websocket  |
+----------+----------+
           |
           |  HTTP GET/POST  (X-API-Key header)
           |  WebSocket      (?token= query param)
           v
+----------+----------+
|       cv-api        |
|  Go HTTP server     |
|  :3001              |
+----------+----------+
           |
           |  os/exec  (Make)
           v
+----------+----------+
|         CV          |
|  YAML + Makefile    |
|  Python scripts     |
+---------------------+
```

cv-web (Next.js) and cv-tui-rs (Ratatui/Rust) are independent clients that also talk to cv-api over the same HTTP interface. The config file at `~/.config/cv/config.toml` is shared between cv-tui-go and cv-tui-rs.

## Component diagram

```
cmd/cv/main.go
  |-- flag.Parse()        CLI flag handling (--config, --version, --health, --verbose/-v)
  |-- config.Load()       TOML + env + defaults (with permission checks)
  |-- api.New()           HTTP client construction (with cache, retry logic)
  |-- ui.New()            root model construction
  `-- tea.NewProgram()    Bubbletea event loop (alt-screen)

internal/config/
  `-- config.go           Config struct, Load() (with file permission warnings),
                          DefaultPath(), env overrides

internal/api/
  |-- client.go           *Client: get(), post(), put(), do(), auth, caching
  |                       (TTL-based cache with RWMutex, retry logic)
  |-- models.go           Application, Target, ActionResult, WSMessage, ...
  |-- applications.go     ListApplications, GetApplication, CreateApplication,
  |                       GetDashboard, GetStats
  |-- actions.go          ExecuteAction, GetActionStatus, ListTargets,
  |                       StreamAction (WebSocket with TLS 1.2+, X-API-Key header)
  `-- settings.go         GetSettings, UpdateSettings

internal/ui/
  |-- app.go              Root App model: 6 main views, modal overlay, routing
  |-- common/
  |   |-- styles.go       Multiple theme palettes, shared lipgloss styles
  |   `-- keys.go         Global KeyMap with detail quick-action bindings
  |-- dashboard/
  |   `-- dashboard.go    View 1: loading spinner, DashboardData, bar renderer
  |-- apps/
  |   |-- list.go         View 2: pagination, in-memory filter, SelectedMsg
  |   `-- detail.go       View 2a: app metadata, quick actions (t/v/b/s/p/B/N)
  |-- kanban/
  |   `-- board.go        View 3: col/row cursor, per-status grouping
  |-- actions/
  |   `-- runner.go       View 4: 3-phase flow, WebSocket streaming via channels
  |-- stats/
  |   `-- stats.go        View 5: funnel chart, monthly activity chart
  |-- audit/
  |   `-- audit.go        View 6: app selection, streaming audit execution,
  |                       metrics/score display
  `-- forms/
      |-- new_app.go      NewAppForm modal: 3 text fields (company/position/url)
      |-- notes.go        NotesForm modal: markdown textarea per-app
      `-- theme.go        ThemeForm modal: theme selection list
```

## The TEA pattern (The Elm Architecture)

Bubbletea implements TEA: every model is a value type that exposes three methods.

```
Init() tea.Cmd
  Runs once when the model becomes active.
  Returns a tea.Cmd that fires the first async operation (e.g. data fetch).

Update(tea.Msg) (tea.Model, tea.Cmd)
  Pure function. Receives a message, returns the next state and an optional
  command that will produce the next message.

View() string
  Pure function. Renders the current state as a string using lipgloss.
```

### Root model routing

`ui.App` is the single root model registered with `tea.NewProgram`. It holds one instance of each sub-model and routes messages:

```
tea.Msg received by App.Update
  |
  +-- Global keys (1-5, Tab, q, Ctrl+C)  handled by App
  |
  +-- apps.SelectedMsg                   App switches to ViewApplicationDetail
  |                                      creates apps.DetailModel
  +-- apps.RunActionMsg                  App switches to ViewActions
  |                                      creates actions.RunnerModel
  |
  `-- all other messages                 delegated to the active sub-model
```

Sub-models communicate upward through typed message structs (`SelectedMsg`, `RunActionMsg`). They never call methods on the parent directly.

### Lazy initialization

Sub-models are initialized on first activation rather than at startup. The `App.initialized` map tracks which views have been initialized. This avoids unnecessary API calls when the user has not visited a view.

```go
func (a *App) switchView(v View) tea.Cmd {
    if !a.initialized[v] {
        a.initialized[v] = true
        return subModel.Init()  // triggers data fetch
    }
    return nil  // already loaded, no extra fetch
}
```

## Message flow — example: open application detail

```
User presses Enter on a row in the Applications list
  -> apps.ListModel.Update receives tea.KeyMsg{Type: KeyEnter}
  -> returns SelectedMsg{App: ...} as a tea.Cmd

Bubbletea delivers SelectedMsg to App.Update
  -> App creates apps.NewDetail(client, app.Name)
  -> sets currentView = ViewApplicationDetail
  -> returns appDetail.Init() as the next Cmd

apps.DetailModel.Init() fires two commands:
  -> spinner.Tick (for the loading animation)
  -> fetchDetail() goroutine -> GET /api/applications/{name}

Response arrives as detailMsg{app}
  -> apps.DetailModel.Update stores the data, clears loading flag
  -> App.View delegates to appDetail.View() which renders fields
```

## API client design

`api.Client` is a thin, synchronous HTTP wrapper with built-in caching and retry logic. It is not an interface — callers receive `*api.Client` directly.

### Authentication

A static API key is used for authentication:
- HTTP: `X-API-Key` request header (secure, not sent in URL)
- WebSocket: `X-API-Key` header (not query parameter, to keep credentials out of logs)

### Caching

The client maintains an internal TTL-based cache protected by `sync.RWMutex`:
- `GET /api/targets` cached for 300 seconds
- Other endpoints (applications, dashboard, stats) invalidated after mutations (POST/PUT)
- Cache methods: `cacheGet()`, `cacheSet()`, `cacheInvalidate()`

### Retry logic

GET requests (idempotent) are automatically retried up to 3 times with exponential backoff (500ms initial, doubling). POST/PUT requests are not retried (not idempotent).

### Response size limits

- HTTP responses limited to 10 MB per request (via `io.LimitReader`)
- WebSocket messages limited to 1 MB per message (via `SetReadLimit`)

### Error handling

Error responses from cv-api follow a JSON envelope `{"code": N, "message": "..."}`. The client decodes this into `api.APIError` and wraps it into a Go `error`.

### WebSocket streaming

`StreamAction` opens a WebSocket with security hardening:
- Custom dialer enforcing TLS 1.2 or higher (`MinVersion: tls.VersionTLS12`)
- 15-second handshake timeout
- X-API-Key passed in request headers (not query string)
- Per-message read limit of 1 MB

The method reads messages in a loop until an `"exit"` or `"error"` type is received. Each message is delivered via a callback function.

In the TUI, the `audit.Model` and `actions.RunnerModel` wrap streaming in a Go goroutine that sends messages to a channel, which is then converted to Bubbletea messages:

```go
// Simplified pattern
ch := make(chan api.WSMessage, 100)
go func() {
    defer close(ch)
    client.StreamAction(target, app, func(msg api.WSMessage) {
        ch <- msg
    })
}()
// Return a tea.Cmd that reads from the channel and emits streamMsg
```

This allows the TUI to remain responsive while the action streams in real time.

## State management

State is immutable by convention: `Update` methods receive value receivers and return a new model value. Pointer receivers are only used for helper methods that modify fields in place (`ensureVisible`, `clampRow`), consistent with Go idiomatic practice where the receiver matches the method's intent.

Each sub-model owns its own state:
- Loading flag and spinner
- Fetched data (`*api.DashboardData`, `[]api.Application`, etc.)
- Cursor position
- Error value

No global shared state exists between sub-models.

## Error handling strategy

Errors surface through the TEA message system. Each async operation returns either a data message or an `errMsg{err error}` value. The model stores the error and renders it using `common.ErrorStyle` in its `View()`. The user can retry by pressing `R` (refresh) where available.

The binary exits non-zero only for unrecoverable startup errors (config parse failure, missing required fields). Runtime API errors are shown inline and are recoverable.

## Styling and themes

All colours are defined as `lipgloss.Color` constants in `internal/ui/common/styles.go`. Multiple theme palettes are supported:
- Catppuccin Mocha (dark, default)
- Catppuccin Latte (light)
- Dracula
- Nord
- Solarized Dark
- Solarized Light

Styles are package-level variables (`TitleStyle`, `MutedStyle`, etc.) referenced by all sub-packages. The active theme is selected via config or the theme picker modal. Theme switching does not require a restart.

## Modal overlay pattern

Modals (NewAppForm, NotesForm, ThemeForm) are rendered as overlays using `lipgloss.Place` to center them within the terminal. The parent App model (`app.go`) manages modal state:
- `modalActive` flag prevents input from reaching sub-views when a modal is open
- `updateModal()` delegates messages to the active modal
- Modal completion messages (e.g., `NewAppSubmittedMsg`) are handled by the parent and trigger appropriate actions

## Security considerations

- **Config file permissions:** The config loader warns if `~/.config/cv/config.toml` is readable by others (mode check `& 0o077`). Users should run `chmod 600` to restrict access.
- **HTTP vs HTTPS:** A startup warning is printed if `http://` is used for a non-localhost URL, as credentials would be sent in plaintext.
- **API authentication:** The static API key is always sent in the `X-API-Key` header (never in query parameters).
- **WebSocket TLS:** Custom dialer enforces TLS 1.2 or higher for `wss://` connections.
- **Response size limits:** Both HTTP and WebSocket responses are capped to prevent unbounded memory allocation.
