# postulate

A polyglot monorepo for an AI-assisted job-application (CV) toolkit: a single
API hub, a set of client applications across platforms, and a shared document
generation engine.

The project consolidates a previously fragmented set of repositories into one
codebase. The generation engine originates from the `cv-pipeline` project.

## Architecture

```
                          ┌─────────────────────┐
                          │   apps/api (Go)     │
                          │   HTTP + WS hub     │
                          │   OpenAPI contract  │
                          └──────────┬──────────┘
                                     │  types.gen.ts / openapi.yml
        ┌───────────────┬────────────┼────────────┬───────────────┐
        │               │            │            │               │
   apps/manager   apps/mobile   apps/browser-  apps/tui-go   apps/tui-py
   (Next.js)      (Expo/RN)     extension      (Go TUI)      (Python TUI)
                                (Vite/React)                 apps/tui-rs
                                                             (Rust TUI)
                                     │
                          ┌──────────┴──────────┐
                          │  packages/pipeline  │
                          │  generation engine  │
                          │  packages/templates │
                          └─────────────────────┘
```

- **Hub:** `apps/api` (Go) exposes the shared HTTP/WebSocket API and owns the
  OpenAPI contract plus the generated TypeScript SDK that clients consume.
- **Clients:** web manager, mobile app, browser extension, and three terminal
  UIs (Go, Python, Rust) all talk to the hub.
- **Engine:** `packages/pipeline` (Python) performs the document generation;
  `packages/templates` holds the shared templates.

## Layout

```
apps/
  api/                Go API hub (owns the OpenAPI contract + generated SDK)
  manager/            Web manager UI (Next.js, pnpm)
  mobile/             Mobile app (Expo / React Native, pnpm)
  browser-extension/  Browser extension (Vite + React, pnpm)
  tui-go/             Terminal UI client (Go)
  tui-py/             Terminal UI client (Python)
  tui-rs/             Terminal UI client (Rust, rustls — no OpenSSL)
packages/
  pipeline/           Document generation engine (Python)
  templates/          Shared document templates
tools/
  audit-confidential.sh   Confidentiality audit run in CI and pre-commit
```

## Quickstart

Each subproject keeps its own native manifest and toolchain.

### API — `apps/api` (Go 1.25)
```bash
cd apps/api
make build      # compile the API binary
make test       # go test ./... -race -cover
```

### Web manager — `apps/manager` (Next.js, pnpm)
```bash
cd apps/manager
pnpm install
pnpm build      # next build
pnpm test       # vitest run
```

### Mobile — `apps/mobile` (Expo / React Native, pnpm)
```bash
cd apps/mobile
pnpm install
pnpm typecheck
pnpm start      # expo start
```

### Browser extension — `apps/browser-extension` (Vite, pnpm)
```bash
cd apps/browser-extension
pnpm install
pnpm build      # tsc --noEmit && vite build
pnpm test       # vitest run
# note: lint carries tracked debt and is non-blocking in CI
```

### TUI (Go) — `apps/tui-go` (Go 1.26)
```bash
cd apps/tui-go
make build
make test
```

### TUI (Python) — `apps/tui-py` (Python 3.12+)
```bash
cd apps/tui-py
pip install -e .
pytest --cov=cv_tui --cov-report=term-missing
```

### TUI (Rust) — `apps/tui-rs` (edition 2021)
```bash
cd apps/tui-rs
cargo build --locked
cargo test --locked
```

### Generation engine — `packages/pipeline` (Python 3.11)
```bash
cd packages/pipeline
pip install -r requirements.txt -r requirements-dev.txt
pytest tests/ -v --tb=short
```

## Continuous integration

`.github/workflows/ci.yml` runs a per-language matrix (Go, Node/pnpm, Python,
Rust) gated by path filters, so only the affected subprojects run on a given
change. The browser-extension lint job is non-blocking pending resolution of
tracked lint debt.

## Configuration

Copy `.env.example` to `.env` and fill in the required values. No real secrets,
credentials, or personal data are committed to this repository; a
confidentiality audit (`tools/audit-confidential.sh`) enforces this in CI.

## Origin

The document generation engine derives from the `cv-pipeline` project. This
monorepo unifies the previously separate API, client, and engine repositories
into a single codebase with one shared history.

## License

Licensed under the MIT License. See [`LICENSE`](./LICENSE).
