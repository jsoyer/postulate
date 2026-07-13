# CV Manager

A personal job application tracking dashboard built with Next.js 16. Manage applications, tailor CVs with AI, run intelligent actions, and track your job search pipeline all in one place.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## Overview

CV Manager is a frontend dashboard for managing job applications. It integrates with [cv-api](https://github.com/jeromesoyer/cv-api) (a Go backend wrapping a Makefile-based CV pipeline) to provide intelligent workflow automation, CV tailoring, ATS scoring, interview preparation, and more.

Whether you're actively job hunting or maintaining a pipeline, CV Manager streamlines the entire process with:

- Real-time application tracking across multiple stages
- AI-powered CV tailoring and ATS scoring
- Job research, interview prep, and salary negotiation tools
- Calendar view with deadline tracking
- Advanced filtering, search, and bulk operations
- Dark mode, keyboard shortcuts, and offline support

This is a personal productivity tool designed to run locally or in Docker, with no external database required.

![Dashboard](docs/screenshot.png)

## Key Features

- **Dashboard**: Overview of applications by stage, deadlines, and activity
- **Applications Board**: Kanban-style view of applications across pipeline stages (Apply, Interview, Offer, Rejected, Archived)
- **Calendar View**: Visual timeline of applications with deadline highlighting
- **History**: Full audit trail of application updates and actions
- **Statistics**: Pipeline metrics, conversion rates, and trends
- **AI Tailor**: Use Gemini, Claude, OpenAI, Mistral, or Ollama to tailor CVs for specific jobs
- **ATS Scoring**: Analyze job descriptions and rank your CV against them
- **Job Intelligence**: Company research, skills gap analysis, competitor mapping, and keyword trends
- **Interview Prep**: Generate interview guides, STAR stories, and quiz questions
- **Salary Tools**: Benchmark compensation and generate negotiation talking points
- **Outreach Automation**: Draft recruiter emails, cold sequences, and LinkedIn messages
- **Bulk Actions**: Select and update multiple applications at once
- **Settings**: Configure CV path, AI providers, credentials, interface preferences, and third-party integrations
- **Notion Sync**: Push/pull/diff your applications to a Notion database directly from the UI
- **LinkedIn**: OAuth 2.0 integration — post generated content directly to LinkedIn

## Prerequisites

- **Node.js 20+** and npm
- **cv-api backend** running (see [cv-api](https://github.com/jeromesoyer/cv-api) for setup)
- **Docker** (optional, for containerized deployment)

## Quick Start (Local)

Clone the repository:

```bash
git clone https://github.com/jeromesoyer/cv-manager.git
cd cv-manager
```

Copy the environment file and configure:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings:

```bash
# Required: cv-api URL and authentication
CV_API_URL=http://localhost:8000
CV_API_KEY=your-api-key-here

# Optional: path to CV project directory (legacy)
CV_PATH=/path/to/your/cv/project

# Authentication
AUTH_SECRET=your-random-32-character-secret
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-password
AUTH_TOTP_SECRET=
AUTH_DOMAIN=localhost
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Quick Start (Docker)

Create a `.env.local` file with your configuration (see above).

Start the container:

```bash
docker compose up -d
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

View logs:

```bash
docker compose logs -f cv-manager
```

Stop the container:

```bash
docker compose down
```

To rebuild after code changes:

```bash
docker compose up -d --build
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CV_API_URL` | Yes | `http://localhost:8000` | Base URL of cv-api backend |
| `CV_API_KEY` | Yes | — | API key for cv-api authentication |
| `CV_PATH` | No | `/path/to/cv` | Path to CV project directory (legacy, filesystem-based) |
| `AUTH_SECRET` | Yes | — | JWT signing secret (min. 32 characters) |
| `AUTH_USERNAME` | Yes | `jerome` | Login username |
| `AUTH_PASSWORD` | Yes | `cvmanager` | Login password |
| `AUTH_TOTP_SECRET` | No | — | Base32-encoded TOTP secret for 2FA (optional) |
| `AUTH_DOMAIN` | No | `localhost` | Domain for WebAuthn RP ID |
| `AUTH_ORIGIN` | No | `http://localhost:3000` | Expected WebAuthn origin |
| `LINKEDIN_CLIENT_ID` | No | — | LinkedIn Developer App client ID (for OAuth) |
| `LINKEDIN_CLIENT_SECRET` | No | — | LinkedIn Developer App client secret |

## Architecture

### Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI Components**: shadcn/ui + Radix UI primitives
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS 4
- **Charts**: Recharts
- **Icons**: Lucide React
- **Markdown**: Mermaid diagrams
- **Notifications**: Sonner toast library
- **Testing**: Vitest, Playwright, Storybook

### Project Structure

```
src/
  app/
    api/              # REST API routes (proxy to cv-api)
    (routes)/         # Page routes (dashboard, applications, etc.)
    layout.tsx        # Root layout with sidebar, error boundary
    globals.css       # Tailwind + theme variables
  components/
    ui/               # shadcn/ui components
    Sidebar.tsx       # Navigation sidebar with action shortcuts
    CommandPalette.tsx # Cmd+K command search
    Providers.tsx     # TanStack Query, theme, context setup
    ErrorBoundary.tsx # React error boundary wrapper
  lib/
    auth.ts           # JWT, TOTP, WebAuthn (jose, otplib)
    utils.ts          # Helper functions
e2e/                  # Playwright end-to-end tests
.storybook/           # Component library setup
```

### Integration with cv-api

CV Manager communicates with cv-api via REST API with Server-Sent Events (SSE) streaming for long-running operations:

- **CV Tailoring**: POST request with job description, streams tailored CV back via SSE
- **ATS Scoring**: Analyzes job description and calculates match score
- **Actions**: All intelligent actions (research, interview prep, etc.) proxy through `/api/actions/[target]`
- **Settings**: Persists user preferences and CV path to cv-api
- **Authentication**: API key passed via `Authorization` header

## Development

### Commands

Start development server with hot reload:

```bash
npm run dev
```

Run tests:

```bash
npm test              # Vitest unit/component tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI dashboard
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright end-to-end tests
npm run test:e2e:ui   # Playwright interactive UI
```

Build for production:

```bash
npm run build         # Generate optimized build
npm start             # Run production server
```

Component development:

```bash
npm run storybook     # Launch Storybook on port 6006
npm run build-storybook # Generate static site
```

Code quality:

```bash
npm run lint          # Run ESLint
```

### Development Workflow

1. Create a feature branch: `git checkout -b feat/new-feature`
2. Make changes and test: `npm run dev` and `npm test`
3. Commit using conventional commits: `git commit -m 'feat: add new feature'`
4. Push and open a pull request

### Testing Strategy

- **Unit Tests**: Components and utilities in `__tests__` directories
- **Component Tests**: React component logic with Vitest
- **E2E Tests**: Critical user flows with Playwright (login, create app, update stage)
- **Visual Regression**: Screenshot testing (setup available with Percy or Chromatic)

## Features by Category

### Dashboard & View Management
- **Dashboard**: At-a-glance pipeline overview with stage counts, upcoming deadlines, and recent activity
- **Applications List**: Table view with inline editing, filtering, and sorting
- **Kanban Board**: Drag-and-drop application management across pipeline stages
- **Calendar View**: Visual timeline of applications with deadline highlighting and iCalendar export
- **History**: Audit trail of all application changes and actions

### Application Management
- **Create Application**: Add new job application from scratch or from a job URL
- **Update Metadata**: Edit company, position, salary, stage, tags, and custom fields
- **Notes & Comments**: Rich text editor with timestamps for detailed tracking
- **File Management**: Upload and link cover letters, research docs, and interview materials
- **Bulk Operations**: Select multiple applications and update stage, tags, or delete in batch

### CV Generation & Tailoring
- **Render YAML**: Convert CV YAML to formatted output
- **AI Tailor**: Use Gemini, Claude, OpenAI, Mistral, or Ollama to automatically tailor CV for job
- **ATS Score**: Analyze job description and score CV against requirements
- **ATS Rank**: Compare multiple CVs against a job description
- **CV Diff**: View before/after comparison of original vs. tailored CV
- **CV Health**: Audit CV quality (quantification rate, action verbs, duplicates, score trends)
- **Export CV**: Download as PDF or DOCX
- **Export Data**: Export applications as CSV for analysis

### Intelligence & Research
- **Company Research**: Gather insights on company culture, values, and tech stack
- **Skills Gap**: Identify missing skills and proficiency gaps for target role
- **Competitor Map**: Compare company positioning in market
- **Job Fit Score**: Glassdoor review score and role alignment analysis
- **Keyword Trends**: Identify trending skills and keywords in job postings
- **Find Contacts**: Discover recruiters and hiring managers at target companies

### Interview Preparation
- **Interview Prep**: Generate role-specific interview guide and common questions
- **Interview Brief**: AI-generated interview tips and company context
- **STAR Stories**: Structure past accomplishments using STAR method
- **Question Bank**: Database of common technical and behavioral questions
- **Interview Quiz**: Self-assess knowledge on role-specific topics
- **Log Milestone**: Track project milestones and achievements for interview talking points

### Offer & Negotiation
- **Salary Benchmark**: Research market rates for role and location
- **Negotiation Guide**: Generate negotiation talking points and strategy
- **Thank-You Email**: Draft thank-you emails after interviews
- **Follow-Up Sequence**: Generate multi-step follow-up email sequences

### Outreach & Networking
- **Recruiter Email**: Draft outreach emails to recruiters
- **Cold Email Sequence**: Generate multi-step prospecting sequences
- **LinkedIn Message**: Create personalized LinkedIn connection requests
- **LinkedIn Sync**: Sync profile with application data
- **LinkedIn Profile Guide**: Optimize profile for target roles
- **LinkedIn Post Ideas**: Generate content ideas for professional visibility

### Reporting & Analytics
- **Statistics**: Pipeline metrics, conversion rates, time-to-hire, offer acceptance rate
- **Apply Board**: Task view of applications ready for submission
- **Pipeline Digest**: Weekly summary of pipeline health and next steps
- **Job Discovery**: Find new job opportunities matching criteria
- **Weekly Digest**: Email digest of activity and opportunities
- **All Targets**: View all configured job search targets and apply status

### Settings
- **AI Provider Configuration**: Set default AI provider and model
- **CV Path**: Configure path to local CV project directory
- **Credentials**: Manage authentication and TOTP setup
- **Security**: Register and manage WebAuthn passkeys
- **Theme**: Choose light/dark mode or system preference
- **Keyboard Shortcuts**: View and customize keyboard shortcuts
- **Health Check**: Verify cv-api connectivity and credentials
- **Integrations**: Connect Notion (token + database ID) and LinkedIn (OAuth 2.0)

### Integrations

#### Notion
1. Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Share your applications database with the integration
3. Go to Settings → Integrations → paste your token and database ID
4. Use `/actions/notion` to push/pull/diff your data

#### LinkedIn
1. Create a LinkedIn Developer App at [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Add the `w_member_social` scope
3. Set the OAuth callback URL to `http://localhost:3000/api/integrations/linkedin/callback`
4. Add to `.env.local`:
   ```
   LINKEDIN_CLIENT_ID=your_client_id
   LINKEDIN_CLIENT_SECRET=your_client_secret
   ```
5. Go to Settings → Integrations → Connect LinkedIn
6. Generate content with `/actions/linkedin-post` then post directly from the page

## Keyboard Shortcuts

Press `Cmd+K` (or `Ctrl+K` on Linux/Windows) to open the command palette:

- `Cmd+K`: Search actions and pages
- `Cmd+N`: Create new application
- `Cmd+/`: Show shortcuts help
- `/`: Focus search box
- Arrow keys: Navigate results
- Enter: Select
- Escape: Close palette

## Deployment

### Docker Deployment

Build the image:

```bash
docker build -t cv-manager:latest .
```

Run with docker-compose (recommended):

```bash
docker compose up -d
```

### Production Checklist

1. **Environment Variables**: Set `AUTH_SECRET` to a cryptographically secure 32+ character string
2. **cv-api**: Ensure cv-api is deployed and accessible at `CV_API_URL`
3. **HTTPS**: Use HTTPS in production (reverse proxy with Nginx or Traefik)
4. **Authentication**: Enable TOTP 2FA via `AUTH_TOTP_SECRET`
5. **Monitoring**: Monitor logs and healthcheck endpoint at `/api/health`
6. **Backups**: Regularly backup settings and application data from cv-api

### Health Check

The application exposes a health check endpoint:

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "ok",
  "cv_api_connected": true
}
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
2. Write tests for new features
3. Update this README if adding new features or changing behavior
4. Run linter and tests before committing: `npm run lint && npm test`

## Known Limitations

- **Single User**: Designed for personal use; no multi-user support
- **Local Authentication**: Auth stored in memory; credentials must be configured via environment
- **No Rate Limiting**: Relies on responsible usage; consider implementing in reverse proxy for production
- **Credentials Lost on Restart**: In-memory auth credentials; no persistent session DB

## Roadmap

See [ROADMAP.md](ROADMAP.md) — all 67 items completed.

## License

MIT

## Support

For issues, feature requests, or questions:

- Open an issue on GitHub
- Check [cv-api](https://github.com/jeromesoyer/cv-api) for backend issues
- Review environment variable configuration in `.env.example`

## Related Projects

- **[cv-api](https://github.com/jeromesoyer/cv-api)** — Go backend wrapping the CV Makefile pipeline
- **[cv-manager-e2e](https://github.com/jeromesoyer/cv-manager-e2e)** — End-to-end test suite

---

Built with Next.js, TanStack Query, shadcn/ui, and Tailwind CSS.
