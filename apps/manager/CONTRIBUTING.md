# Contributing

## Prerequisites

- Node.js 20+
- npm 10+
- A running [cv-api](https://github.com/example/cv-api) instance (default: `http://localhost:8765`)
- (Optional) A TOTP app if you enable `AUTH_TOTP_SECRET`

## Dev Setup

```bash
git clone https://github.com/yourname/cv-manager
cd cv-manager
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env.local
```

Minimum required variables:

```env
CV_API_URL=http://localhost:8765
CV_API_KEY=your_api_key
AUTH_SECRET=change_me
AUTH_USERNAME=jerome
AUTH_PASSWORD=yourpassword
```

Start the dev server:

```bash
npm run dev
# Open http://localhost:3000
```

If cv-api is not yet running, navigate to `/setup` for the guided connection wizard.

## Running Tests

```bash
# Unit + integration
npm test

# Watch mode
npm run test:watch

# End-to-end (requires dev server running)
npm run test:e2e

# Component Storybook
npm run storybook
```

## Code Style

- **TypeScript strict mode** — no implicit `any`, no unchecked index access
- No trailing whitespace, no commented-out code left behind
- Prefer explicit over clever
- Imports grouped: external libs, then `@/` aliases, then relative
- Tailwind classes only — no inline styles, no CSS modules
- Client components must declare `"use client"` at the top
- Server components fetch data directly; client components use React Query hooks from `src/hooks/`

ESLint and Prettier run automatically on commit via the pre-commit hook. To run manually:

```bash
npm run lint
npm run format
```

## Conventional Commits

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix       | When to use                                  |
|--------------|----------------------------------------------|
| `feat:`      | New feature or page                          |
| `fix:`       | Bug fix                                      |
| `refactor:`  | Code change with no functional difference    |
| `docs:`      | Documentation only                           |
| `chore:`     | Build scripts, deps, config                  |
| `style:`     | Formatting, whitespace, no logic change      |
| `test:`      | Adding or updating tests                     |

Examples:

```
feat: add skills-gap view to application detail page
fix: prevent XSS in markdown renderer
refactor: consolidate API proxy routes into dynamic handler
```

## PR Conventions

- Branch from `main`, target `main`
- Title follows the same `prefix: description` format as commits
- Link to the relevant GitHub issue with `Closes #<number>` in the PR body
- Keep PRs focused — one logical change per PR
- All checks (lint, type-check, tests) must pass before merge

## Project Structure

```
src/
  app/                  # Next.js App Router pages and API routes
    api/                # Proxy routes that forward requests to cv-api
    setup/              # First-run setup wizard (/setup)
    settings/           # Settings page (/settings)
    applications/       # Application list and detail pages
    actions/            # AI action pages (tailor, score, prep, …)
  components/           # Shared React components
    ui/                 # shadcn/ui primitives (Button, Card, Input, …)
  hooks/                # React Query hooks for client-side data fetching
  lib/
    api-client.ts       # CvApiClient — server-side HTTP client for cv-api
    api-types.ts        # Shared TypeScript types
    utils.ts            # cn() and other utilities
  middleware.ts         # Security headers
e2e/                    # Playwright end-to-end tests
docs/                   # Architecture and integration documentation
```
