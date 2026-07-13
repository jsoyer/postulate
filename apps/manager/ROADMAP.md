# CV Manager Roadmap

A strategic plan for feature development, performance optimization, and platform maturity for the CV Manager web dashboard. This roadmap is organized by category and priority, with a target of ~20 items spanning UI/UX, features, performance, testing, and DevOps.

## UI/UX Enhancements

- [x] Responsive Mobile Navigation: Improve bottom navigation bar layout and touch targets for mobile users; add swipe gestures for view switching on tablet devices
- [x] Keyboard Shortcuts Documentation: Create in-app help modal showing all available keyboard shortcuts (Cmd+K command palette, Cmd+N new app, etc.) with visual guide
- [x] Accessibility Audit: Conduct WCAG 2.1 AA audit; fix color contrast issues, add ARIA labels, improve focus indicators, test with screen readers
- [x] Dark Mode Refinement: Fix color inconsistencies in dark mode tables and modals; add automatic detection of system preference on first visit
- [x] Skeleton Loading States: Replace placeholder divs with proper skeleton screens across all async data fetches for improved perceived performance

## Feature Development

- [x] Calendar View: Add calendar-based visualization of applications with deadline highlighting and deadline-driven coloring; export to iCalendar format
- [x] Real-time Notifications: Implement toast notifications for application status changes, deadline reminders, and action completion (via webhook events)
- [x] Batch Operations: Enable selecting multiple applications for bulk stage updates, tag management, or export operations
- [x] Advanced Filtering: Add multi-criteria filter panel for company, position, stage, date range, and ATS score thresholds
- [x] Timeline View: Implement chronological visualization of application journey with status transitions, interviews, and offer timelines
- [x] Notes/Comments System: Rich text editor for detailed notes on each application with timestamps and change history
- [x] File Management: Improved UI for uploading, organizing, and linking application materials (cover letters, research docs, interview notes)
- [x] Tags and Labels: Custom tagging system for applications (e.g., "remote", "startup", "FAANG") with filtering and statistics

## Performance & Optimization

- [x] React Server Components Migration: Refactor dashboard and applications pages to use RSC for reduced JavaScript payload and faster initial load
- [x] Query Response Caching: Implement SWR or cache-first strategy for frequently accessed data (applications list, stats, cv data)
- [x] Lazy Load Action Pages: Code-split action pages to reduce initial bundle size; load only on demand from /actions/* routes
- [x] Image Optimization: Add next/image for any avatar or company logo display; implement responsive srcset and format negotiation
- [x] Database Query Optimization: Review cv-api endpoints for N+1 queries; add aggregation for stats calculations and caching strategies

## Data & State Management

- [x] Optimistic UI Updates: Implement optimistic state updates when changing application stages or updating metadata before backend confirmation
- [x] Offline Support: Add service worker caching and IndexedDB for offline read access to cached applications and metadata
- [x] Real-time Sync: Implement WebSocket or Server-Sent Events for real-time updates when data changes on cv-api backend
- [x] Undo/Redo Stack: Add client-side undo/redo for stage changes and inline edits (up to 10 operations)
- [x] Conflict Resolution: Handle concurrent edits gracefully when same application is modified from multiple clients or devices

## Auth & Security

- [x] Session Persistence: Improve session management with refresh token rotation and persistent login across page reloads
- [x] CSRF Protection: Add CSRF tokens to state-modifying API requests; validate origin headers
- [x] Content Security Policy: Implement strict CSP headers to prevent XSS attacks and enforce safe resource loading
- [x] Input Validation: Add Zod schema validation for all API request/response payloads; sanitize user inputs in notes and fields
- [x] API Rate Limiting: Implement client-side rate limiting to prevent accidental abuse; add exponential backoff for retries

## Testing & Quality

- [x] Unit Tests: Add Jest tests for utility functions, components, and API routes; target 70% coverage of critical paths
- [x] Component Tests: Add Vitest for component logic testing, focusing on state management and event handling
- [x] E2E Tests: Implement Playwright tests for critical user workflows (login, create app, change stage, export)
- [x] Visual Regression Testing: Set up visual regression testing with Percy or Chromatic for UI consistency across changes
- [x] Lighthouse CI: Integrate Lighthouse CI into CI/CD pipeline to enforce performance budget (>85 score) and accessibility targets

## CI/CD & Deployment

- [x] Preview Deployments: Integrate Vercel preview deployments for every PR with automatic comments showing preview URL
- [x] Environment Secrets Management: Properly configure environment variables for dev, staging, and production with secret injection
- [x] Build Caching: Optimize Next.js build cache and npm cache in CI pipeline to reduce build time from ~5 min to ~2 min
- [x] Automated Changelog: Generate changelog from conventional commits; auto-tag releases on main branch
- [x] Dependency Updates: Set up Dependabot for automated dependency updates with PR creation and CI validation
- [x] Dockerfile + Docker Compose: Multi-stage Dockerfile (builder → runner) with Next.js standalone output; `docker-compose.yml` defining the cv-manager service with volume mounts for `CV_PATH` and settings; full Podman compatibility (no root, `podman-compose` support, rootless volume paths).

## Developer Experience

- [x] Storybook Setup: Create component library with Storybook for isolated component development and documentation
- [x] Error Boundaries: Implement React error boundaries with error logging to catch and display component crashes gracefully
- [x] TypeScript Strictness: Enable strict mode in tsconfig; eliminate any types and improve type safety throughout codebase
- [x] Component Documentation: Add JSDoc comments and Storybook stories for reusable components; document component API
- [x] API Documentation: Auto-generate OpenAPI schema from API routes; create interactive API docs with Swagger or Stoplight

## CV Integration

### Theme System
- [x] Theme selector in tailoring flow -- dropdown or tab group to choose CV theme (tech-blue, startup-orange, executive-dark, cyber-red) when running tailor action
- [x] Theme preview gallery -- modal showing side-by-side PDF previews of the CV rendered in all 4 available themes
- [x] Save theme preference per application -- store selected theme in application metadata, auto-apply on re-tailor
- [x] Theme color swatches in UI -- small color indicator next to theme name showing the primary color

### Data Quality
- [x] CV health audit widget -- dashboard card showing overall audit score (0-100), quantification rate, duplicate bullet count, action verb quality, and recommended fixes
- [x] Health check on application create -- display audit warnings before saving tailored CV (high duplicates, low quantification, weak action verbs)
- [x] Audit score history chart -- show health score trend per application across tailor iterations
- [x] Audit score badge on applications list -- visual indicator (green/yellow/red) based on cv-health score

### AI Transparency
- [x] AI provider indicator -- show which provider (Gemini, Claude, OpenAI, Ollama) was used for last tailor in application detail view
- [x] Fallback chain status notification -- inform user when primary AI provider failed and a fallback was used
- [x] Log level selector in settings -- allow enabling DEBUG logging in cv-api from the UI for troubleshooting

## AI Configuration

- [x] AI provider selector on action pages — per-run override (gemini/claude/openai/mistral/ollama) on all AI-enabled actions
- [x] Global default AI provider — Settings → AI tab persists `default_ai` + `default_model` to cv-api settings
- [x] API key management UI — Settings → AI tab shows per-provider env var names, links to key consoles, and live availability status from cv-api /health
- [x] Provider availability indicator — ProviderStatusCard in Settings → AI shows green/gray dot per provider from /api/health

## Quality & Compliance

- [x] Security audit — OWASP Top 10 review: input validation, auth flows, headers, injection surface
- [x] Accessibility audit — WCAG 2.1 AA: color contrast, ARIA, keyboard navigation, screen reader test
- [x] E2E coverage for new features — calendar, AI provider, batch ops, settings advanced tabs

## Documentation

- [x] README — quickstart (local + Docker), environment variables reference, architecture overview, screenshots
- [x] CONTRIBUTING guide — dev setup, test commands, PR conventions
- [x] cv-api integration notes — docs/cv-api-integration.md: proxy pattern, SSE, auth, settings sync

## Onboarding

- [x] Setup wizard — /setup page with 3-step guided config (connect, authenticate, verify)
- [x] Connection health banner — fixed top banner polling /api/health every 30s, amber/red, dismissible

---

## Categories Summary

| Category | Items | Priority |
|----------|-------|----------|
| UI/UX | 5 | High |
| Features | 8 | High |
| Performance | 5 | Medium |
| Data & State | 5 | Medium |
| Auth & Security | 5 | High |
| Testing | 5 | High |
| CI/CD & Deployment | 6 | Medium |
| Developer Experience | 5 | Medium |
| CV Integration | 11 | High |
| AI Configuration | 4 | High |
| Quality & Compliance | 3 | High |
| Documentation | 3 | High |
| Onboarding | 2 | Medium |

**Total: 67/67 items completed**

## Implementation Notes

- Items are presented in roughly priority order within each category
- High-priority items focus on user experience, security, and reliability
- Medium-priority items focus on scalability, maintainability, and developer efficiency
- Each item should be broken down into specific tasks with acceptance criteria before implementation
- Regular review and re-prioritization based on user feedback and business needs is recommended
