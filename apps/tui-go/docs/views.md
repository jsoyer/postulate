# Views

cv-tui-go has six main views accessible by pressing `1` through `6`, or by pressing `Tab` to cycle through them. A tab bar at the top of the screen shows the active view highlighted in blue.

```
 1 Dashboard   2 Applications   3 Kanban   4 Actions   5 Stats   6 Audit
```

---

## 1. Dashboard

**Key:** `1`

The Dashboard is the default view on launch. It gives a quick overview of the entire application pipeline without requiring any navigation.

### Layout

```
Dashboard

  Total applications: 42

  Pipeline
  applied      ████████████░░░░░░░░ 28
  interview    ████░░░░░░░░░░░░░░░░ 8
  offer        █░░░░░░░░░░░░░░░░░░░ 2
  rejected     ███░░░░░░░░░░░░░░░░░ 6
  ghosted      ██░░░░░░░░░░░░░░░░░░ 4

  Recent Applications
  2025-03-07  applied     Acme Corp - Senior Engineer
  2025-03-05  interview   Initech - Platform Lead
  ...

  R refresh
```

### Data sources

| Section | API endpoint |
|---------|-------------|
| Total count | `GET /api/dashboard` → `total_applications` |
| Pipeline breakdown | `GET /api/dashboard` → `by_status` |
| Recent applications | `GET /api/dashboard` → `recent_applications` (up to 8 entries) |

### Behaviour

- Data is fetched once when the view is first activated (lazy initialization).
- A spinner is shown while loading.
- Press `R` to reload from the API.
- The progress bars are proportional to the total number of applications.
- Statuses are always rendered in the fixed order: applied → interview → offer → rejected → ghosted.

---

## 2. Applications list

**Key:** `2`

A scrollable, filterable table of all applications. This is the primary navigation hub — opening an application here leads to the Detail view.

### Layout

```
Applications (42)
  filter: acme

  DATE         STATUS      COMPANY                    POSITION
  2025-03-07   applied     Acme Corp                  Senior Engineer
  2025-02-20   interview   Acme Industries            DevOps Lead
  ...

  j/k navigate  enter open  / filter  R refresh  n new
```

### Columns

| Column | Source field | Notes |
|--------|-------------|-------|
| DATE | `created_at` | Formatted with `ui.date_format` from config |
| STATUS | `status` | Colour-coded badge |
| COMPANY | `company` | Truncated at 25 characters |
| POSITION | `position` | Truncated at 30 characters |

### Filtering

Press `/` to open the inline filter input. Filtering is:
- Case-insensitive
- Applied simultaneously to `company`, `position`, and the internal directory `name`
- Live: the list updates as you type
- Cleared by pressing `Esc`; confirmed (but kept active) by pressing `Enter`

The result count in parentheses updates to reflect the filtered set.

### Navigation

The list scrolls to keep the cursor visible. Use `g` / `G` to jump to the first or last row. Press `Enter` to open the Application Detail view for the selected row.

---

## 2a. Application Detail

**Key:** `Enter` from the Applications list

The Detail view shows all metadata for a single application and provides access to the action runner.

### Layout

```
Acme Corp - Senior Engineer

  Directory:  acme-corp_senior-engineer_2025-03-07
  Status:     applied
  Created:    2025-03-07 14:32
  Deadline:   2025-03-21

  Files
  * meta.yml       1.2 KB
  * cover.md       3.4 KB
  * resume.txt     45.2 KB

  esc back  r run action  R refresh
```

### Fields displayed

| Label | Source field | Notes |
|-------|-------------|-------|
| Directory | `name` | Internal slug used by cv-api and the CV project |
| Status | `status` | Colour-coded badge |
| Created | `created_at` | Date and time |
| Deadline | `deadline` | Shown only when present |
| Outcome | `outcome` | Shown only when present |

### Files section

Files are listed with their name, a type indicator (colour-coded by extension), and size formatted as bytes or KB. Extensions recognised with distinct colours: `.yml`/`.yaml` (yellow), `.md` (blue), `.txt` (muted). All other types use a neutral colour.

### Quick actions

The detail view provides quick-action keys to run common targets without opening the full runner:

| Key | Action | Target |
|-----|--------|--------|
| `t` | Tailor CV | `tailor` (with theme selection modal) |
| `v` | Review | `review` |
| `b` | Build artifacts | `build` |
| `s` | Score/ATS | `score` |
| `p` | Prep interview | `prep` |
| `B` | Batch apply themes | Runs `tailor` for all themes (catppuccin-mocha, catppuccin-latte, dracula, nord) |
| `N` | Edit notes | Opens markdown notes editor modal |

Quick actions run immediately with no arguments (except tailor, which shows a theme picker).

### Navigation and forms

- Press `r` to open the full Action runner with the application name pre-filled.
- Press `R` to refresh the application data from the API.
- Press `Esc` or `q` to return to the Applications list.

---

## 3. Kanban board

**Key:** `3`

A five-column board that groups applications by their current status. It provides a visual pipeline overview and fast column-based navigation.

### Layout

```
Kanban Board

 ╭─────────────╮ ╭─────────────╮ ╭─────────────╮ ╭─────────────╮ ╭─────────────╮
 │ applied (28)│ │interview (8)│ │  offer (2)  │ │rejected (6) │ │ ghosted (4) │
 │             │ │             │ │             │ │             │ │             │
 │ Acme Corp   │ │ Initech     │ │ Globocorp   │ │ MegaCorp    │ │ Vandelay    │
 │ Sr Engineer │ │ Platform Ld │ │ Staff Eng   │ │ Backend Dev │ │ SRE         │
 │             │ │             │ │             │ │             │ │             │
 │ ▶ NextCo    │ │ ...         │ │ ...         │ │ ...         │ │ ...         │
 │ DevOps Lead │ │             │ │             │ │             │ │             │
 ╰─────────────╯ ╰─────────────╯ ╰─────────────╯ ╰─────────────╯ ╰─────────────╯

  h/l columns  j/k cards  R refresh
```

### Columns

| Column | Status value | Colour |
|--------|-------------|--------|
| Applied | `applied` | Blue |
| Interview | `interview` | Yellow |
| Offer | `offer` | Green |
| Rejected | `rejected` | Red |
| Ghosted | `ghosted` | Grey |

### Navigation

- `h` / `l` moves focus between columns. The active column is highlighted with a blue rounded border; inactive columns use a grey border.
- `j` / `k` moves between cards within the focused column.
- When changing columns, the row cursor is clamped to the last card of the new column if necessary.
- If a column has more cards than the terminal height allows, a `+N more` indicator is shown.
- Column width is calculated from the terminal width divided evenly across five columns.

### Data source

Applications are fetched with `GET /api/applications` and grouped in memory by `status`. Press `R` to reload.

---

## 4. Action runner

**Key:** `4`, or `r` from Application Detail, or quick-action keys (t/v/b/s/p/B/N)

The Action runner executes Make targets via cv-api and streams the output in real time over WebSocket. It operates as a three-phase sequential flow.

### Phase 1 — Target selection

A list of all available Make targets returned by `GET /api/targets`. Each target shows its name, category in brackets, and a description.

```
Run Action

  apply          [cv]      Generate and submit application
  cv             [cv]      Regenerate CV for this application
  status         [cv]      Update application status
  stats          [global]  Show pipeline statistics
  ...

  j/k navigate  enter select
```

Press `j`/`k` to navigate, `Enter` to select.

### Phase 2 — Argument input

If the selected target declares arguments, input fields are shown. The `app` argument (application name) is pre-filled when the runner was opened from Application Detail.

```
Run: apply
Generate and submit application

  Application: acme-corp_senior-engineer_2025-03-07

  enter run  esc cancel
```

If the target requires no arguments, this phase is skipped and execution begins immediately.

### Phase 3 — Output

The output pane displays streamed output from the WebSocket connection. Lines arrive in real time as cv-api runs the Make target.

```
Output: apply

  Running...

  [cv] Generating CV for acme-corp_senior-engineer_2025-03-07
  [cv] Compiling LaTeX...
  [cv] Done — resume.pdf generated

  Done

  esc back  r re-run
```

A spinner is shown while the action is in progress. When complete, a green "Done" label appears. Press `r` to re-run the same target with the same arguments, or `Esc` to go back to target selection.

### WebSocket connection

The runner connects to `ws://{base_url}/ws/actions/{target}` with the `X-API-Key` header for authentication. Messages are streamed in real time with a `type` field (`stdout`, `stderr`, `exit`, `error`). The connection closes on `exit` or `error`.

The WebSocket connection is secured with:
- TLS 1.2+ enforcement (for `wss://` endpoints)
- X-API-Key header (not query parameter)
- 1 MB per-message size limit

---

## 5. Stats

**Key:** `5`

The Stats view shows two read-only charts derived from the complete application dataset.

### Layout

```
Pipeline Statistics

  Funnel

  applied    ████████████████████ 28 (67%)
  interview  ████████             8 (19%)
  offer      ██                   2 (5%)
  rejected   ███                  6 (14%)
  ghosted    ██                   4 (10%)

  Monthly Activity

  2025-01   ████████████████████ 12
  2025-02   ████████████         8
  2025-03   ██████               6

  R refresh
```

### Funnel chart

- Horizontal bar chart with bars proportional to each status count relative to the total.
- Each bar uses the status colour (blue for applied, yellow for interview, green for offer, red for rejected, grey for ghosted).
- Percentage shown alongside the count.
- Statuses are always rendered in the fixed pipeline order.

### Monthly activity chart

- One row per month present in the timeline data.
- Bar width is proportional to the highest month's count.
- Rendered in teal.

### Data source

`GET /api/stats` returns `funnel` (a map of status to count) and `timeline` (a slice of date/count pairs). Press `R` to reload.

---

## 6. Audit

**Key:** `6`

The Audit view evaluates the quality of application materials (resume, cover letter, etc.) for a selected application. It runs the `audit` Make target and displays a health score along with detailed metrics.

### Layout

#### Phase 1 — Application selection

```
Audit Application

  Select an application to audit its resume quality.

  > Acme Corp / Senior Engineer                 applied
    Initech / Platform Lead                     interview
    ...

  j/k navigate  enter audit
```

Select an application with `j`/`k`, then press `Enter` to start the audit.

#### Phase 2 — Audit execution and results

```
Audit: acme-corp_senior-engineer_2025-03-07

  Running audit...

  [audit] Analyzing resume...
  [audit] Checking for duplicates...
  [audit] Complete

  Health Score: 85%  ████████████████░░░░  85/100

  Metrics:
    clarity         ██████████░░░░░░░░░░  90
    conciseness     ███████░░░░░░░░░░░░░░  70
    keywords        █████████░░░░░░░░░░░░  80
    impact          ███████████░░░░░░░░░░  85
    format          ██████████░░░░░░░░░░░  88

  Duplicate phrases:
    - "responsible for managing"
    - "led team of engineers"

  Overused words:
    experienced, managed, led, developed

  esc back  r re-run
```

### Result components

| Component | Description |
|-----------|-------------|
| Health Score | Overall quality score (0-100) with visual bar |
| Metrics | Named metric scores (clarity, conciseness, keywords, impact, format, etc.) |
| Duplicate phrases | Common phrases found multiple times |
| Overused words | Words appearing too frequently |

### Streaming output

The audit runs via WebSocket and streams output in real time. Output lines are displayed as they arrive. When the audit completes, the parsed JSON result is displayed with formatted bars and metrics.

### Data source

Press `Enter` on a selected application to execute the `audit` Make target via WebSocket. Results are parsed from the JSON emitted by the audit script. Press `r` to re-run the audit on the same application, or `Esc` to return to application selection.
