# TODO — cv-tui-rs

> Mis à jour le 2026-03-10. Référence principale pour reprendre le développement.

## Légende
- 🔴 Bloquant / Critique
- 🟠 Priorité haute
- 🟡 Priorité moyenne
- 🟢 Nice to have

---

## Phase 1 — Compilation (BLOQUANT)

### 🔴 Faire compiler le projet

Le code a été écrit par des agents IA sans compilation (Rust absent sur le Pi).
**Commencer par ici sur la nouvelle machine.**

```bash
cargo check    # identifier toutes les erreurs
cargo build    # compiler
```

#### Zones à risque (potentiels conflits)

`src/app.rs` a été modifié par **2 agents en parallèle**. Vérifier :

- [ ] `View` enum contient bien : `Dashboard`, `Apps`, `AppDetail`, `Kanban`, `Actions`, `Stats`, `Audit`, `NewApp`
- [ ] `tab_index()` retourne des valeurs cohérentes (Audit et NewApp ne sont PAS dans les tabs)
- [ ] `TAB_ORDER` ne contient pas `Audit` ni `NewApp`
- [ ] `App` struct a les champs : `audit: AuditState`, `new_app: NewAppState`
- [ ] `AppMsg` enum a tous les variants : `AuditAppsLoaded`, `AuditOutput`, `AuditDone`, `AuditError`, `AppCreated`, `AppCreateError`, `HealthStatus`
- [ ] `handle_action()` dispatche `Action::Tailor`, `Action::Review`, `Action::Build`, `Action::Score`, `Action::Prep`, `Action::Audit`, `Action::New`
- [ ] `handle_filter_char()` gère `View::NewApp`
- [ ] `handle_backspace()` gère `View::NewApp`

`src/ui/mod.rs` — vérifier que les dispatches sont présents :
- [ ] `View::Audit => audit::render(frame, app, content)`
- [ ] `View::NewApp => new_app::render(frame, app, content)`

`src/main.rs` — vérifier que `is_new_app_mode` est géré pour intercepter les caractères.

---

## Phase 2 — Sécurité (petits TODOs restants)

### 🟠 Validation URL dans le formulaire NewApp

**Fichier** : `src/app.rs` — méthode `advance_new_app_field()`

Le champ `url` n'est pas validé. Ajouter :
```rust
// Si url non vide, doit commencer par http:// ou https://
if !self.new_app.url.is_empty()
    && !self.new_app.url.starts_with("http://")
    && !self.new_app.url.starts_with("https://")
{
    self.new_app.error = Some("URL must start with http:// or https://".to_string());
    return;
}
```

### 🟠 Limite de longueur sur les champs texte

**Fichier** : `src/app.rs` — méthode `handle_filter_char()`

Ajouter une limite (200 chars) sur les champs NewApp et le filtre Apps :
```rust
const MAX_FIELD_LEN: usize = 200;
```

### 🟡 Buffer de sortie plafonné (prévention OOM)

**Fichier** : `src/app.rs` — handlers `ActionOutput` et `AuditOutput` dans `apply_msg()`

```rust
AppMsg::ActionOutput(line) => {
    if self.actions.output.len() >= 10_000 {
        self.actions.output.remove(0);
    }
    self.actions.output.push(line);
}
```

### 🟡 Validation scheme URL dans ApiClient::new()

**Fichier** : `src/api/client.rs`

Avertir si `base_url` utilise `http://` vers un hôte non-local :
```rust
if base_url.starts_with("http://")
    && !base_url.contains("localhost")
    && !base_url.contains("127.0.0.1")
    && !base_url.contains("[::1]")
{
    eprintln!("Warning: API key will be sent over unencrypted HTTP");
}
```

### 🟡 Fix UTF-8 slicing (panic potentiel sur CJK)

**Fichiers** : `src/ui/apps.rs:285`, `src/ui/kanban.rs:170`

Remplacer le slicing direct par une version safe :
```rust
// Au lieu de : &s[..max.saturating_sub(3)]
fn truncate_str(s: &str, max_chars: usize) -> &str {
    let mut char_indices = s.char_indices();
    if let Some((idx, _)) = char_indices.nth(max_chars) {
        &s[..idx]
    } else {
        s
    }
}
```

---

## Phase 3 — Tests

### 🟠 Tests unitaires des transitions d'état

**Nouveau fichier** : `src/app_tests.rs` ou `#[cfg(test)]` dans `src/app.rs`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Test: naviguer dans la liste apps
    #[test]
    fn test_apps_cursor_navigation() { ... }

    // Test: filtre reset le curseur
    #[test]
    fn test_apps_filter_resets_cursor() { ... }

    // Test: switch_view lazy init
    #[test]
    fn test_switch_view_marks_initialized() { ... }

    // Test: back depuis AppDetail revient à Apps
    #[test]
    fn test_back_from_detail_returns_to_apps() { ... }

    // Test: kanban clamp_row
    #[test]
    fn test_kanban_clamp_row() { ... }
}
```

### 🟠 Tests du parsing audit JSON

```rust
#[test]
fn test_parse_audit_json_full() {
    let json = r#"{"score": 82.5, "metrics": {"structure": 90, "content": 75}, "duplicates": ["foo"], "overused_words": ["bar"]}"#;
    let result = parse_audit_json(json);
    assert_eq!(result.score, Some(82.5));
    assert_eq!(result.metrics.get("structure"), Some(&90.0));
}

#[test]
fn test_parse_audit_json_invalid() {
    assert!(parse_audit_json("not json").score.is_none());
}
```

### 🟠 Tests du cache TTL

```rust
#[tokio::test]
async fn test_cache_expires() {
    // créer un CacheEntry avec expires = Instant::now() - 1ms
    // vérifier que is_valid() retourne false
}
```

### 🟡 Snapshot tests UI (Ratatui)

Utiliser `insta` + backend buffer de ratatui pour tester le rendu :
```bash
cargo add --dev insta
```

---

## Phase 4 — Features ROADMAP (par impact)

### 🟠 Score de santé CV dans la liste Applications

**Impact** : voir l'état de chaque CV sans ouvrir le détail

Dans `src/ui/apps.rs`, ajouter une colonne "Score" dans la table.
Nécessite de stocker le score dans `Application` model ou de le fetcher séparément.

### 🟠 AI provider dans la status bar

**Impact** : savoir quel modèle AI est utilisé sans aller dans les logs

Dans `src/ui/mod.rs` — `render_status_bar()`, ajouter le provider courant.
L'info vient de l'output des actions (détecter "gemini", "claude", "openai", "ollama").

### 🟠 `--log-level` CLI flag + structured logging

```bash
cargo add tracing tracing-subscriber
```

```rust
// main.rs
#[arg(long, default_value = "warn")]
log_level: String,
```

### 🟡 Notes par application

Champ `notes` dans `Application` model (si cv-api le supporte).
Vue dans le détail, éditeur inline simple.

### 🟡 CI/CD GitHub Actions

**Nouveau fichier** : `.github/workflows/release.yml`

```yaml
on:
  push:
    tags: ['v*']
jobs:
  build:
    matrix:
      os: [ubuntu-latest, macos-latest, macos-13]  # linux, macOS arm64, macOS x86
```

Publier les binaires sur GitHub Releases.

### 🟡 Homebrew formula

**Repo** : `homebrew-tap` (existe déjà dans `~/Documents/Github/homebrew-tap`)

```ruby
# Formula/cv-rs.rb
class CvRs < Formula
  desc "Ratatui TUI client for cv-api"
  homepage "https://github.com/jsoyer/cv-tui-rs"
  ...
end
```

### 🟢 Sélecteur de thème interactif

Dans le formulaire de détail, un mini-picker pour choisir le thème CV
(catppuccin-mocha, catppuccin-latte, dracula, nord) avant de lancer Tailor.

---

## Phase 5 — Optimisations

### 🟡 HTTP/2 + connection pooling

```rust
reqwest::Client::builder()
    .http2_prior_knowledge()  // si le serveur supporte HTTP/2
    .pool_max_idle_per_host(4)
    ...
```

### 🟡 Task cancellation gracieuse

Garder un `JoinHandle` ou `CancellationToken` pour les tâches longues (action running).
Permettre d'annuler avec `Ctrl+C` sans quitter le TUI.

### 🟢 Lazy loading détails

Ne pas fetcher `get_application()` immédiatement à l'ouverture du détail.
Afficher les infos de base (déjà dans la liste) et charger les fichiers en arrière-plan.

---

## Notes de développement

### Pattern architectural à respecter

```rust
// Toujours spawner les tâches async comme ça :
fn fetch_something(&self) {
    let tx = self.tx.clone();
    let client = self.api.clone();
    tokio::spawn(async move {
        match client.something().await {
            Ok(data) => { let _ = tx.send(AppMsg::SomethingLoaded(data)); }
            Err(e)   => { let _ = tx.send(AppMsg::SomethingError(e.to_string())); }
        }
    });
}
```

### Ajouter une nouvelle vue

1. Ajouter variant dans `enum View` avec `tab_index()` approprié
2. Si c'est un tab : ajouter dans `TAB_ORDER` et `TAB_NAMES`
3. Créer un `XxxState` struct avec `Default`
4. Ajouter `pub xxx: XxxState` dans `App`
5. Ajouter les `AppMsg` variants nécessaires
6. Gérer dans `apply_msg()`, `handle_action()`, `fetch_for_view()`
7. Créer `src/ui/xxx.rs` avec `pub fn render(frame, app, area)`
8. Ajouter le dispatch dans `src/ui/mod.rs`
9. Si overlay (pas tab) : gérer le raw input dans `src/main.rs`

### Commandes utiles

```bash
cargo check                    # vérification rapide sans linker
cargo build                    # debug build
cargo build --release          # release optimisé (~5MB strip)
cargo clippy -- -D warnings    # linter strict
cargo fmt                      # formatter
cargo test                     # tests

# Lancer
./target/debug/cv-rs
./target/release/cv-rs

# Avec config custom
./target/release/cv-rs --config ./config.example.toml
```
