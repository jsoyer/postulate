# cv-tui-go — Backlog / TODO

> Mis a jour: 2026-03-10
> CI vert. Tout est pousse. Pret pour integration et dev sur nouvelle machine.

---

## Priorite 1 — Bloquant (faire en premier)

### Test d'integration avec le vrai cv-api
Le client n'a **jamais ete teste contre un vrai serveur** cv-api. A faire absolument:
- Lancer cv-api localement
- Configurer `~/.config/cv/config.toml` (base_url + api_key)
- Naviguer dans chaque vue (Dashboard, Apps, Kanban, Actions, Stats, Audit)
- Tester le streaming WebSocket: tailor, review, score, prep
- Verifier que l'invalidation du cache fonctionne (creer une app, voir si la liste se met a jour)
- Tester le batch tailor (4 themes en parallele)
- Tester l'audit: picker d'app -> streaming -> affichage score/barres

### Scroll viewport dans les vues streaming
`viewOutput()` dans `runner.go` et `audit.go` affiche seulement les N dernieres lignes. Pas de scroll.

Fix recommande — utiliser `bubbles/viewport`:
```go
import "github.com/charmbracelet/bubbles/viewport"

// Dans le modele:
vp viewport.Model

// Dans Init ou apres WindowSizeMsg:
m.vp = viewport.New(m.width, m.height-headerHeight)

// Quand output change:
m.vp.SetContent(strings.Join(m.output, "\n"))
m.vp.GotoBottom()

// Dans View():
return m.vp.View()
```

---

## Priorite 2 — Important (prochain sprint)

### Feedback erreur sur CreateApplication
Dans `app.go`, la fonction `handleNewAppSubmit()` ignore silencieusement les erreurs API:
```go
if err != nil {
    return nil  // l'utilisateur ne voit rien
}
```
Fix: envoyer un message flash visible dans la status bar ou afficher une erreur inline.

### Kanban: changer le statut d'une candidature
Le kanban affiche les colonnes mais n'implemente pas le deplacement de carte.
- Touche `enter` ou `->` sur une carte: appel `PUT /api/applications/{name}` avec nouveau statut
- Ou modal de confirmation avec les statuts disponibles
- Fichier: `internal/ui/kanban/board.go`

### Vue Settings
`internal/api/settings.go` expose `GetSettings()` et `UpdateSettings()` mais pas de vue UI.
Options:
- Ajouter un onglet 7 "Settings" dans `app.go`
- Ou une overlay modale accessible depuis la status bar

### Tests manquants sur les vues complexes
Ces packages n'ont aucun test:
- `internal/ui/actions/runner.go` — 3 phases, channel streaming, provider detection
- `internal/ui/audit/audit.go` — parsing JSON, barres de progres
- `internal/ui/apps/list.go` — filtre de recherche
- `internal/ui/apps/detail.go` — quick actions, batch, modales
- `internal/ui/dashboard/dashboard.go`
- `internal/ui/kanban/board.go`

Approche: tests unitaires BubbleTea (envoyer KeyMsg, verifier View() ou msg emis).

---

## Priorite 3 — Ameliorations (quand possible)

### Recherche en temps reel dans la liste
`apps/list.go` a un champ de recherche. Verifier qu'il filtre bien en tapant (pas seulement sur Enter).

### Pagination pour longues listes
Si > 50 applications, la liste et le kanban peuvent etre lents. Ajouter une fenetre glissante.

### Overlay d'aide `?`
Modal keybindings accessible via `?` depuis n'importe quelle vue.

### `health` subcommand: afficher la version API
`cmd/cv/main.go` fait GET /health — afficher aussi la version du serveur si disponible.

### Release binaries
- `.github/workflows/release.yml` est configure et fonctionnel (goreleaser)
- Creer un tag `v0.1.0` pour declencher la premiere release:
  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

### Homebrew formula
Pour installation facile: `brew install jsoyer/tap/cv-tui-go`
- Creer le repo `homebrew-tap` chez jsoyer
- Configurer HOMEBREW_TAP_GITHUB_TOKEN dans les secrets GitHub
- Retirer `--skip=brew` du release workflow

---

## Deja fait (reference)

- Port complet cv-tui-py -> Go (6 vues)
- Dashboard, Applications (list+detail), Kanban, Actions, Stats, Audit
- Formulaires modaux: NewApp, Notes, ThemePicker
- Quick actions: tailor/review/build/score/prep/batch
- Batch tailor 4 themes en parallele
- Provider detection avec badges couleur
- App picker (liste j/k)
- Securite: TLS 1.2+, X-API-Key header, io.LimitReader, flag insecure
- Migration gorilla -> coder/websocket
- Cache TTL + invalidation prefixe
- Retry GET backoff exponentiel
- 34 tests unitaires (api, config, forms)
- golangci-lint v2 (tout vert, toutes les erreurs corrigees)
- CI GitHub Actions (Build+Test+Lint, tout vert)
- Release workflow goreleaser
- Documentation complete (docs/)

---

## Notes dev

### Pattern BubbleTea: modal overlay
```go
// Dans View():
if m.modalActive {
    return m.myForm.View()  // plein ecran
}
// Sinon rendu normal
```

### Pattern streaming WebSocket
Voir `internal/ui/actions/runner.go:startStream()` et `readNextStream()`.
Goroutine -> channel buffere(100) -> BubbleTea Cmds un message a la fois.

### Palette Catppuccin Mocha
Voir `internal/ui/common/styles.go` — toutes les couleurs sont des constantes lipgloss.

### Linter errcheck: pattern correct
```go
// Mauvais:
defer resp.Body.Close()
conn.CloseNow()
client.StreamAction(...)

// Correct:
defer func() { _ = resp.Body.Close() }()
defer func() { _ = conn.CloseNow() }()
_ = client.StreamAction(...)
```

### WebSocket: resp.Body peut etre nil
```go
// Toujours tester les deux:
if resp != nil && resp.Body != nil {
    defer func() { _ = resp.Body.Close() }()
}
```
