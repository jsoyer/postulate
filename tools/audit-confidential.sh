#!/usr/bin/env bash
# tools/audit-confidential.sh
#
# Scans the postulate monorepo for confidential material that must never be
# committed to this (eventually PUBLIC) repository: real secrets/API keys,
# real PII belonging to the repo owner, real job-application content, and
# real CV/cover-letter content hiding inside binary PDFs.
#
# Preferred path: gitleaks (if installed) for secret detection, PLUS our own
# grep-based checks for PII / applications / real .env files / PDF content
# (gitleaks does not know about those).
#
# Fallback path (gitleaks NOT installed): a self-contained grep-based scan
# that must catch the same secret classes on its own.
#
# Directory-name exclusions are scoped per-scan (see EXCLUDE_DIR_NAMES_ALL vs
# EXCLUDE_DIR_NAMES_PII_ONLY below): the SECRET pattern scans are value-based
# and MUST still run over tests/ and examples/ — a real credential pasted
# into a fixture is still a real credential. Only the PII scan (which keys
# off the owner's real name/domain and would otherwise false-positive on
# synthetic Jane-Doe/Acme/test-fixture data) excludes those dirs.
#
# Only "file:line" (or "file (pdftotext: label)" for PDF hits) is ever
# printed — never the matched secret value itself.
#
# Exit code: 0 if zero hits, 1 if anything was flagged, 2 if the environment
# doesn't support a required tool (e.g. no PCRE-capable grep) — this is a
# hard failure, never a silent "OK".

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# ---------------------------------------------------------------------------
# Environment probe: the generic-secret and GCP-service-account checks need
# PCRE (`grep -P`). If PCRE isn't supported, those checks would previously
# have their "unsupported option" error silently swallowed by `2>/dev/null
# || true`, turning them into a silent no-op that still reports "OK". Fail
# loudly instead.
# ---------------------------------------------------------------------------
if ! echo x | grep -qP x 2>/dev/null; then
  echo "FATAL: grep -P (PCRE) unsupported" >&2
  exit 2
fi

TOTAL_HITS=0

# ---------------------------------------------------------------------------
# Paths that are known-safe and must NEVER be flagged (tooling caches, VCS
# internals, third-party submodule). Excluded from EVERY scan.
# ---------------------------------------------------------------------------
EXCLUDE_DIR_NAMES_ALL=(
  ".git" "venv" ".venv" "node_modules" ".pytest_cache" ".mypy_cache"
  "__pycache__" "awesome-cv"
  # Generated build output (never committed — see .gitignore). Scanning it only
  # produced false positives from minified/compiled bundles (e.g. Next.js .next/).
  ".next" "build"
)

# Public/synthetic fixture dirs — excluded from the PII scan ONLY (see
# EXCLUSION-MANIFEST.md §4). Never excluded from the SECRET scans: a real
# credential pasted into tests/ or examples/ must still be flagged.
EXCLUDE_DIR_NAMES_PII_ONLY=(
  "examples" "tests" "target" "dist" "htmlcov"
)

GREP_EXCLUDE_ARGS_ALL=()
for d in "${EXCLUDE_DIR_NAMES_ALL[@]}"; do
  GREP_EXCLUDE_ARGS_ALL+=(--exclude-dir="${d}")
done
GREP_EXCLUDE_ARGS_ALL+=(--exclude=".env.example" --exclude="*.pyc" --exclude="sample-*.pdf")
# This script itself necessarily contains the literal patterns it looks for
# (e.g. the owner's domain/email regex) — exclude it from its own scan.
GREP_EXCLUDE_ARGS_ALL+=(--exclude="audit-confidential.sh")
# The manifest documents pattern *shapes* via illustrative examples (e.g.
# `"type": "service_account"`, `postgres://user:pass@host`) — not real
# secrets. Same self-referential rationale as the script exclusion above.
GREP_EXCLUDE_ARGS_ALL+=(--exclude="EXCLUSION-MANIFEST.md")

GREP_EXCLUDE_ARGS_PII=("${GREP_EXCLUDE_ARGS_ALL[@]}")
for d in "${EXCLUDE_DIR_NAMES_PII_ONLY[@]}"; do
  GREP_EXCLUDE_ARGS_PII+=(--exclude-dir="${d}")
done

# Selected by each scan function before calling scan_pattern().
GREP_EXCLUDE_ARGS=("${GREP_EXCLUDE_ARGS_ALL[@]}")

# Runs a grep and prints only "file:line" per hit (never the matched value).
# Args: <label> <grep-mode: -E|-P> <pattern> [neg_filter regex, optional]
# NOTE: -E and -P are mutually exclusive in GNU grep ("conflicting matchers
# specified") — never combine them in a single mode string.
# Adds to TOTAL_HITS and prints a section header only if there are hits.
scan_pattern() {
  local label="$1"; local mode="$2"; local pattern="$3"; local neg_filter="${4:-}"
  local matches
  matches="$(grep -rIn "${mode}" "${GREP_EXCLUDE_ARGS[@]}" -- "${pattern}" . 2>/dev/null || true)"
  if [ -n "${matches}" ] && [ -n "${neg_filter}" ]; then
    matches="$(printf '%s\n' "${matches}" | grep -viE -- "${neg_filter}" || true)"
  fi
  if [ -n "${matches}" ]; then
    echo "-- ${label} --"
    while IFS=: read -r file line _rest; do
      [ -z "${file}" ] && continue
      echo "  HIT: ${file}:${line}"
      TOTAL_HITS=$((TOTAL_HITS + 1))
    done <<< "${matches}"
  fi
}

# Same pattern-matching logic as scan_pattern(), but against an in-memory
# text blob (used for pdftotext output, which has no meaningful file lines).
# Prints "  HIT: <path> (pdftotext: <label>)" — never the matched value.
scan_text_patterns() {
  local path="$1"; local text="$2"
  local -n _labels="$3"; local -n _modes="$4"
  local -n _patterns="$5"; local -n _negs="$6"
  local i
  for ((i = 0; i < ${#_labels[@]}; i++)); do
    local label="${_labels[$i]}" mode="${_modes[$i]}" pattern="${_patterns[$i]}" neg="${_negs[$i]}"
    local matches
    matches="$(printf '%s\n' "${text}" | grep -n "${mode}" -- "${pattern}" 2>/dev/null || true)"
    if [ -n "${matches}" ] && [ -n "${neg}" ]; then
      matches="$(printf '%s\n' "${matches}" | grep -viE -- "${neg}" || true)"
    fi
    if [ -n "${matches}" ]; then
      echo "  HIT: ${path} (pdftotext: ${label})"
      TOTAL_HITS=$((TOTAL_HITS + 1))
    fi
  done
}

# ---------------------------------------------------------------------------
# Secret patterns (value-based — run over tests/examples too, see header).
# Shared between the file-tree grep scan and the PDF text-extraction scan.
# ---------------------------------------------------------------------------
SECRET_LABELS=(
  "Private key headers"
  "GitHub tokens (ghp_...)"
  "OpenAI-style keys (sk-...)"
  "AWS access keys (AKIA...)"
  "Real Slack webhooks"
  "Real Discord webhooks"
  "Stripe live/test secret keys (sk_live_/sk_test_)"
  "Slack tokens (xox[baprs]-...)"
  "JWT-shaped tokens"
  "GCP service-account JSON"
  "DB connection strings with inline creds"
  "Generic secret-shaped assignments"
)
SECRET_MODES=( -E -E -E -E -E -E -E -E -E -P -E -P )
SECRET_PATTERNS=(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'ghp_[A-Za-z0-9]{36}'
  'sk-[A-Za-z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
  'hooks\.slack\.com/services/[A-Za-z0-9]{6,}/[A-Za-z0-9]{6,}/[A-Za-z0-9]{10,}'
  'discord(app)?\.com/api/webhooks/[0-9]{5,}/[A-Za-z0-9_-]{10,}'
  'sk_(live|test)_[A-Za-z0-9]{16,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.'
  '"type"\s*:\s*"service_account"|"private_key"\s*:'
  '(postgres|postgresql|mysql|mongodb)://[^:]+:[^@]+@'
  '(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*[\x27"]?[A-Za-z0-9/_.+=-]{8,}'
)
# Generic "key = value" / "key: value" assignments with a real-looking value,
# i.e. excluding known placeholder shapes (your-*, <...>, xxx, changeme,
# example, placeholder, "secret_...", trailing "...", empty). Excludes the
# standard "read secret from environment/config at runtime" idioms
# (os.environ, os.getenv, process.env, ...) — those are the SAFE pattern (no
# literal secret in source) and must not be flagged.
# SAFETY: only the two LOW-SIGNAL detectors carry a neg-filter — the JWT-shape
# heuristic (index 8) and the generic "key=value" heuristic (index 11). Every
# HIGH-SIGNAL detector (private key / ghp_ / sk- / AKIA / Stripe / Slack / GCP-SA
# JSON / DB conn string, indices 0-7,9,10) keeps an EMPTY neg and scans every
# path including docs/ and tests/ — so a real high-entropy credential pasted into
# documentation or a fixture is still caught. The negs below only suppress the
# vague heuristics on: (a) documentation & test fixtures by path (public/example
# by design), and (b) self-describing placeholders / code idioms by value.
SECRET_NEGS=(
  "" "" "" "" "" "" "" ""
  # [8] JWT-shape: suppress example/alg:none vectors in docs & test fixtures only.
  '(/docs/|\.md:|/tests/|__tests__|_test\.(go|ts|tsx|py|rs)|\.test\.(ts|tsx))'
  "" ""
  # [11] Generic key=value heuristic: placeholders, doc/test fixtures, code idioms.
  '(your-[a-z-]*(here|key)|your-token-here|<[a-z_-]+>|xxx+|changeme|example|placeholder|secret_\.\.\.|\.\.\.|os\.environ|os\.getenv|process\.env|getenv\(|System\.getenv|env\.get\(|env\[|fake-key|fake-token|fake-secret|dummy-key|dummy-token|mock-key|mock-token|/docs/|\.md:|/tests/|__tests__|_test\.(go|ts|tsx|py|rs)|\.test\.(ts|tsx)|your_[a-z0-9_]+|change[_-]?me|dev[_-](secret|password|runner)|runner[_-]secret|-at-least-[0-9]+-char|minimum-[0-9]+-char|\$\{[a-z_]+:-|generate[a-z]*secret\(|\.get\(|\.match\(|errors\.new|config\.[a-z]|client[a-z_]*secret|cv_api_key|constant-time|password:[[:space:]]+password|totpsecret:[[:space:]]*totpsecret|\.headers\.|\.cookies\.)'
)

# ---------------------------------------------------------------------------
# PII patterns (owner-specific — excludes tests/examples, see header).
# ---------------------------------------------------------------------------
PII_LABELS=( "Owner domain / email handle" )
PII_MODES=( -E )
PII_PATTERNS=( 'jeromesoyer\.(fr|com)|@jeromesoyer' )
PII_NEGS=( "" )

run_grep_secret_scan() {
  echo "== Secrets scan (grep fallback) =="
  GREP_EXCLUDE_ARGS=("${GREP_EXCLUDE_ARGS_ALL[@]}")
  local i
  for ((i = 0; i < ${#SECRET_LABELS[@]}; i++)); do
    scan_pattern "${SECRET_LABELS[$i]}" "${SECRET_MODES[$i]}" "${SECRET_PATTERNS[$i]}" "${SECRET_NEGS[$i]}"
  done
}

run_grep_pii_scan() {
  echo "== Real PII scan (owner-specific patterns, see EXCLUSION-MANIFEST.md) =="
  # Deliberately does NOT match generic placeholders (jane.doe@example.com)
  # or fixture phone numbers (e.g. fake +33 6 00 00 00 00 used in tests/) —
  # this scan excludes examples/ and tests/ (PII-only exclusion, see header).
  GREP_EXCLUDE_ARGS=("${GREP_EXCLUDE_ARGS_PII[@]}")
  local i
  for ((i = 0; i < ${#PII_LABELS[@]}; i++)); do
    scan_pattern "${PII_LABELS[$i]}" "${PII_MODES[$i]}" "${PII_PATTERNS[$i]}" "${PII_NEGS[$i]}"
  done
}

run_structural_scan() {
  echo "== Structural scan (real application/cover-letter content, real .env) =="

  # An "applications" directory only signals real job-application CONTENT when it
  # is a DATA dir — not when it is legitimate source code (the manager ships an
  # "applications" feature: src/app/applications, src/components/applications,
  # src/app/api/applications). Exclude source-tree parents so real data drops are
  # still caught while feature code is not false-flagged. Real application data
  # lives outside the repo (served by apps/api) or in an app-local data/ dir
  # (git-ignored). See EXCLUSION-MANIFEST.md §3.
  local dirs
  dirs="$(find . -type d -name "applications" \
    -not -path "./.git/*" -not -path "*/venv/*" -not -path "*/.venv/*" \
    -not -path "*/node_modules/*" -not -path "*/src/*" -not -path "*/app/*" \
    -not -path "*/components/*" -not -path "*/pages/*" -not -path "*/.next/*" \
    -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/target/*" \
    2>/dev/null || true)"
  if [ -n "${dirs}" ]; then
    echo "-- applications/ directories present --"
    while IFS= read -r d; do
      [ -z "${d}" ] && continue
      echo "  HIT: ${d}"
      TOTAL_HITS=$((TOTAL_HITS + 1))
    done <<< "${dirs}"
  fi

  local envs
  envs="$(find . -type f -name ".env" \
    -not -path "./.git/*" -not -path "*/venv/*" -not -path "*/.venv/*" \
    -not -path "*/node_modules/*" 2>/dev/null || true)"
  if [ -n "${envs}" ]; then
    echo "-- Real .env files present --"
    while IFS= read -r f; do
      [ -z "${f}" ] && continue
      echo "  HIT: ${f}"
      TOTAL_HITS=$((TOTAL_HITS + 1))
    done <<< "${envs}"
  fi
}

# ---------------------------------------------------------------------------
# PDF content scan: `grep -rIn` treats PDFs as binary and silently skips
# them, so a real CV/cover-letter PDF committed by mistake would otherwise
# be invisible to every scan above. If `pdftotext` is available, extract
# text from tracked *.pdf files (outside the public-samples allowlist) and
# run the same secret + PII patterns against the extracted text. If
# `pdftotext` is absent, print a loud warning but do not fail solely for
# that (see EXCLUSION-MANIFEST.md §2 — manual review required in that case).
# ---------------------------------------------------------------------------
run_pdf_scan() {
  echo "== PDF content scan (tracked *.pdf files) =="

  local pdfs
  pdfs="$(git -C "${ROOT_DIR}" ls-files -- '*.pdf' 2>/dev/null || true)"
  if [ -z "${pdfs}" ]; then
    return
  fi

  if ! command -v pdftotext >/dev/null 2>&1; then
    echo "WARNING: pdftotext absent — PDF contents not scanned (manual review required)" >&2
    return
  fi

  while IFS= read -r pdf; do
    [ -z "${pdf}" ] && continue
    case "${pdf}" in
      */docs/sample-*.pdf|docs/sample-*.pdf|*/awesome-cv/*|awesome-cv/*)
        continue
        ;;
    esac
    local text
    text="$(pdftotext "${ROOT_DIR}/${pdf}" - 2>/dev/null || true)"
    [ -z "${text}" ] && continue
    scan_text_patterns "${pdf}" "${text}" SECRET_LABELS SECRET_MODES SECRET_PATTERNS SECRET_NEGS
    scan_text_patterns "${pdf}" "${text}" PII_LABELS PII_MODES PII_PATTERNS PII_NEGS
  done <<< "${pdfs}"
}

if command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks detected — running gitleaks + supplemental PII/structural/PDF checks."
  if ! gitleaks detect --no-git --source "${ROOT_DIR}" --redact --exit-code 1; then
    TOTAL_HITS=$((TOTAL_HITS + 1))
  fi
  run_grep_pii_scan
  run_structural_scan
  run_pdf_scan
else
  echo "gitleaks NOT installed — running self-contained grep fallback."
  run_grep_secret_scan
  run_grep_pii_scan
  run_structural_scan
  run_pdf_scan
fi

echo
if [ "${TOTAL_HITS}" -eq 0 ]; then
  echo "audit-confidential: OK — 0 confidential hits."
  exit 0
else
  echo "audit-confidential: FAILED — ${TOTAL_HITS} confidential hit(s) found above."
  exit 1
fi
