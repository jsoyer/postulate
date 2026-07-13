# Handoff Document — cv-tui-rs

> Généré le 2026-03-10. Consulter ce fichier en premier sur la nouvelle machine.

## Contexte du projet

`cv-tui-rs` est le portage Rust/Ratatui de `cv-tui-py` (Python/Textual).
Les deux projets sont des TUI clients pour `cv-api`, un backend de gestion de candidatures.

```
~/Documents/Github/
├── cv-api          # backend (FastAPI ou équivalent)
├── cv-tui-py       # référence Python (Textual) — NE PAS MODIFIER
└── cv-tui-rs       # ce projet — Rust/Ratatui
```

## État au moment du handoff

### Ce qui est implémenté et commité (commit 2f15ae3)

| Composant | État | Fichier(s) |
|-----------|------|------------|
| API client complet | ✅ Écrit | `src/api/client.rs` |
| Cache TTL | ✅ Écrit | `src/api/client.rs` |
| Retry + backoff | ✅ Écrit | `src/api/client.rs` |
| WebSocket streaming | ✅ Écrit | `src/api/client.rs` |
| Env vars override | ✅ Écrit | `src/config.rs` |
| Écran Audit | ✅ Écrit | `src/ui/audit.rs`, `src/app.rs` |
| Dialogue Nouvelle App | ✅ Écrit | `src/ui/new_app.rs`, `src/app.rs` |
| Boutons détail (t/v/b/s/p/a) | ✅ Écrit | `src/ui/apps.rs`, `src/app.rs` |
| Corrections sécurité | ✅ Écrit | voir `SECURITY_AUDIT.md` |
| Documentation complète | ✅ Écrit | `docs/` |

### ✅ Compilation vérifiée (2026-06-26)

Le code compile sans erreurs avec `cargo build` et `cargo build --release`.
Les 5 tests unitaires passent (`cargo test`).
TLS backend : rustls (pas de dépendance OpenSSL).

## Première étape sur la nouvelle machine

```bash
# 1. Cloner si pas encore fait
git clone https://github.com/jsoyer/cv-tui-rs.git
cd cv-tui-rs

# 2. Vérifier que Rust est installé
rustc --version   # besoin de >= 1.75
cargo --version

# Si pas installé :
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. Première compilation (va télécharger toutes les dépendances)
cargo check       # rapide, détecte les erreurs de type
cargo build       # compilation debug complète
cargo build --release  # binaire final optimisé

# 4. Lancer le TUI
./target/release/cv-rs --help
./target/release/cv-rs --config ~/.config/cv/config.toml
```

## Ce qu'il faut faire ensuite (par priorité)

Voir `TODO.md` pour la liste complète et détaillée.

### Priorité 1 — Compilation ✅ RÉSOLU
`cargo check`, `cargo build`, `cargo build --release` et `cargo test` passent tous.
5 tests unitaires ajoutés dans `src/app.rs`.

### Priorité 2 — Tests ✅ BASE AJOUTÉE
5 tests unitaires dans `src/app.rs` (`#[cfg(test)]` module) :
- `apply_filter_empty_returns_all`
- `kanban_clamp_row_empty_col_resets_to_zero`
- `parse_audit_json_empty_string_returns_none_score`
- `parse_audit_json_valid_json_returns_score`
- `view_tab_index_overlay_returns_stats_tab`

À compléter : tests du cache TTL, tests des transitions d'état async.

### Priorité 3 — Sécurité (petits TODO restants)
Voir `SECURITY_AUDIT.md` section "Remaining TODOs".

### Priorité 4 — Features ROADMAP
Voir `ROADMAP.md` et `TODO.md`.

## Arborescence du projet

```
cv-tui-rs/
├── src/
│   ├── main.rs          # entry point, event loop, CLI (clap)
│   ├── app.rs           # App state machine, View enum, AppMsg channel
│   ├── config.rs        # Config TOML + env var overrides
│   ├── error.rs         # AppError (thiserror)
│   ├── events.rs        # Action enum, handle_key()
│   ├── api/
│   │   ├── mod.rs
│   │   ├── client.rs    # ApiClient complet (cache, retry, WS)
│   │   ├── models.rs    # Serde models (Application, Target, etc.)
│   │   ├── actions.rs   # stub (vide)
│   │   └── applications.rs # stub (vide)
│   └── ui/
│       ├── mod.rs       # render() dispatcher
│       ├── theme.rs     # CatppuccinMocha colors
│       ├── dashboard.rs
│       ├── apps.rs      # liste + détail avec boutons
│       ├── kanban.rs
│       ├── actions.rs
│       ├── stats.rs
│       ├── audit.rs     # NOUVEAU — écran audit
│       └── new_app.rs   # NOUVEAU — formulaire nouvelle app
├── docs/
│   ├── README.md        # hub de documentation
│   ├── quickstart.md
│   ├── features.md
│   ├── architecture.md
│   ├── api.md
│   ├── config.md
│   ├── keybindings.md
│   ├── installation.md
│   └── troubleshooting.md
├── HANDOFF.md           # CE FICHIER
├── TODO.md              # liste de tâches complète
├── SECURITY_AUDIT.md    # rapport de sécurité complet
├── ROADMAP.md           # vision long terme
├── Cargo.toml
└── config.example.toml
```

## Dépendances clés

```toml
ratatui = "0.29"
crossterm = "0.28"
tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "sync", "net", "io-util"] }
reqwest = { version = "0.12", features = ["json"] }
tokio-tungstenite = { version = "0.26", features = ["native-tls"] }
urlencoding = "2"     # AJOUTÉ pour sécurité (encode URL segments)
serde / serde_json
chrono (serde)
clap = "4" (derive)
thiserror = "2"
dirs = "6"
futures-util = "0.3"
```

## Configuration

Fichier : `~/.config/cv/config.toml`

```toml
[api]
base_url = "http://localhost:3001"
api_key  = "votre-cle-api"
timeout_secs = 30

[ui]
theme = "catppuccin-mocha"
```

Variables d'environnement (priorité sur le fichier) :
```bash
export CV_API_URL="http://localhost:3001"
export CV_API_KEY="votre-cle-api"
export CV_TIMEOUT=30
```

**Note sécurité** : le flag `--api-key` a été supprimé (visible dans `ps aux`).
Utiliser `CV_API_KEY` ou le fichier de config.

## Repo GitHub

```
https://github.com/jsoyer/cv-tui-rs
```
