# Exclusion Manifest — postulate monorepo

Exhaustive list of paths/patterns that must **never** be imported into this
(eventually PUBLIC) monorepo. Consumed by Sprints 2, 3, and 4 when importing
further content from the source repos. Fail-safe rule: **when in doubt,
exclude, and document why below.**

Sources inspected for this sprint (read-only):
- `/home/jeromesoyer/Documents/Github/jsoyer/cv-pipeline/`
- `/home/jeromesoyer/Documents/Github/jsoyer/cv-templates/`

## 1. Structural / VCS

| Path (relative to source repo) | Reason | Action |
| --- | --- | --- |
| `cv-pipeline/.git/` | Old history, not wanted in a fresh monorepo history | Never copy; recreate history from scratch in `postulate/` |
| `cv-templates/.git/` | Same as above | Never copy |
| `cv-pipeline/awesome-cv/` (materialized submodule checkout) | Must be re-attached as a proper git submodule pointing at `posquit0/Awesome-CV`, not copied as plain files (would duplicate/fork a third-party public repo's content and lose upstream tracking) | Re-add via `git submodule add https://github.com/posquit0/Awesome-CV.git packages/pipeline/awesome-cv` |
| `cv-pipeline/progress.json` | Internal task-tracking artifact of the *cv-pipeline* repo itself (project status notes), out of scope for the engine import and irrelevant/confusing once vendored under `packages/pipeline/` | Do not import |

## 2. Secrets / credentials (real values only — placeholders are fine)

| Path / pattern | Reason | Action |
| --- | --- | --- |
| Any real `.env` file (not `.env.example`) | Would contain live API keys (Gemini/Claude/OpenAI/Mistral, LinkedIn, Notion, Slack/Discord/Telegram webhooks) if it existed | Never import. **Verified: neither source repo currently has one.** |
| Private key material (`-----BEGIN ... PRIVATE KEY-----`) | Credential leak | Never import; audited for by `tools/audit-confidential.sh` |
| Any populated `scripts/.rss-cache.json`-style runtime cache containing scraped third-party data | Not secret, but not source content either — regenerable at runtime | Already covered by source `.gitignore`; keep ignored in monorepo too |
| Any real CV / cover-letter PDF (outside `docs/sample-*.pdf` and the `awesome-cv/` submodule) | Binary PDFs are invisible to plain-text `grep` — a real credential or PII pasted into a CV export would otherwise never be flagged | Audited by `tools/audit-confidential.sh`'s PDF text-extraction scan, **but only when `pdftotext` is installed**. If `pdftotext` is absent, the script prints a loud warning and PDF *contents* are **not** automatically scanned (the file's existence/path is still visible via `git ls-files`) — manual review of any new PDF is required in that case. |

`cv-pipeline/.env.example` contains **placeholders only** (`your-key-here`,
`secret_...`, `T.../B.../...`) — safe to import verbatim (Task 7).

## 3. Real job-application / cover-letter content

| Path / pattern | Reason | Action |
| --- | --- | --- |
| Any `applications/` directory | Reserved in `cv-pipeline`'s own `.gitignore` for the user's real, in-progress job applications (company names, real correspondence) | Never import. **Verified: no `applications/` directory exists in either source repo at this time**, but the pattern is excluded proactively in `.gitignore` and audited by `tools/audit-confidential.sh` in case one appears later (e.g. created locally by the pipeline at runtime). |
| Any real cover letter file (addressed to a real company/recruiter, as opposed to the de-personalized `data/coverletter.yml` fixture) | Private correspondence | Never import. Automated detection is unreliable (free-form text) — Sprints 2-4 MUST manually eyeball any new letter-like file before importing. |

## 4. Real PII (personally identifying the repo owner)

Described here without reproducing the actual values in clear, per the
fail-safe rule for a document that will itself become public. Coverage is
split between what is **automated** (regex, machine-verifiable every run)
and what is **manual + structurally mitigated** (no reliable regex exists,
so it depends on the human import review plus the other exclusions in this
document):

### Automated (regex, `Real PII scan` in `tools/audit-confidential.sh`)

- **Owner's personal domain(s)** — the owner's own domain names (based on
  their real name, both `.fr` and `.com` TLDs). Any file referencing these
  domains directly (e.g. a personal contact email, portfolio link, or CI
  webhook host tied to the owner's real infrastructure) must be excluded or
  redacted before import.
- **Owner's personal email handle** — the email local-part matching the
  owner's real name (as used with the domains above, or with common webmail
  providers). Any occurrence must be excluded/redacted.

### Manual review + structural mitigation (NOT covered by an automated regex)

- **Owner's real phone number and postal address** — deliberately **not**
  implemented as an automated regex: phone/address formats vary too widely
  to write a reliable pattern without either missing real values or
  false-positiving on the synthetic fixture phone numbers listed below.
  Not currently present in either source repo. Mitigated structurally by:
  - The `applications/` exclusion (§3) — real correspondence, where a real
    phone/address would most likely appear, is never imported.
  - The real-`.env`-file exclusion (§2) — not where phone/address PII would
    live, but covers the adjacent "real personal data leaks via a real
    config file" failure mode.
  - Mandatory manual eyeballing of any new CV/cover-letter-shaped file
    before import (§3), and of any new PDF when `pdftotext` is unavailable
    (§2).
  - **If encountered during future imports** (e.g. a real CV/cover-letter
    draft), exclude immediately — do not rely on tooling to catch it.

**Explicitly NOT PII for the purposes of this scan** (false-positive traps to
avoid): the de-personalized fixture data already in `cv-pipeline`:
- `data/cv.yml`, `data/cv-fr.yml` → "Jane Doe", `jane.doe@example.com`, San
  Francisco, `+1 555...`
- `data/coverletter.yml`, `examples/meta.yml` → "Hiring Manager", "Acme Corp"
- `tests/test_*.py` fixtures → fake phone numbers such as `+33 6 00 00 00 00`,
  `+33123456789`, `+447000000000`, `+44 7700 000000`, `+33 6 12 34 56 78`
  (all synthetic, used only to exercise validation logic)
- `docs/sample-cv.pdf`, `docs/sample-coverletter.pdf` → public rendered
  samples built from the fixtures above, intended to be publicly visible

## 5. Private infrastructure / config

| Path / pattern | Reason | Action |
| --- | --- | --- |
| Real CI secrets, private hostnames, internal domains (e.g. references to the `cv-api` hub, private CI runners, non-public server hosts) | Infra topology should not be public | None found as literal secrets in `cv-pipeline`/`cv-templates` at time of audit (only generic `build.yml`/`ci.yml` mentions in `ROADMAP.md`, which are public-safe file names, not hosts/secrets). Re-check on every future import. |
| GCP/AWS service-account JSON (`"type": "service_account"`, `"private_key":`, `AKIA...`) | Grants direct cloud-account access | Never import. Audited by `tools/audit-confidential.sh` (AWS key + GCP service-account patterns). `.gitignore` proactively ignores `*-service-account*.json`. Relevant to the upcoming Go API import (Sprint 2+). |
| `kubeconfig` (cluster endpoints + auth tokens/certs) | Grants direct cluster access | Never import. `.gitignore` proactively ignores `kubeconfig` and `.kube/`. Relevant to the upcoming Go API deployment config (Sprint 2+). |
| DB connection strings with inline credentials (`postgres://user:pass@host`, `mysql://...`, `mongodb://...`) | Leaks DB credentials + internal host | Never import as literal values. Audited by `tools/audit-confidential.sh` (DB connection-string pattern). Relevant to the upcoming Go API / TS backend import (Sprint 2+). |
| `.npmrc` with a real registry auth token (`//registry.npmjs.org/:_authToken=...`) | Grants publish/read access to a private npm registry | Never import with a real token; `.npmrc.example` (placeholder only) is fine. `.gitignore` proactively ignores `.npmrc`. Relevant to the TS package imports (Sprint 2+). |
| TUI local session/cookie/config files under `~/.config/<app>/` (auth tokens, session cookies, machine-specific paths) | Local user session state, not source content | Never import; these live outside the repo tree by definition (user's home dir) but must not be vendored into fixtures/examples by accident. Relevant to the upcoming TUI import (Sprint 2+). |

## 6. Safe to keep (explicitly whitelisted — do NOT flag as confidential)

Kept in sync with the exclude lists inside `tools/audit-confidential.sh`. Note
the split: a small set of dirs is excluded from **every** scan (VCS/tooling
internals only); `examples/`, `tests/`, `target/`, `dist/`, `htmlcov/` are
excluded from the **PII scan only** — the SECRET scans (private keys,
`ghp_`/`sk-`/`AKIA`/Stripe/Slack/JWT/GCP/DB-conn-string/generic
`key=value`) deliberately still run over them, so a real credential pasted
into a fixture is still caught:

- Excluded from ALL scans: `.git/`, `venv/`, `.venv/`, `node_modules/`, `.pytest_cache/`, `.mypy_cache/`, `__pycache__/` — tooling/VCS internals; `awesome-cv/` — public third-party submodule (posquit0/Awesome-CV)
- Excluded from the PII scan ONLY: `examples/`, `tests/`, `target/`, `dist/`, `htmlcov/` — public/synthetic fixtures (see §4 above)
- `.env.example` — placeholders only
- `docs/sample-*.pdf` — curated public samples (also excluded from the PDF text-extraction scan, see §2)
- `data/*.yml` fixtures using Jane Doe / Acme Corp placeholder identities

## 7. Audit findings for this sprint (Sprint 1 import scope)

Ran manual greps across `cv-pipeline/` and `cv-templates/` (excluding
`.git/`, `venv/`) for: private keys, `ghp_`/`sk-`/`AKIA` tokens, real Slack/
Discord webhooks, generic `key=value` secret assignments, the owner's
domain/email handle, and non-fixture phone numbers.

**Result: zero real secrets, zero real PII, zero `applications/` directory,
zero real `.env` file found in either source repo.** Both repos were already
de-personalized before this sprint. See "Deviations/caveats" in the sprint
spec's Agent Notes for exact commands run.
