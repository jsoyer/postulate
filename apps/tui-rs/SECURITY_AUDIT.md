# Security Audit Report — cv-tui-rs

**Date** : 2026-03-10
**Version auditée** : 0.1.0 (commit 2f15ae3)
**Méthode** : Analyse statique manuelle, 17 fichiers Rust + Cargo.toml

---

## Résumé des risques

| Sévérité | Trouvé | Corrigé | Restant |
|----------|--------|---------|---------|
| Critical | 1 | ✅ 1 | 0 |
| High | 3 | ✅ 3 | 0 |
| Medium | 3 | ✅ 1 | 2 |
| Low | 4 | ✅ 1 | 3 |
| Info | 5 | — | — |

---

## Corrections appliquées (commit 2f15ae3)

### ✅ CRITICAL-01 — Authentification WebSocket migrée vers header `X-API-Key`

**Fichier** : `src/api/client.rs`
**Problème initial** : `format!("{}/ws/actions/{}?token={}", ws_base, target, self.api_key)` — clé API exposée dans l'URL (logs de proxy, historique browser).
**Fix appliqué** : La clé est transmise via le header HTTP `X-API-Key` lors du handshake WebSocket upgrade, cohérent avec Go/Python et accepté par `auth.go:363`.
```rust
let ws_url = format!("{}/ws/actions/{}", ws_base, url_encode(target));
let mut ws_request = ws_url.into_client_request()?;
ws_request.headers_mut().insert(
    "X-API-Key",
    HeaderValue::from_str(&self.api_key)
        .map_err(|e| AppError::Api(format!("invalid api key header: {e}")))?,
);
let (ws_stream, _) = connect_async(ws_request).await?;
```

---

### ✅ HIGH-01 — Clé API exposée via argument CLI (`ps aux`)

**Fichier** : `src/main.rs:38-39`
**Problème** : Flag `--api-key` visible dans la table des processus (`ps aux`, `htop`).
**Fix appliqué** : Flag supprimé. Utiliser `CV_API_KEY` (variable d'environnement, non visible dans `ps aux`) ou le fichier de config.

---

### ✅ HIGH-02 — Path traversal dans les URLs API

**Fichier** : `src/api/client.rs:271,398`
**Problème** : Noms d'applications et targets interpolés directement dans les URLs sans encoding. Un nom `../admin` produisait `GET /api/applications/../admin`.
**Fix appliqué** :
```rust
// get_application
let url = format!("{}/api/applications/{}", self.base_url, url_encode(name));

// execute_action
let url = format!("{}/api/actions/{}", self.base_url, url_encode(target));
```

---

### ✅ HIGH-03 — Getter `api_key()` public

**Fichier** : `src/api/client.rs:96-99`
**Problème** : `pub fn api_key()` facilitait la fuite accidentelle de la clé (logs, UI).
**Fix appliqué** : Changé en `pub(crate)`.

---

### ✅ MEDIUM-03 — `ApiConfig` derive `Debug` (fuite clé)

**Fichier** : `src/config.rs:12`
**Problème** : `#[derive(Debug)]` sur `ApiConfig` imprimait la clé API en clair dans tout `dbg!()` ou contexte d'erreur.
**Fix appliqué** : Impl `Debug` manuelle :
```rust
impl std::fmt::Debug for ApiConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiConfig")
            .field("base_url", &self.base_url)
            .field("api_key", &"[REDACTED]")
            .field("timeout_secs", &self.timeout_secs)
            .finish()
    }
}
```

---

### ✅ LOW-04 — `tokio features = ["full"]` trop large

**Fichier** : `Cargo.toml:16`
**Problème** : Activait `process`, `fs`, `signal` non utilisés.
**Fix appliqué** :
```toml
tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "sync", "net", "io-util"] }
```

---

## TODOs sécurité restants

### 🟠 MEDIUM-01 — Pas de validation du scheme URL

**Fichier** : `src/api/client.rs` — `ApiClient::new()`
**Problème** : Aucune validation que `base_url` commence par `https://` pour les hôtes distants. La clé API est envoyée en clair sur HTTP.
**Fix recommandé** :
```rust
pub fn new(base_url: String, api_key: String, timeout_secs: u64) -> Result<Self> {
    let is_local = base_url.contains("localhost")
        || base_url.contains("127.0.0.1")
        || base_url.contains("[::1]");
    if base_url.starts_with("http://") && !is_local {
        eprintln!("Warning: API key transmitted over unencrypted HTTP to remote host");
    }
    // ...
}
```

### 🟠 MEDIUM-02 — Pas de validation ni limite sur les champs NewApp

**Fichier** : `src/app.rs` — `advance_new_app_field()`
**Problème** : Champ URL sans validation de format. Pas de limite de longueur (200 chars recommandé).
**Fix recommandé** :
```rust
const MAX_FIELD_LEN: usize = 200;

// Dans handle_filter_char pour View::NewApp :
if current_field_len >= MAX_FIELD_LEN { return; }

// Dans advance_new_app_field() :
if !self.new_app.url.is_empty()
    && !self.new_app.url.starts_with("http://")
    && !self.new_app.url.starts_with("https://")
{
    self.new_app.error = Some("URL must start with http:// or https://".into());
    return;
}
```

### 🟡 LOW-02 — Slicing UTF-8 non-safe (panic sur CJK)

**Fichiers** : `src/ui/apps.rs:285`, `src/ui/kanban.rs:170`
**Problème** : `&s[..max]` panique si `max` tombe au milieu d'un caractère multi-octets.
**Fix recommandé** :
```rust
fn safe_truncate(s: &str, max_chars: usize) -> &str {
    match s.char_indices().nth(max_chars) {
        Some((idx, _)) => &s[..idx],
        None => s,
    }
}
```

### 🟡 LOW-03 — Buffer de sortie non plafonné (risque OOM)

**Fichier** : `src/app.rs` — `apply_msg()` handlers `ActionOutput` et `AuditOutput`
**Problème** : Actions longues peuvent remplir la RAM.
**Fix recommandé** :
```rust
AppMsg::ActionOutput(line) => {
    const MAX_OUTPUT: usize = 10_000;
    if self.actions.output.len() >= MAX_OUTPUT {
        self.actions.output.remove(0);
    }
    self.actions.output.push(line);
}
```

---

## Points positifs (contrôles en place)

- Terminal restauré via RAII guard ET panic hook — aucun risque de terminal cassé
- Clé API envoyée via header `X-API-Key` pour HTTP (pas dans l'URL)
- Timeout HTTP configurable (défaut 30s) — pas de hang infini
- Retry uniquement sur erreurs transport (pas sur 4xx/5xx)
- Vérification TLS activée par défaut (reqwest + native-tls)
- Aucun code `unsafe` dans tout le projet
- Binaire release strippé (`strip = true`)
- Pas de framework de logging qui pourrait enregistrer les secrets
- Erreurs gérées proprement via canal `AppMsg` (pas de panic)
- Dépendances sans CVE critique connus au 2026-03-10

---

## Dépendances vérifiées

| Crate | Version | Status |
|-------|---------|--------|
| reqwest | 0.12.x | ✅ OK |
| tokio-tungstenite | 0.26.x | ✅ OK |
| tokio | 1.50.x | ✅ OK |
| chrono | 0.4.44 | ✅ OK |
| urlencoding | 2.x | ✅ OK (nouveau) |

Pour vérifier les CVE en continu :
```bash
cargo install cargo-audit
cargo audit
```
