# Features Guide

## Quick-Launch Actions

From the application detail view, you can quickly execute common actions without navigating to the action runner.

### Available Actions

Press any of these keys from the detail view:

| Key | Action | Purpose |
|-----|--------|---------|
| `t` | Tailor | Customize CV for this job |
| `v` | Review | Get feedback on CV for this job |
| `b` | Build | Generate CV artifacts (PDF, HTML, etc.) |
| `s` | Score | Rate CV against job description (ATS analysis) |
| `p` | Prep | Generate interview preparation notes |
| `a` | Audit | Run health audit on CV |

### Workflow

1. Browse to an application in the Applications list
2. Press `Enter` to open the detail view
3. Press the action key (e.g., `t` for tailor)
4. Action runs and output streams to your screen in real-time
5. Press `Esc` to return to the detail view

### Example: Score a CV Against Job Description

```
1. Applications list (View 2)
2. Navigate to "acme-software-engineer" with j/k
3. Press Enter → opens detail view
4. Press s → runs ATS scoring action
5. View output: "Match score: 82/100"
6. Press Esc → back to detail view
```

## CV Health Audit

The audit feature analyzes your CV for quality issues and provides a detailed score.

### Accessing Audit

- **From detail view**: Press `a` to audit the current application
- **From any view**: Press `n` to open the audit dialog

### What Audit Checks

The audit analyzes several dimensions:

1. **Quantification**: Bullet points should include metrics (revenue, percentage improvement, etc.)
2. **Action Verbs**: Check for strong, varied action verbs (Led, Implemented, Optimized, etc.)
3. **Repetition**: Identify overused words and phrases
4. **Completeness**: Verify all required sections are present
5. **Duplicates**: Find near-duplicate or very similar bullet points

### Audit Score

The audit returns a score from 0-100:

- **80-100**: Excellent CV for this application
- **60-79**: Good, but room for improvement
- **40-59**: Needs work, consider revisions
- **0-39**: Significant issues, high priority to fix

### Using Audit Results

After running an audit:

1. Note the low-scoring metrics
2. Use the "Tailor" action to address specific issues
3. Use the "Review" action to get detailed feedback
4. Run audit again to verify improvements

### Example

```
Running audit on "acme-software-engineer"

Score: 72/100

Quantification: 85% (Good)
Action Verbs: 80% (Good)
Repetition: 65% (Needs work - "implemented" used 4 times)
Completeness: 95% (Excellent)
Duplicates: 1 near-duplicate found

Overused words:
  - "implemented" (4 times)
  - "team" (3 times)

Duplicate bullets:
  - Line 12 vs Line 18 (92% similar)
```

## Create Application Dialog

Quickly add a new application to track without leaving the TUI.

### Opening the Dialog

Press `n` from any view to open the Create Application dialog.

### Form Fields

The dialog has three fields:

1. **Company** (required): Name of the company
2. **Position** (required): Job title
3. **URL** (optional): Link to job posting

### Navigation

- **Tab**: Move to next field
- **Enter**: Submit form (when on last field)
- **Esc**: Cancel and return to previous view

### Workflow

```
1. Press n → Create Application dialog opens
2. Type "Acme Corp" for company
3. Press Tab → move to position field
4. Type "Senior Engineer"
5. Press Tab → move to URL field
6. Type "https://jobs.acme.com/senior-eng"
7. Press Enter → application created
8. Dialog closes, applications list refreshes
```

### Error Handling

If creation fails (e.g., duplicate company/position):

```
Error: Application already exists
Please change company or position
```

Fix the issue and try again, or press Esc to cancel.

## Audit View

The dedicated audit view lets you select any application and run a detailed health analysis.

### Accessing Audit View

Press `a` from an application detail view to open the audit view.

### Application Selection

1. Use `j`/`k` to navigate the application list
2. Press `Enter` to run audit on the selected application
3. Audit runs and displays results

### Results Display

After audit completes, you see:

- **Overall score**: 0-100 rating
- **Metric breakdown**: Individual scores for quantification, verbs, repetition, etc.
- **Visual bars**: Bar chart showing score for each metric
- **Issues**: List of specific problems found
- **Recommendations**: Suggestions for improvement

### Navigation

- `j`/`k`: Navigate applications to audit
- `Enter`: Run audit
- `Esc`: Close and return to previous view

## Responsive Caching

The TUI automatically caches API responses to improve performance and reduce server load.

### How Caching Works

Responses are cached with a time-to-live (TTL):

| Data | TTL |
|------|-----|
| Applications list | 60 seconds |
| Dashboard data | 60 seconds |
| Statistics | 60 seconds |
| Action targets | 300 seconds |

Within the TTL window, data is served from cache. After expiry, the next request fetches fresh data.

### Benefits

- **Faster navigation**: Switching views doesn't require API calls
- **Lower bandwidth**: Fewer requests to the server
- **Offline tolerance**: Brief network outages don't break the TUI
- **Better UX**: Instant response times

### Manual Refresh

To force a cache refresh and fetch the latest data:

- **Dashboard view**: Press `R`
- **Stats view**: Press `R`
- **Other views**: Data refreshes automatically when you navigate

## Environment-Based Configuration

Override API connection settings without editing config files.

### Use Cases

- **Staging vs. Production**: Point TUI to different API servers
- **CI/CD**: Inject credentials without storing secrets
- **Testing**: Use mock servers or local APIs
- **Temporary debugging**: Override timeout for slow networks

### Environment Variables

```bash
# Override API URL
CV_API_URL=http://staging.api.local cv-rs

# Override API key
CV_API_KEY=staging-key cv-rs

# Override timeout
CV_TIMEOUT=120 cv-rs

# Combine multiple overrides
CV_API_URL=http://staging.api.local \
CV_API_KEY=staging-key \
CV_TIMEOUT=120 \
cv-rs
```

### Priority Order

When cv-tui-rs starts, it applies configuration in this order (later overrides earlier):

1. **Default values** (built-in)
2. **Config file** (`~/.config/cv/config.toml`)
3. **Environment variables** (`CV_API_URL`, `CV_API_KEY`, `CV_TIMEOUT`)

This means you can set most config in the file and override specific values per invocation.

### Examples

**Using different servers:**

```bash
# Production (from config file)
cv-rs

# Staging server
CV_API_URL=https://staging-api.acme.com cv-rs

# Local development
CV_API_URL=http://localhost:3001 CV_API_KEY=dev-key cv-rs
```

**Debugging slow networks:**

```bash
# Increase timeout to 2 minutes
CV_TIMEOUT=120 cv-rs
```

**CI/CD pipelines:**

```bash
# Inject credentials from secrets manager
CV_API_URL=$STAGING_API_URL \
CV_API_KEY=$STAGING_API_KEY \
cv-rs
```

## Retry & Resilience

The TUI automatically retries failed API calls with intelligent backoff.

### Automatic Retries

Transient errors (network timeouts, server errors) trigger automatic retries:

```
Initial request → fails (timeout)
Wait 500ms → Retry 1 → fails
Wait 1s → Retry 2 → fails
Wait 2s → Retry 3 → success!
```

### Behavior

- **Retries**: Up to 3 attempts on transient errors
- **Exponential backoff**: 500ms, 1s, 2s delays between attempts
- **Non-retryable errors**: 4xx (client errors) fail immediately
- **User feedback**: Error message shown if all retries fail

### Network Issues Handled

- Connection refused
- DNS resolution failures
- Request timeouts
- Server 5xx errors
- WebSocket disconnects

## WebSocket Streaming

When you run actions, output streams to your screen in real-time over WebSocket.

### How It Works

1. You select an action from the detail view (or action runner)
2. TUI opens WebSocket connection to the API server
3. Action runs on the server and sends output line-by-line
4. TUI displays each line as it arrives
5. Connection closes when action completes

### Benefits

- **Real-time feedback**: See action progress immediately
- **No polling**: Efficient, no wasteful periodic requests
- **Streaming output**: Large outputs handled gracefully
- **Cancellable**: Press `Ctrl+C` to stop the action

### Example Output

```
$ [action: tailor on acme-software-engineer]

Loading CV...
Reading job description...
Analyzing alignment...
Tailoring CV for role...
Generating output...
Done! CV tailored successfully.

[Press any key to continue]
```

### Fallback

If WebSocket connection fails, the TUI falls back to HTTP polling:

1. Requests action via HTTP POST
2. Polls for completion every 500ms
3. Still shows output, just not in real-time

This ensures actions can complete even if WebSocket isn't available.
