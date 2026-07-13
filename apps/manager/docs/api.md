# API Reference

All routes are Next.js API routes under `/api`. The app acts as a proxy to the cv-api Go backend. All error responses share the shape `{ error: string }`.

---

## Applications

### GET /api/applications

List all applications, optionally filtered by status.

**Query parameters**

| Parameter | Type   | Required | Description                                              |
|-----------|--------|----------|----------------------------------------------------------|
| `status`  | string | No       | Filter by status: `applied`, `interview`, `offer`, `rejected`, `ghosted` |

**Response**

```json
{
  "applications": [
    {
      "name": "2026-02-databricks",
      "company": "Databricks",
      "position": "Senior Engineer",
      "status": "applied",
      "created_at": "2026-02-10T09:00:00Z",
      "deadline": "2026-03-01T00:00:00Z",
      "outcome": null
    }
  ]
}
```

The `files` field is absent on list responses. It is only populated on the detail route.

Note: `GET /api/applications/list` is an alias for this route with identical behaviour.

---

### GET /api/applications/{name}

Retrieve a single application including its associated files.

**Path parameters**

| Parameter | Type   | Description                          |
|-----------|--------|--------------------------------------|
| `name`    | string | Application folder name, e.g. `2026-02-databricks` |

**Response**

```json
{
  "name": "2026-02-databricks",
  "company": "Databricks",
  "position": "Senior Engineer",
  "status": "interview",
  "created_at": "2026-02-10T09:00:00Z",
  "deadline": "2026-03-01T00:00:00Z",
  "outcome": null,
  "files": {
    "job.txt": "...",
    "meta.yml": "...",
    "cv-tailored.yml": "..."
  }
}
```

Returns `404` when the application does not exist.

---

### POST /api/applications

Create a new application.

**Request body**

```json
{
  "company": "Databricks",
  "position": "Senior Engineer",
  "url": "https://example.com/job"
}
```

| Field      | Type   | Required | Description              |
|------------|--------|----------|--------------------------|
| `company`  | string | Yes      | Company name             |
| `position` | string | Yes      | Job title                |
| `url`      | string | No       | Link to the job posting  |

**Response**

```json
{
  "success": true,
  "application": {
    "name": "2026-03-databricks",
    "company": "Databricks",
    "position": "Senior Engineer",
    "status": "applied",
    "created_at": "2026-03-10T09:00:00Z"
  }
}
```

---

### PATCH /api/applications/{name}/stage

Update the pipeline stage (status) of an application.

**Path parameters**

| Parameter | Type   | Description              |
|-----------|--------|--------------------------|
| `name`    | string | Application folder name  |

**Request body**

```json
{
  "stage": "interview"
}
```

| Field   | Type   | Required | Description                                                   |
|---------|--------|----------|---------------------------------------------------------------|
| `stage` | string | Yes      | New status: `applied`, `interview`, `offer`, `rejected`, `ghosted` |

**Response**

```json
{
  "success": true,
  "stage": "interview"
}
```

---

### PATCH /api/applications/{name}/meta

Update application metadata (company, position, follow-up date).

**Path parameters**

| Parameter | Type   | Description              |
|-----------|--------|--------------------------|
| `name`    | string | Application folder name  |

**Request body**

```json
{
  "company": "Databricks",
  "position": "Staff Engineer",
  "followup_date": "2026-03-20"
}
```

All fields are optional. Only provided fields are updated.

**Response**

```json
{ "ok": true }
```

---

## Actions

### POST /api/actions/{target}

Execute a Make target via cv-api. This is the primary way to trigger AI generation, CV tailoring, PDF export, and all other automation targets.

**Path parameters**

| Parameter | Type   | Description                        |
|-----------|--------|------------------------------------|
| `target`  | string | Make target name, e.g. `tailor-cv` |

**Request body**

```json
{
  "application": "2026-02-databricks",
  "args": {
    "AI": "claude",
    "STAGE": "technical"
  }
}
```

| Field         | Type                    | Required | Description                                                        |
|---------------|-------------------------|----------|--------------------------------------------------------------------|
| `application` | string                  | No       | Application folder name passed to the Make target as `NAME=`       |
| `args`        | Record\<string, string\> | No       | Additional Make variables passed verbatim                          |

Top-level keys other than `application` and `args` are promoted to `args` with uppercased keys for backwards compatibility with legacy routes.

**Response**

```json
{
  "success": true,
  "job_id": "abc123",
  "target": "tailor-cv",
  "status": "completed",
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "duration_ms": 4200
}
```

The response merges `{ success: true }` with the `ActionResult` shape.

---

### GET /api/actions/{jobId}

Poll the status of a running or completed action job.

**Path parameters**

| Parameter | Type   | Description                             |
|-----------|--------|-----------------------------------------|
| `jobId`   | string | Job ID returned by a previous POST call |

**Response**

```json
{
  "job_id": "abc123",
  "target": "tailor-cv",
  "status": "completed",
  "exit_code": 0,
  "stdout": "...",
  "stderr": "",
  "duration_ms": 4200
}
```

`status` is one of `running`, `completed`, `failed`, `cancelled`.

---

### POST /api/actions/stream

Execute a Make target and receive output as a Server-Sent Events stream. The request body is identical to `POST /api/actions/{target}` but includes `target` in the body.

**Request body**

```json
{
  "target": "tailor-cv",
  "application": "2026-02-databricks",
  "args": {
    "AI": "gemini"
  }
}
```

| Field         | Type                    | Required | Description              |
|---------------|-------------------------|----------|--------------------------|
| `target`      | string                  | Yes      | Make target name         |
| `application` | string                  | No       | Application folder name  |
| `args`        | Record\<string, string\> | No       | Additional Make variables |

**Response**

Content-Type: `text/event-stream`

Each event is a JSON object on a `data:` line:

```
data: {"type":"stdout","line":"Generating CV..."}

data: {"type":"stderr","line":"Warning: ..."}

data: {"type":"done","code":0}
```

Event types:

| Type     | Description                        |
|----------|------------------------------------|
| `stdout` | A line from standard output        |
| `stderr` | A line from standard error         |
| `done`   | Execution finished; includes `code` (exit code) |

---

## Dashboard & Stats

### GET /api/dashboard

Return aggregate data for the dashboard view.

**Response**

```json
{
  "total_applications": 42,
  "by_status": {
    "applied": 20,
    "interview": 10,
    "offer": 2,
    "rejected": 8,
    "ghosted": 2
  },
  "recent_applications": [
    {
      "name": "2026-03-acme",
      "company": "Acme",
      "position": "Engineer",
      "status": "applied",
      "created_at": "2026-03-09T10:00:00Z"
    }
  ]
}
```

---

### GET /api/stats

Return funnel and timeline statistics.

**Response**

```json
{
  "funnel": {
    "applied": 42,
    "interview": 12,
    "offer": 3,
    "rejected": 15,
    "ghosted": 12
  },
  "timeline": [
    { "date": "2026-01-01", "count": 5 },
    { "date": "2026-02-01", "count": 12 }
  ]
}
```

---

## Settings

### GET /api/settings

Retrieve the current user settings.

**Response**

```json
{
  "theme": "system",
  "default_view": "list"
}
```

---

### POST /api/settings

Persist updated settings. Request body is validated with Zod before being forwarded to cv-api.

**Request body**

```json
{
  "theme": "dark",
  "default_view": "kanban"
}
```

| Field          | Type   | Required | Description                                  |
|----------------|--------|----------|----------------------------------------------|
| `theme`        | string | Yes      | UI theme preference, e.g. `light`, `dark`, `system` |
| `default_view` | string | Yes      | Default application list view, e.g. `list`, `kanban` |

**Response**

Returns the updated `Settings` object:

```json
{
  "theme": "dark",
  "default_view": "kanban"
}
```

---

## Health

### GET /api/health

Check connectivity to the cv-api backend.

**Response**

```json
{ "status": "ok" }
```

| Status     | HTTP code | Meaning                         |
|------------|-----------|---------------------------------|
| `ok`       | 200       | cv-api is reachable and healthy |
| `degraded` | 200       | cv-api responded but reported a degraded state |
| `down`     | 503       | cv-api is unreachable           |

---

## Search

### GET /api/search

Full-text search across application files.

**Query parameters**

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `q`       | string | Yes      | Search query. Minimum 3 characters. Returns `{ results: [] }` for shorter queries. |

**Response**

```json
{
  "results": [
    {
      "name": "2026-02-databricks",
      "company": "Databricks",
      "position": "Senior Engineer",
      "stage": "interview",
      "matches": [
        {
          "file": "job.txt",
          "snippet": "...experience with distributed systems..."
        }
      ]
    }
  ]
}
```
