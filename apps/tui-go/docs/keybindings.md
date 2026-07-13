# Keybindings reference

cv-tui-go uses vim-style keybindings throughout. Most keys work the same across all views; per-view keys are documented separately.

## Global keys

These keys are active in every view except Application Detail, where `q` goes back instead of quitting.

| Key | Action |
|-----|--------|
| `q` | Quit (goes back to list when inside Application Detail) |
| `Ctrl+C` | Force quit immediately |
| `?` | Toggle help overlay |
| `Tab` | Cycle to the next view (Dashboard → Applications → Kanban → Actions → Stats → Audit → Dashboard) |
| `Esc` | Go back / close modal / cancel current operation |
| `1` | Switch to Dashboard |
| `2` | Switch to Applications list |
| `3` | Switch to Kanban board |
| `4` | Switch to Action runner |
| `5` | Switch to Stats |
| `6` | Switch to Audit |

## Navigation keys

These keys are available in all list and board views.

| Key | Aliases | Action |
|-----|---------|--------|
| `j` | `Down` | Move cursor down |
| `k` | `Up` | Move cursor up |
| `h` | `Left` | Move left (Kanban: previous column) |
| `l` | `Right` | Move right (Kanban: next column) |
| `g` | — | Jump to top of list |
| `G` | — | Jump to bottom of list |
| `Enter` | — | Select highlighted item / confirm |
| `/` | — | Open filter input |
| `R` | — | Refresh data from the API |

## Dashboard (view 1)

| Key | Action |
|-----|--------|
| `R` | Reload dashboard data from cv-api |

No item selection is available in the Dashboard. It is read-only.

## Applications list (view 2)

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate rows |
| `g` / `G` | Jump to first / last row |
| `Enter` | Open Application Detail for the selected application |
| `/` | Start filter — type to search by company, position, or directory name |
| `Esc` (in filter) | Clear filter and return to normal navigation |
| `Enter` (in filter) | Confirm filter and return to normal navigation |
| `n` | Create new application (opens form) |
| `d` | Delete the selected application (requires confirmation) |
| `R` | Refresh the application list |

Filter matching is case-insensitive and searches across company name, position, and internal directory name simultaneously.

## Application Detail (view 2 → detail)

The Detail view is entered by pressing `Enter` on any row in the Applications list. It provides quick-action keys for common operations.

### Quick actions

| Key | Action |
|-----|--------|
| `t` | Tailor CV with theme selection |
| `v` | Review (runs review target) |
| `b` | Build artifacts |
| `s` | Score/ATS check |
| `p` | Prep interview |
| `B` | Batch apply all themes and generate CVs |
| `N` | Edit notes (opens markdown editor modal) |

### Navigation

| Key | Action |
|-----|--------|
| `r` | Open Action runner pre-filled with this application's name |
| `R` | Refresh the application data |
| `Esc` / `q` | Return to Applications list |

## Kanban board (view 3)

| Key | Action |
|-----|--------|
| `h` / `Left` | Move focus to the previous column |
| `l` / `Right` | Move focus to the next column |
| `j` / `Down` | Move focus to the next card within the current column |
| `k` / `Up` | Move focus to the previous card within the current column |
| `R` | Refresh all application data |

Columns in order: **Applied** → **Interview** → **Offer** → **Rejected** → **Ghosted**

The focused column is highlighted with a blue rounded border. If a column has more cards than the terminal height allows, a `+N more` indicator is shown at the bottom of that column.

## Action runner (view 4)

The runner has three sequential phases: target selection, argument input, and output.

### Phase 1 — Target selection

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate the target list |
| `Enter` | Select the highlighted target and advance to Phase 2 |

### Phase 2 — Argument input

| Key | Action |
|-----|--------|
| `Enter` | Confirm arguments and start execution (advances to Phase 3) |
| `Esc` | Cancel and return to target selection |

If the selected target requires no arguments, Phase 2 is skipped automatically.

### Phase 3 — Output

| Key | Action |
|-----|--------|
| `r` | Re-run the same target with the same arguments (available after completion) |
| `Esc` | Return to target selection and clear output |

## Stats (view 5)

| Key | Action |
|-----|--------|
| `R` | Reload statistics from cv-api |

The Stats view is read-only. It displays a funnel chart and a monthly activity chart.

## Audit (view 6)

### Phase 1 — Application selection

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate applications |
| `Enter` | Start audit on selected application |

### Phase 2 — Audit results

| Key | Action |
|-----|--------|
| `r` | Re-run audit on the same application |
| `Esc` | Return to application selection |

## Modals (forms and overlays)

Modal overlays capture all keyboard input while active. Available modals are:

### New Application form

| Key | Action |
|-----|--------|
| `Tab` | Move to next field (company → position → URL) |
| `Shift+Tab` | Move to previous field |
| `Enter` (on last field) | Submit form and create application |
| `Esc` | Cancel and close form |

### Notes editor

| Key | Action |
|-----|--------|
| All printable keys | Edit markdown text |
| `Ctrl+S` | Save notes to disk |
| `Esc` | Cancel without saving |

### Theme picker

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate themes |
| `Enter` | Select theme |
| `Esc` | Cancel selection |

## Navigation pattern summary

```
1  Dashboard     (read-only, R to refresh)
2  Applications  (j/k navigate, Enter to open detail, / to filter, n new, d delete)
   └─ Detail     (t/v/b/s/p/B/N quick actions, r run, R refresh, Esc back)
3  Kanban        (h/l columns, j/k cards, R refresh)
4  Actions       (Enter select/confirm, Esc cancel, r re-run)
5  Stats         (read-only, R to refresh)
6  Audit         (j/k select app, Enter audit, r re-run, Esc back)

Modals:
  New App form   (Tab cycle fields, Enter submit, Esc cancel)
  Notes editor   (Ctrl+S save, Esc cancel)
  Theme picker   (j/k navigate, Enter select, Esc cancel)
```
