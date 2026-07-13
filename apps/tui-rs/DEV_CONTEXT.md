# Contexte de développement — cv-tui-rs

> Notes techniques pour reprendre le dev sur une nouvelle machine.

## Statut du build (mis à jour 2026-06-26)

| Commande | Résultat |
|---|---|
| `cargo check` | ✅ 0 erreur, 2 warnings (dead_code) |
| `cargo build` | ✅ succès |
| `cargo build --release` | ✅ succès |
| `cargo test` | ✅ 5/5 tests passent |
| `cargo clippy` | ⚠️ non disponible (rust-clippy RPM absent) |

TLS : rustls (pas d'OpenSSL requis).

## Session de dev du 2026-03-10

### Ce qui a été fait dans cette session

Portage complet de `cv-tui-py` (Python/Textual) vers `cv-tui-rs` (Rust/Ratatui),
avec audit de sécurité et documentation complète.

**Agents utilisés** :
1. `Explore` — analyse comparative des deux projets
2. `rust-engineer` (API) — portage de la couche API
3. `rust-engineer` (UI) — portage des features UI
4. `security-auditor` — audit de sécurité
5. `documentation-engineer` — documentation

### Différences architecture Python vs Rust

| Aspect | Python (Textual) | Rust (Ratatui) |
|--------|-----------------|----------------|
| Paradigme UI | Réactif (update sur événement) | Immédiat (redraw chaque frame ~250ms) |
| Async | `run_worker()` intégré | `tokio::spawn()` + canal `mpsc` |
| Thème | CSS Textual | Constantes `CatppuccinMocha` |
| Modals | `push_screen()` / `pop_screen()` | Nouvelle `View` overlay |
| Input texte | Widgets `Input` | Raw mode + `handle_filter_char()` |

### Décisions de design prises

**WebSocket auth via header `X-API-Key`** :
L'authentification est transmise dans le header HTTP lors du handshake WebSocket upgrade,
cohérent avec tous les autres clients (Go, Python) et accepté par le serveur (auth.go).

**Views Audit et NewApp = overlays, pas des tabs** :
- Pas dans `TAB_ORDER` ni `TAB_NAMES`
- `tab_index()` retourne un index existant (ne highlighte pas de tab)
- Accessibles via touches contextuelles (`n`, `a`)
- `prev_view` sauvegardé pour le retour

**Fallback WebSocket → HTTP** :
Si `stream_action()` échoue (WS non supporté par le serveur), `spawn_stream_action()`
bascule automatiquement sur `execute_action()` (HTTP POST synchrone).

**Cache partagé entre clones** :
`Arc<tokio::sync::Mutex<HashMap>>` → tous les clones de `ApiClient` (dans les tokio tasks)
partagent le même cache. Un hit dans une task profite à toutes.

### Pattern `__prefill__` dans l'écran Audit

Pour pré-sélectionner une application dans l'écran Audit depuis le détail,
un sentinel `__prefill__<name>` est stocké temporairement dans `self.audit.error`.
C'est un code smell identifié — à remplacer par un champ dédié dans `AuditState` :
```rust
pub struct AuditState {
    // ...
    pub prefill_app: String,  // ajouter ce champ, remplacer le sentinel
}
```

### Fichiers modifiés dans cette session

```
Cargo.toml              — ajout urlencoding, réduction features tokio
src/api/client.rs       — réécriture complète (486 lignes)
src/api/models.rs       — ajout Serialize sur certains types
src/api/actions.rs      — réduit à stub (code déplacé dans client.rs)
src/api/applications.rs — réduit à stub (code déplacé dans client.rs)
src/app.rs              — +570 lignes (Audit, NewApp, actions détail)
src/config.rs           — env vars + Debug redacté
src/events.rs           — 6 nouvelles actions (Tailor, Review, Build, Score, Prep, Audit)
src/main.rs             — suppression --api-key, is_new_app_mode, apply_env_overrides
src/ui/mod.rs           — dispatch Audit et NewApp
src/ui/apps.rs          — boutons détail interactifs
src/ui/audit.rs         — NOUVEAU fichier
src/ui/new_app.rs       — NOUVEAU fichier
```

Documentation créée/mise à jour : voir `HANDOFF.md`.

## Environnement de développement recommandé

```bash
# Rust toolchain
rustup default stable
rustup component add clippy rustfmt

# Outils de dev
cargo install cargo-watch   # hot reload : cargo watch -x run
cargo install cargo-audit   # vérif CVE
cargo install cargo-expand  # debug macros

# Workflow quotidien
cargo watch -x check        # vérif en continu
cargo fmt && cargo clippy   # avant chaque commit
```

## Liens utiles

- **cv-api** (backend) : `~/Documents/Github/cv-api`
- **cv-tui-py** (référence) : `~/Documents/Github/cv-tui-py`
- **Ratatui docs** : https://ratatui.rs
- **Crossterm docs** : https://docs.rs/crossterm
- **tokio-tungstenite** : https://docs.rs/tokio-tungstenite

## Variables d'environnement utiles en dev

```bash
# Pointer vers une instance locale de cv-api
export CV_API_URL="http://localhost:3001"
export CV_API_KEY="dev-key"

# Lancer en mode debug avec rechargement
cargo watch -x 'run -- --config ./config.example.toml'
```
