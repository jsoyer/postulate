# cv-tui-go — Handover Document

> **Mis a jour**: 2026-03-10
> **Statut**: Feature-complete. Tests OK (34 passent). CI tout vert. Pret pour integration avec le vrai serveur cv-api.

---

## 1. Ce que c est

`cv-tui-go` est un client TUI complet pour le serveur **cv-api**, ecrit en Go avec [BubbleTea](https://github.com/charmbracelet/bubbletea). Port de `cv-tui-py` (Python/Textual) avec durcissement securite et nouvelles features.

Le TUI se connecte a `cv-api` via HTTP + WebSocket et permet :
- Gerer des candidatures (lister, creer, voir les details)
- Lancer des targets Makefile IA (tailor CV, review, build PDF, score, prep entretien)
- Streamer le resultat en temps reel via WebSocket
- Voir pipeline dashboard, kanban, stats
- Audit qualite CV avec score + barres metriques

---

## 2. Etat du repo

```
github.com/jsoyer/cv-tui-go
Branche: main
Dernier commit: 07d75b1  ci: simplify release workflow
Tout est pousse sur origin/main — aucun commit local en attente.
```

### CI GitHub Actions — TOUT VERT

| Job | Statut |
|-----|--------|
| Build & Test | passe |
| Lint (golangci-lint v2) | passe |
| Release (sur tag v*) | config valide |

### Tests locaux

```
34 tests dans 3 packages:
  internal/api         — 19 tests (cache, HTTP, WebSocket, applications)
  internal/config      —  9 tests (load, env override, insecure flag)
  internal/ui/forms    —  6 tests (NewAppForm: validation, submit, cancel, tab)
```

Note: `-race` ne fonctionne pas sur Raspberry Pi (ARM64, VMA 47-bit). Passe en CI amd64.

---

## 3. Structure du projet

```
cv-tui-go/
├── cmd/cv/main.go                   # Entry point: TUI ou sous-cmd `health`
├── config.example.toml              # Exemple de config
├── go.mod / go.sum                  # Go 1.26, module: github.com/jsoyer/cv-tui-go
├── .golangci.yml                    # Config linter v2
├── .goreleaser.yml                  # Config release binaries
├── .github/workflows/
│   ├── ci.yml                       # Push/PR: build + test + lint
│   └── release.yml                  # Tag v*: goreleaser (binaries, sans brew)
│
├── internal/
│   ├── api/
│   │   ├── client.go                # HTTP client: cache TTL, retry, LimitReader
│   │   ├── models.go                # Types: Application, Target, WSMessage...
│   │   ├── actions.go               # ExecuteAction, StreamAction (coder/websocket)
│   │   ├── applications.go          # List, Get, Create, Dashboard, Stats
│   │   ├── settings.go              # GetSettings, UpdateSettings (PUT)
│   │   ├── client_test.go           # 10 tests cache + HTTP
│   │   ├── actions_test.go          # 5 tests WebSocket streaming
│   │   └── applications_test.go     # 4 tests applications API
│   │
│   ├── config/
│   │   ├── config.go                # TOML loader, env overrides, insecure flag
│   │   └── config_test.go           # 9 tests
│   │
│   └── ui/
│       ├── app.go                   # Root model BubbleTea, 6 onglets, modales
│       ├── common/
│       │   ├── keys.go              # Keybindings globaux
│       │   └── styles.go            # Palette Catppuccin Mocha (lipgloss)
│       ├── dashboard/dashboard.go   # Vue pipeline funnel
│       ├── apps/
│       │   ├── list.go              # Liste applications (searchable)
│       │   └── detail.go            # Detail: quick actions, modales, batch
│       ├── kanban/board.go          # Kanban 5 colonnes
│       ├── actions/runner.go        # Browser targets + WS streaming + badges provider
│       ├── stats/stats.go           # Funnel chart + timeline
│       ├── audit/audit.go           # Audit: app picker -> stream -> score/metriques
│       └── forms/
│           ├── new_app.go           # Modal nouvelle candidature (3 inputs, Tab)
│           ├── new_app_test.go      # 6 tests
│           ├── notes.go             # Editeur notes (sauve dans ~/.local/share/cv-tui/)
│           └── theme.go             # Picker theme (6 themes)
│
└── docs/
    ├── architecture.md
    ├── config.md
    ├── installation.md
    ├── keybindings.md
    ├── todo.md                      # Backlog priorise
    └── views.md
```

---

## 4. Decisions techniques cles

### WebSocket: coder/websocket (pas gorilla)
- `github.com/coder/websocket v1.8.14`
- gorilla/websocket est archive; coder/websocket est maintenu activement
- API: `websocket.Dial(ctx, url, opts)` retourne `(*Conn, *http.Response, error)`
- Auth: header `X-API-Key` sur l'upgrade WebSocket (pas de query param)
- Fermeture: `defer func() { _ = conn.CloseNow() }()`
- IMPORTANT: `resp.Body` peut etre nil apres le dial meme si `resp != nil`
  Toujours tester: `if resp != nil && resp.Body != nil { defer close }`

### Cache TTL inline dans *Client
- `sync.RWMutex` + `map[string]cacheEntry{value, expiresAt}`
- TTLs: applications=60s, dashboard=60s, stats=60s, targets=300s
- Invalidation sur ecriture: CreateApplication vide le prefixe `applications:*`

### HTTP
- `http.NewRequestWithContext(context.Background(), ...)` partout (linter noctx)
- `io.LimitReader(body, 10MB)` sur toutes les reponses
- Retry GET avec backoff exponentiel (erreurs reseau `*url.Error` seulement)
- `defer func() { _ = resp.Body.Close() }()` partout (linter errcheck)
- Flag insecure: URL remote http:// -> erreur sauf si `api.insecure = true` dans config

### Pattern streaming WebSocket (BubbleTea-safe)
```go
ch := make(chan api.WSMessage, 100)
go func() {
    defer close(ch)
    _ = client.StreamAction(ctx, target, app, func(msg api.WSMessage) { ch <- msg })
}()

// Lire message par message via Cmds BubbleTea
func readNextStream(ch chan api.WSMessage) tea.Cmd {
    return func() tea.Msg {
        msg, ok := <-ch
        if !ok { return doneMsg{} }
        return streamMsg{msg}
    }
}
```

### golangci-lint v2
- Fichier: `.golangci.yml` avec `version: "2"` en haut
- `gofmt` dans la section `formatters:` (pas `linters:`)
- Exclusions test dans `linters.exclusions.rules:` (pas `issues.exclude-rules`)
- Linters actifs: errcheck, govet, ineffassign, staticcheck, misspell, bodyclose, noctx
- Action CI: `golangci/golangci-lint-action@v9` (v6 ne supporte pas v2)
- Version: `v2.11.3`

---

## 5. Configuration

Fichier: `~/.config/cv/config.toml`

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "your-secret-key"
timeout  = "30s"
# insecure = true   # Uniquement pour remote http:// non-localhost

[ui]
theme       = "catppuccin-mocha"
date_format = "2006-01-02"
```

Overrides env: `CV_API_URL`, `CV_API_KEY`

---

## 6. Setup sur nouvelle machine

```bash
# 1. Cloner
git clone https://github.com/jsoyer/cv-tui-go.git
cd cv-tui-go

# 2. Verifier Go >= 1.26
go version

# 3. Dependances
go mod download

# 4. Build
go build ./cmd/cv/...

# 5. Config
mkdir -p ~/.config/cv
cp config.example.toml ~/.config/cv/config.toml
# Editer: mettre base_url et api_key

# 6. Tests
go test ./...           # 34 tests, ~2s
go test -race ./...     # Seulement sur amd64 (pas ARM Pi)

# 7. Lancer
./cv --url http://localhost:3001
```

### Outils dev
```bash
# gopls (LSP)
go install golang.org/x/tools/gopls@latest

# golangci-lint v2
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
  | sh -s -- -b $(go env GOPATH)/bin v2.11.3
# OU via brew
brew install golangci-lint
```

---

## 7. Commandes utiles

```bash
go build ./...               # Build complet
go test ./...                # Tous les tests
golangci-lint run            # Lint
go mod tidy                  # Nettoyer dependances
cv health                    # Check API joignable
cv --verbose                 # Mode verbose
```

---

## 8. Fichiers a lire en premier

1. `internal/ui/app.go` — modele root, switching vues, modales
2. `internal/api/client.go` — cache + HTTP client
3. `internal/api/actions.go` — streaming WebSocket
4. `internal/ui/actions/runner.go` — vue la plus complexe (3 phases, channel streaming)
5. `internal/ui/common/keys.go` — tous les keybindings
6. `internal/ui/common/styles.go` — palette Catppuccin Mocha

---

## 9. Ce qui est fait

- Port complet cv-tui-py -> Go (6 vues: Dashboard, Applications, Kanban, Actions, Stats, Audit)
- Formulaires modaux: NewApp, Notes, ThemePicker
- Quick actions depuis detail: tailor/review/build/score/prep/batch
- Batch tailor (4 themes en parallele)
- Provider detection: Gemini/Claude/OpenAI/Mistral/Ollama avec badges couleur
- App picker pour arg NAME (liste j/k)
- Securite: TLS 1.2+, X-API-Key header, io.LimitReader(10MB), flag insecure
- Migration gorilla -> coder/websocket
- Cache TTL + invalidation prefixe
- Retry GET avec backoff exponentiel
- 34 tests unitaires (api, config, forms)
- golangci-lint v2 (tout vert)
- CI GitHub Actions: Build+Test+Lint, tout vert
- Release workflow goreleaser (sur tag v*)
- Documentation complete (docs/)

---

## 10. Ce qui reste

Voir `docs/todo.md` pour le backlog complet avec priorites.

Resume priorites hautes:
1. Test d'integration avec le vrai cv-api (jamais teste end-to-end)
2. Scroll viewport dans runner.go et audit.go (output tronque)
3. Feedback erreur sur CreateApplication (silencieux actuellement)
4. Kanban: changer statut via API (PUT /api/applications/{name})
5. Vue Settings (API client existe, pas de UI)

---

## 11. Dependances

| Package | Version | Usage |
|---------|---------|-------|
| `github.com/charmbracelet/bubbletea` | v1.3.5 | Framework TUI |
| `github.com/charmbracelet/bubbles` | v0.21.0 | textinput, textarea, spinner |
| `github.com/charmbracelet/lipgloss` | v1.1.0 | Styles terminal |
| `github.com/coder/websocket` | v1.8.14 | Client WebSocket |
| `github.com/BurntSushi/toml` | v1.5.0 | Parsing config |
