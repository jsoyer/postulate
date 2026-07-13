# cv-api Roadmap

Strategic development plan for cv-api, the centralized HTTP/WebSocket execution surface for the CV management system.

## API & Endpoints

- [x] **Pagination for applications list** — Cursor-based pagination with `?limit`, `?cursor`; `X-Total-Count` and `X-Next-Cursor` response headers.

- [x] **Advanced filtering and sorting** — `?status`, `?company`, `?sort`, `?order` query parameters; full filter/sort in storage layer.

- [x] **Bulk operations** — `PATCH /api/applications` for batch status/field updates with partial-failure semantics (`{updated, errors}`).

- [ ] **API versioning** — Implement content negotiation and versioned endpoints (e.g., `/api/v2/applications`) to support backward compatibility during major API changes.

- [x] **Export endpoints** — `GET /api/applications/export?format=json|csv` with proper Content-Type and Content-Disposition headers.

- [x] **Theme endpoints** — `GET /api/themes` returns 6 theme presets (tech-blue, startup-orange, executive-dark, cyber-red, minimal-clean, academic-classic) with full metadata.

- [x] **Theme preview generation** — `GET /api/applications/{name}/preview?theme=tech-blue` to generate and return a preview PDF with the selected theme applied.

- [x] **CV health audit endpoint** — `GET /api/applications/{name}/health-audit` returning quantification, action verb, completeness, and overall scores from notes content.

- [x] **AI provider status** — Extend `GET /health` to report configured AI providers, available API keys, and fallback chain readiness.

## Auth & Security

- [x] **Role-based access control (RBAC)** — Introduce user roles (admin, editor, viewer) with granular permissions on targets, applications, and settings. Store role assignments in configuration.

- [x] **Session management improvements** — Implement session revocation, active session listing, and device tracking for better security and UX (especially for multi-device usage).

- [x] **API key rotation** — Add endpoints to generate, revoke, and rotate API keys with audit logging. Support key expiration and scoping to specific targets or operations.

- [x] **Audit logging** — Log all authentication attempts, API calls, target executions, and data modifications with timestamp, user, action, and result. Export logs via `/api/audit-log`.

- [x] **Rate limiting enhancements** — Support per-endpoint rate limits, user-level limits, and configurable burst capacity. Add request cost-based limiting for expensive operations.

## Storage & Data

- [ ] **Structured metadata store** — Move from flat YAML files to a lightweight database (SQLite) for applications metadata, enabling efficient queries, transactions, and backups.

- [x] **Backup and restore** — `GET /api/backup` streams tar.gz of applications/; `POST /api/restore` accepts multipart upload with path-traversal protection and 100 MB limit.

- [ ] **Data migrations** — Create migration framework for schema changes. Support versioning of storage format with automatic upgrading on startup.

- [x] **File versioning** — Notes versioned via `WriteNotesVersioned`; up to 10 versions stored in `.versions/`; `GET /api/applications/{name}/notes/versions` and `/{filename}` endpoints for listing and retrieval.

- [x] **Search performance optimization** — Implement full-text search index (Bleve or SQLite FTS) for faster searches across large application collections.

## Performance & Reliability

- [x] **Connection pooling and caching** — Generic TTL cache (`internal/cache`) applied to applications list; invalidated on every write operation.

- [x] **Streaming optimizations** — Add backpressure handling and adaptive chunking for WebSocket streaming based on client capabilities. Support gzip compression for large outputs.

- [x] **Graceful degradation** — WS streams `type:"timeout"` message (distinct from `"error"`) on context cancellation; `WaitForSlot` helper exposes queue-full backpressure to callers.

- [x] **Health check improvements** — Enhance `/health` to return detailed system status: disk space, CV_PATH accessibility, target definitions validity, and job queue depth.

- [ ] **Load testing suite** — Create load testing scenarios covering concurrent applications, WebSocket streams, search queries, and target executions to identify bottlenecks.

- [x] **AI response caching** — Cache successful AI responses (tailor, research) with TTL for identical prompts to reduce external API calls and costs.

- [x] **Fallback chain observability** — Log and expose which provider succeeded per request, making fallback transparent to clients.

## Observability & Monitoring

- [x] **Metrics export** — Prometheus-compatible `GET /metrics` endpoint (no auth) via custom `Registry` (CounterVec, HistogramVec, Gauge); tracks AI provider calls, latency, and active WS connections.

- [ ] **Distributed tracing** — Integrate OpenTelemetry for request tracing across execution boundaries, enabling visibility into slow requests and failure paths.

- [x] **Enhanced logging** — Transition to structured logging with request IDs for correlation. Support log levels per package. Add OpenTelemetry traces and metrics alongside logs.

- [x] **Dashboard metrics** — `/api/dashboard` includes `ai_provider_calls_total` from the metrics registry alongside existing application stats.

- [x] **AI provider metrics** — Track calls per provider (gemini, claude, openai, ollama), fallback frequency, rate limit (429) count via Prometheus-compatible metrics.

- [x] **Theme usage tracking** — Log which themes are selected most frequently across applications.

- [x] **Health score trends** — Store and expose audit score history per application for trend analysis.

## CI/CD & Deployment

- [x] **Multi-architecture builds** — GitHub Actions workflow builds `linux/amd64,linux/arm64,linux/arm/v7` for both cv-api and cv-runner images; pushes to `ghcr.io/jsoyer` on semver tags.

- [ ] **Helm chart** — Create Kubernetes Helm chart for deploying cv-api with configurable replicas, resource limits, ingress rules, persistent volumes for applications, and monitoring.

- [x] **Container security scanning** — Add Trivy scanning to CI/CD pipeline. Implement minimal base image (distroless) and regular dependency updates.

- [x] **Automated releases** — GoReleaser workflow on `v*` tags builds `linux/{amd64,arm64,armv7}` binaries for both services, publishes to GitHub Releases with conventional-commit changelog and SHA256 checksums.

## Testing & Quality

- [x] **Integration test suite** — Auth flow tests (login/logout, rate limit, API key, JWT), file versioning tests, pagination, export, bulk update, backup, themes, health audit, and restore — 301 tests total across 15 packages.

- [ ] **Contract testing** — Implement Pact tests for cv-api <-> clients (cv-manager, cv-tui) contracts to catch breaking changes early.

- [ ] **API load testing** — Create artillery or k6 test scripts simulating realistic user patterns: listing applications, executing targets concurrently, streaming output.

- [ ] **Theme service integration tests** — Validate theme file loading, preview PDF generation, and theme metadata endpoint.

- [ ] **AI fallback chain tests** — Mock providers to test fallback logic, rate limit handling, and error propagation.

## Developer Experience

- [x] **OpenAPI specification** — OpenAPI 3.1 spec at `docs/openapi.yml`; served as YAML at `GET /docs/openapi.yml` and with Swagger UI at `GET /docs` (no auth required).

- [x] **SDK generation** — Hand-authored TypeScript SDK at `sdk/typescript/` with full interface coverage (`types.ts`) and a fetch-based `CvApiClient` class (`client.ts`) for all endpoints.

- [x] **Postman collection** — `docs/postman_collection.json` (Collection v2.1): 15 folders, all routes, pre-configured auth variables (`baseUrl`, `apiKey`, `jwtToken`), login script auto-saves JWT.

- [x] **Local development improvements** — Add docker-compose setup for local development with CV project mounted, mock authentication, and hot-reload support. Document with detailed getting-started guide.

## Notes

- Prioritize items based on user feedback, performance bottlenecks observed in production, and client (cv-web, cv-tui) feature requests.
- Security items should be addressed before performance optimizations.
- Observability improvements enable better decision-making on subsequent priorities.
- Testing and developer experience items reduce maintenance burden and accelerate feature delivery.
