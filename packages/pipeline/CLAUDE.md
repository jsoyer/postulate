# cv-pipeline — Mémoire projet

## Vue d'ensemble

Moteur IA Python de génération et traitement de CV. Composant d'une suite "CV" :
- **cv-pipeline** (ce repo) — traitement YAML → LaTeX → PDF, IA, analytics
- **cv-api** (Go) — hub HTTP exposant les capacités du pipeline aux clients
- Clients : cv-manager (web), cv-tui-py/go/rs, cv-mobile, cv-browser-extension

Principe : `data/cv.yml` est l'unique source de vérité. `scripts/render.py` convertit le YAML en LaTeX (Awesome-CV). XeLaTeX compile le PDF final. Les scripts IA taillorent le CV pour chaque offre.

## Stack & prérequis

- **Python 3.9+** (mypy cible py39, ruff target-version py39)
- **XeLaTeX / TeX Live** avec `fontawesome6` (auto-installé si absent)
- **Sous-module** `awesome-cv/` (posquit0/Awesome-CV) — cloner avec `--recurse-submodules`
- **5 providers IA** : Gemini (défaut), Claude/Anthropic, OpenAI, Mistral, Ollama (local)
- **Dépendances runtime** : `pyyaml`, `requests`, `beautifulsoup4`, `jsonschema`, `feedparser`
- **Dépendances dev** : `pytest`, `pytest-cov`, `mypy`, `ruff`, `pre-commit`, `pypdf`, stubs types

```bash
git clone --recurse-submodules <repo>
pip install -r requirements-dev.txt
cp .env.example .env   # puis renseigner les clés API
make doctor            # vérifier toutes les dépendances
```

## Execution Config

```bash
# Rendu LaTeX
make render                        # data/cv.yml → CV.tex + CoverLetter.tex
make render LANG=fr                # version française
make render PDFA=true              # mode PDF/A (XMP metadata via CV.xmpdata)
make pdfa                          # render + compile + renommer en CV-pdfa.pdf
make check-pdfa                    # vérifier conformité PDF/A (scripts/check-pdfa.py)

# Build PDF (render + xelatex)
make all                           # build CV.tex + CoverLetter.tex
make app NAME=<slug>               # build une candidature spécifique
make app NAME=<slug> DRAFT=true    # avec watermark DRAFT

# Pipeline candidature
make apply COMPANY=X POSITION=Y   # branch apply/YYYY-MM-slug + scaffold + PR draft
make apply URL=<job-url>           # idem avec fetch auto de la fiche
make tailor NAME=<slug>            # AI tailor (Gemini par défaut) + ATS avant/après
make tailor NAME=<slug> AI=claude TARGET=both  # tailoring CV+CL via Claude
make pipeline NAME=<slug>          # tailor + review en séquence

# ATS & scoring
make score NAME=<slug>             # ATS score (scripts/ats-score.py)
make cv-keywords                   # analyse des gaps keywords
make ats-rank MIN=70               # classement de toutes les candidatures
make match SOURCE=<job.txt>        # reverse ATS (scripts/match.py)

# Interview & outreach
make interview-brief NAME=<slug>   # brief day-of (scripts/interview-brief.py)
make interview-sim NAME=<slug>     # simulation d'entretien interactif
make prep-star NAME=<slug>         # génération stories STAR
make recruiter-email NAME=<slug>   # cold outreach (IA)
make thankyou NAME=<slug>          # email de remerciement (IA)
make negotiate NAME=<slug>         # script de négociation (IA)

# Market & discovery
make discover                      # job-discovery.py (RSS + job boards)
make boards BOARD=greenhouse COMPANY=X  # Greenhouse/Lever public API
make job-fit NAME=<slug>           # score d'adéquation personnelle

# Intégrations
make notion-pull / notion-push / notion-diff
make linkedin [PUSH=true]          # sync LinkedIn (dry-run par défaut)
make cv-api [PORT=8765]            # démarrer le serveur HTTP API

# Rapports & analytics
make status                        # vue d'ensemble de toutes les candidatures
make dashboard                     # dashboard HTML (ouvre dans le navigateur)
make funnel [PROVIDER=gemini]      # taux de conversion du funnel
make digest [DAYS=7]               # digest hebdomadaire (email/Slack)

# Tests & qualité
make test                          # pytest tests/ -v --tb=short
make coverage                      # pytest --cov=scripts --cov-report=html
make validate-all                  # validation YAML vs data/cv-schema.json
make lint [NAME=<slug>]            # chktex sur les fichiers .tex
make doctor                        # vérification de toutes les dépendances
make doctor-fix                    # auto-fix des problèmes courants

# Utilitaires
make dev-setup                     # venv + requirements + git hooks
make submodule-update              # mise à jour du sous-module awesome-cv
make cache-stats / cache-clear     # gestion du cache AI (default: 7 jours)
make completions-bash / fish / ps1 / nu  # installation des complétions shell
```

## Architecture

```
data/
  cv.yml              # YAML source de vérité (EN)
  cv-fr.yml           # version française
  cv-schema.json      # JSON Schema de validation
  coverletter.yml     # lettre de motivation base

scripts/
  lib/
    ai.py             # caller IA unifié : 5 providers, retry/backoff, cache, validation JSON
    common.py         # chemins, chargement YAML, logging structuré, constantes timeout
    cache.py          # cache des réponses IA (TTL configurable, défaut 7j)
  render.py           # YAML → LaTeX (34KB) : escaping, **bold** → \textbf{}, Awesome-CV
  ai-tailor.py        # pipeline de tailoring IA complet (21KB)
  ats-score.py        # scoring ATS par analyse de keywords
  fetch-job.py        # fetch + parsing des fiches de poste (URL/HTML)
  job-discovery.py    # discovery via RSS + job boards (rss-discovery intégré)
  cv-api.py           # serveur HTTP API (port 8765) pour cv-api Go hub
  doctor.py           # vérification / auto-fix des dépendances
  [+ 80 autres scripts spécialisés]

awesome-cv/           # sous-module Git (LaTeX class + polices)
applications/         # gitignored — candidatures locales (fork privé)
.github/workflows/    # 16 workflows CI/CD
tests/                # 31 fichiers de test (pytest)
```

**Conventions de branches** : une branche par candidature, `apply/YYYY-MM-slug`. Le nom courant est lu depuis la branche git active (`make current`).

**Intégrations externes** : Notion (sync bidirectionnel), Slack/Discord/Telegram (webhooks), LinkedIn (sync profil + posts), GitHub Actions (CI/CD, scheduler), Greenhouse/Lever (job boards API publique).

## Conventions de code & sécurité

- **Clés API via variables d'environnement uniquement** — jamais dans le code source. Toutes dans `.env` (gitignored). Les scripts lisent `os.environ.get(...)` via `scripts/lib/ai.py`.
- Les headers d'authentification (ex. `x-goog-api-key` pour Gemini) sont construits dans `lib/ai.py`, jamais interpolés dans des chaînes passées à un shell.
- **Shell injection** : les arguments passés aux commandes shell via `subprocess` utilisent des listes de tokens, pas des chaînes formatées.
- **Cache runtime gitignored** : `scripts/.rss-cache.json` (65KB) est dans `.gitignore` — ne jamais le committer.
- **Données réelles gitignorées** : `applications/`, `*.pdf`, `*.env` restent dans le fork privé de l'utilisateur.
- Linter : `ruff` (line-length 120, py39), type-checker : `mypy` (ignore_missing_imports).

## Tests

```bash
tests/conftest.py        # fixtures partagées
tests/test_render.py     # escaping LaTeX, conversion bold, rendu Awesome-CV
tests/test_ai.py         # 5 providers (HTTP mocké), retry, fallback, erreurs
tests/test_ai_tailor.py  # pipeline de tailoring
tests/test_common.py     # utilitaires lib/common.py
tests/test_ats_score.py  # scoring ATS
tests/test_pipeline_e2e.py  # end-to-end
tests/test_p*.py         # couverture par phases (p1→p23)
```

Lancer : `make test`. Couverture : `make coverage` (rapport HTML dans `htmlcov/`).
