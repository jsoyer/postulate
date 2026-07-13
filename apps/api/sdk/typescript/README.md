## Type Generation

> **`types.gen.ts` is auto-generated — DO NOT edit it manually.**

`types.gen.ts` is generated from `docs/openapi.yml` using [openapi-typescript](https://github.com/openapi-ts/openapi-typescript).

To regenerate after updating the OpenAPI spec:
```bash
# From repo root:
npx openapi-typescript docs/openapi.yml -o sdk/typescript/types.gen.ts

# Or via package.json script (from sdk/typescript/):
cd sdk/typescript && npm run generate
```

`types.ts` contains hand-written types that pre-date the generator. It is kept for backward
compatibility with `client.ts` but diverges from the spec — see [DRIFT.md](./DRIFT.md) for details.
The long-term goal is to migrate `client.ts` to import from `types.gen.ts` instead.

---

# cv-api TypeScript SDK

A typed TypeScript client for the cv-api HTTP API.

## Installation

No npm package is published yet. Copy `client.ts` and `types.ts` into your project:

```
cp sdk/typescript/client.ts  src/lib/cv-api/client.ts
cp sdk/typescript/types.ts   src/lib/cv-api/types.ts
```

Requirements:
- TypeScript 5+ with `"moduleResolution": "bundler"` or `"node16"`
- ES2020 or later target (uses `AsyncGenerator`, `URLSearchParams`, `fetch`)

## Quick start

### 1. Initialise the client

```typescript
import { CvApiClient } from "./cv-api/client.js"

const client = new CvApiClient("http://localhost:8080", "your-api-key")
```

### 2. List applications

```typescript
const page = await client.listApplications({ status: "applied", limit: 20 })
console.log(`${page.totalCount} applications`)
for (const app of page.data) {
  console.log(`${app.name} — ${app.company}`)
}
```

### 3. Stream a tailor action with `streamAction`

`streamAction` opens an SSE connection and yields `WSMessage` objects as they
arrive. The generator completes when the process exits.

```typescript
for await (const msg of client.streamAction("tailor", {
  target: "tailor",
  application: "2024-03-google",
})) {
  switch (msg.type) {
    case "stdout":
      process.stdout.write(msg.data + "\n")
      break
    case "exit":
      console.log(`Process exited with code ${msg.data}`)
      break
    case "error":
      console.error(`Error: ${msg.data}`)
      break
  }
}
```

### 4. Use convenience methods

```typescript
// Apply to a new job URL (fetch + tailor + score + render pipeline)
const job = await client.applyToJob("https://example.com/jobs/123")
console.log(job.status, job.exit_code)

// Tailor CV for an existing application
await client.tailorCV("2024-03-google")

// Generate recruiter outreach email
await client.generateRecruiterEmail("2024-03-google")

// Push all applications to Notion
await client.pushToNotion()
```

## API reference

### Auth

| Method | Description |
|---|---|
| `login(username, password, totpCode?)` | Obtain a JWT token |
| `logout()` | Invalidate the current session |

### Applications

| Method | Description |
|---|---|
| `listApplications(params?)` | List with optional filter/sort/paginate |
| `getApplication(name)` | Get one application by name |
| `createApplication(data)` | Create a new application directory |
| `updateApplication(name, data)` | Patch application metadata |
| `bulkUpdateApplications(req)` | Update multiple applications at once |
| `exportApplications(format?)` | Export as JSON or CSV blob |

### Notes

| Method | Description |
|---|---|
| `getNotes(name)` | Get `notes.md` content as string |
| `updateNotes(name, content)` | Overwrite `notes.md` |
| `listNoteVersions(name)` | List saved note versions |
| `getNoteVersion(name, filename)` | Retrieve a specific version |

### Files

| Method | Description |
|---|---|
| `uploadFile(name, filename, data)` | Upload a file to an application |
| `getFile(name, filename)` | Download a file as Blob |

### Intelligence

| Method | Description |
|---|---|
| `skillsGap(name)` | CV vs job skills gap analysis |
| `healthAudit(name)` | CV quality scores |
| `healthAuditHistory(name)` | Historical health audit scores |
| `previewPDF(name, theme)` | Generate themed PDF preview as Blob |

### Search

| Method | Description |
|---|---|
| `search(query, limit?)` | Full-text search across all applications |

### Themes

| Method | Description |
|---|---|
| `listThemes()` | List available PDF themes |

### Dashboard & Stats

| Method | Description |
|---|---|
| `getDashboard()` | Aggregated dashboard data |
| `getStats()` | Pipeline funnel stats |

### Settings

| Method | Description |
|---|---|
| `getSettings()` | Read current settings |
| `updateSettings(data)` | Patch settings |

### Targets

| Method | Description |
|---|---|
| `listTargets()` | List all allowed Make targets |

### Actions

| Method | Description |
|---|---|
| `runAction(target, req)` | Execute a Make target (async job) |
| `getJob(jobId)` | Poll job status by ID |
| `streamAction(target, req)` | SSE stream — `AsyncGenerator<WSMessage>` |

### Sessions (admin)

| Method | Description |
|---|---|
| `listSessions()` | List active JWT sessions |
| `revokeSession(id)` | Revoke a session by ID |

### API Keys (admin)

| Method | Description |
|---|---|
| `listAPIKeys()` | List API key prefixes and roles |
| `generateAPIKey(role)` | Generate a new API key |
| `revokeAPIKey(prefix)` | Revoke an API key by prefix |

### Health

| Method | Description |
|---|---|
| `health()` | Service health check |

### Audit log (admin)

| Method | Description |
|---|---|
| `getAuditLog(limit?)` | Retrieve recent audit entries |

### Backup (admin)

| Method | Description |
|---|---|
| `downloadBackup()` | Download full backup archive as Blob |

### CV convenience — Workflow

| Method | Description |
|---|---|
| `applyToJob(url)` | Full apply pipeline for a job URL |
| `fetchJob(url)` | Fetch job description from URL |
| `tailorCV(appName, ai?)` | AI-tailor CV for an application |
| `scoreCV(appName)` | ATS-score the tailored CV |
| `renderCV(appName)` | Render CV to PDF |
| `exportCVDocx(appName)` | Export CV as DOCX |

### CV convenience — Intelligence

| Method | Description |
|---|---|
| `researchCompany(appName)` | AI company research |
| `findContacts(appName)` | Find recruiter/hiring manager contacts |
| `analyzeJobFit(appName)` | Job fit score |
| `generateCoverAngles(appName)` | Cover letter angles |
| `predictInterview(appName)` | Interview probability prediction |
| `salaryBench(appName)` | Salary benchmarking |

### CV convenience — Interview

| Method | Description |
|---|---|
| `prepInterview(appName)` | Generate interview prep notes |
| `prepSTAR(appName)` | Generate STAR story bank |
| `simulateInterview(appName)` | AI interview simulation |
| `generateQuestions(appName)` | Questions to ask the interviewer |

### CV convenience — Outreach

| Method | Description |
|---|---|
| `generateRecruiterEmail(appName)` | Recruiter outreach email |
| `generateCoverLetter(appName)` | AI cover letter |
| `generateFollowUp(appName)` | Follow-up email |
| `generateLinkedInMessage(appName)` | LinkedIn connection message |

### CV convenience — Reports

| Method | Description |
|---|---|
| `getPipelineStats()` | Pipeline funnel statistics |
| `getPipelineDashboard()` | Pipeline dashboard |
| `getATSRanking()` | Rank all applications by ATS score |

### CV convenience — Notifications & Integrations

| Method | Description |
|---|---|
| `sendDigest()` | Send pipeline digest to Slack/Discord/Telegram |
| `syncNotion(appName)` | Sync one application to Notion |
| `pushToNotion()` | Push all YAML to Notion |
| `pullFromNotion()` | Pull Notion updates to local YAML |

## Error handling

All methods throw `CvApiError` on non-2xx responses:

```typescript
import { CvApiClient, CvApiError } from "./cv-api/client.js"

try {
  await client.getApplication("nonexistent")
} catch (err) {
  if (err instanceof CvApiError) {
    console.error(`API error ${err.status}: ${err.message}`)
  }
}
```
