# ROADMAP cv-pipeline

## Statut : v1.0 — Fonctionnel en production

Pipeline opérationnel. Utilisé en production pour candidater (ex. Anthropic, selon README).
87 scripts Python, 16 workflows CI/CD, 5 providers IA, 2 langues (EN/FR).

---

## Fait

### Rendu & build
- Rendu YAML → LaTeX via `render.py` : escaping complet, `**bold**` → `\textbf{}`, support Awesome-CV
- Compilation XeLaTeX avec auto-détection multi-plateforme et sous-module `awesome-cv/`
- Support PDF/A-2b (XMP metadata via `CV.xmpdata`, validation `check-pdfa.py`)
- Watermark DRAFT, validation du nombre de pages (CV ≤ 2p, CL ≤ 1p)
- Rendu multilingue EN/FR (`cv-fr.yml`, `cv-fr-tailor.py`)
- Export multi-format : JSON, Markdown, texte plat ATS-safe, DOCX (pandoc), JSON Resume v1.0.0

### IA & tailoring
- Caller IA unifié (`lib/ai.py`) : 5 providers (Gemini, Claude, OpenAI, Mistral, Ollama), retry avec backoff, fallback de modèle, cache TTL configurable, validation JSON des réponses
- Tailoring IA CV + lettre de motivation par offre (`ai-tailor.py`)
- Scoring ATS avant/après tailoring (`ats-score.py`) avec historique et tendances
- ATS rank, ATS text export, keyword gap analysis, blind spots (objections silencieuses)
- Comparaison de providers côte à côte (`compare-providers.py`)
- Traduction + adaptation FR (`cv-fr-tailor.py`)
- Prédiction d'issue par régression logistique sur l'historique ATS (`interview-predictor.py`)
- Recherche sémantique TF-IDF (`semantic-search.py`)

### Pipeline candidature
- Workflow complet `make apply` : branche git `apply/YYYY-MM-slug`, scaffold, fetch fiche, commit, PR draft
- Fetch et parsing de fiches de poste depuis URL (`fetch-job.py`)
- Job matching / reverse ATS (`match.py`, `job-match.py`)
- Score d'adéquation personnelle (`job-fit.py`)
- Validation YAML via JSON Schema (`data/cv-schema.json`)
- Gestion de versions CV nommées (`cv-versions.py`)
- YAML beautifier / normaliseur (`yaml-beautify.py`)
- Migration de schéma (`schema-migrate.py`)

### Interview & préparation
- Brief day-of avec talking points, STAR, Q&A (`interview-brief.py`)
- Simulation d'entretien interactif (`interview-sim.py`)
- Génération de stories STAR depuis les accomplissements CV (`prep-star.py`)
- Quiz terminal (flashcards) (`prep-quiz.py`)
- Bank de questions agrégées par candidature (`question-bank.py`)
- Débriefing post-entretien (`interview-debrief.py`)
- Plan d'onboarding 30/60/90 jours (`onboarding-plan.py`)
- Pitchs elevator 30s/60s/90s (`elevator-pitch.py`)
- Jalons d'entretien (`milestone.py`)

### Outreach & suivi
- Emails de remerciement, négociation, suivi, cold outreach recruteur (IA)
- Messages LinkedIn IA (`linkedin-message.py`)
- Angles de lettre de motivation (3 variantes : business/technique/culture) (`cover-angles.py`)
- Critique de lettre de motivation IA (`cover-critique.py`)
- Score lettre de motivation ATS (`cl-score.py`)
- Gestion des références + emails de demande (`references.py`)
- Network map Mermaid depuis contacts.md (`network-map.py`)
- Smart follow-up (apps stale → GitHub Issues) (`smart-followup.py`)

### Discovery & marché
- Discovery d'offres via RSS + job boards (`job-discovery.py`, `rss-discovery.py`, cache `scripts/.rss-cache.json`)
- Greenhouse / Lever public API (`job-boards.py`)
- Apply batch depuis CSV (`batch-apply.py`)
- Recherche de contacts recruteur/HM (`contacts.py`)
- Vérification de vivacité des URLs d'offres (`url-check.py`)
- Carte des concurrents IA (`competitor-map.py`)
- Benchmark salarial P25/P50/P75 IA (`salary-bench.py`)
- Research entreprise (`company-research.py`)

### Analytics & reporting
- Tableau de bord HTML (`generate-dashboard.py`)
- Kanban terminal par étape (`apply-board.py`)
- Vue d'ensemble statuts (`status.py`)
- Export CSV, rapport markdown, timeline Mermaid, stats
- Funnel analytics (taux de conversion par provider)
- Historique ATS par candidature (`ats-history.py`)
- Corrélation score ATS / outcomes (`effectiveness.py`)
- Keyword trends (`keyword-trends.py`)
- Archive enrichie avec summary + tag git (`archive-app.py`)
- Alertes deadline cron-friendly (`deadline-alert.py`)
- Digest hebdomadaire (`digest.py`)

### Intégrations
- Notion bidirectionnel (pull/push/diff) (`notion-twoway.py`)
- Webhooks Slack, Discord, Telegram (`notify.py`)
- LinkedIn sync profil + posts (`linkedin-sync.py`, `linkedin-profile.py`, `linkedin-post.py`)
- Serveur HTTP API (`cv-api.py`, port 8765) — interface pour le hub Go `cv-api`
- Userscript navigateur (`scripts/cv-pipeline.user.js`)
- Portfolio HTML statique EN + FR (`portfolio.py`)
- Template marketplace (`template-market.py`)
- Export Hugo (`hugo-export.py`)

### CI/CD (16 workflows GitHub Actions)
- Build PDFs + CI sur push/PR (`build.yml`, `ci.yml`)
- Sécurité hebdomadaire (`security.yml`)
- Sync Notion sur PR apply (`notion-sync.yml`)
- Reminders entretien sur merge (`interview-reminder.yml`)
- Release PDFs sur merge (`release.yml`)
- CV health check hebdomadaire (`cv-health-check.yml`)
- Follow-up reminders hebdomadaires (`follow-up.yml`)
- Auto-archive mensuel (`auto-archive.yml`)
- Dashboard sur push (`dashboard.yml`)
- Notifications (`notify.yml`)
- PR preview (`pr-preview.yml`)
- LinkedIn sync on demand (`linkedin-sync.yml`)
- Portfolio sur modifications YAML (`portfolio.yml`)
- Update sous-module Awesome-CV hebdomadaire (`update-submodule.yml`)
- Auto apply (`auto-apply.yml`)

### Qualité & tooling
- 31 fichiers de tests pytest (99+ tests unitaires et d'intégration)
- Pre-commit hooks (`scripts/install-hooks.sh`)
- Complétions shell : bash, zsh, fish, PowerShell, Nushell
- `doctor.py` avec auto-fix des dépendances manquantes
- Config mypy + ruff (py39, line-length 120)
- Diff visuel entre candidatures (ImageMagick)
- Accent color auto-détection → thème (`accent-color.py`)

---

## Reste à faire

### P2 — Maintenance & dette technique

- **Refactoring surface de scripts** : 87 scripts, surface de maintenance très large. Identifier les patterns communs (appels IA, lecture YAML, output PDF) et les factoriser via `scripts/lib/`. Objectif : réduire le nombre de scripts ou leur taille moyenne.
- **Couverture de tests** : les fichiers `test_p*.py` couvrent des phases numérotées jusqu'à p23. Vérifier la couverture réelle (`make coverage`) et colmater les gaps critiques (render, ai-tailor, cv-api).
- **Contrat cv-api** : documenter précisément le contrat d'interface entre `cv-api.py` (port 8765) et le hub Go `cv-api`. Types de requêtes, format JSON, gestion des erreurs, authentification. Actuellement implicite.
- **Contrat cv-templates** : clarifier si/comment `cv-pipeline` dépend d'un repo `cv-templates` séparé ou si `awesome-cv/` suffit. Le README ne mentionne pas `cv-templates`.

### P3 — Durcissement & observabilité

- **CI verte et stable** : s'assurer que `build.yml` et `ci.yml` passent systématiquement sur une machine fraîche (dépendances TeX Live, fontawesome6, sous-module).
- **Sécurité** : audit du workflow `security.yml` — vérifier ce qu'il teste réellement (bandit ? pip-audit ?).
- **Cache `scripts/.rss-cache.json`** : ce fichier de 65KB est gitignored mais existe dans le repo (vérifier qu'il n'a pas été commité par erreur). Ajouter un test/hook qui bloque tout commit de ce fichier.
- **Monitoring cv-api** : le serveur HTTP (`cv-api.py`) n'a pas de health check ni de métriques exposées. Ajouter `/health` endpoint minimal.
- **Documentation utilisateur** : le README décrit le projet pour un fork public (Jane Doe). Documenter le workflow fork-privé vs fork-public pour un nouvel utilisateur.
