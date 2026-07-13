# Consuming the pipeline engine from an external repository

`packages/pipeline` is a **parameterized, CWD-independent build engine** (Makefile +
Python scripts + `awesome-cv` submodule). A downstream repository (e.g. a private CV
data repo) can consume it as a git submodule and drive it entirely through four
override variables — **without copying any engine code or data**.

The engine's own defaults reproduce the standalone *Jane Doe* sample build, so the
engine remains fully usable on its own; consumers only override what they need.

## The four contract variables

| Variable         | Default        | Meaning                                                            |
| ---------------- | -------------- | ------------------------------------------------------------------ |
| `DATA_DIR`       | `data`         | YAML source of truth (`cv.yml`, `coverletter.yml`, schema, themes) |
| `APP_DIR`        | `applications` | Per-application working directories                                |
| `AWESOME_CV_DIR` | `awesome-cv`   | Awesome-CV LaTeX class + fonts (the engine's submodule)            |
| `OUT_DIR`        | `.`            | Where the master `CV.tex` / `CoverLetter.tex` / PDFs are written   |

Notes:

- **Pass absolute paths** for out-of-tree consumption. Relative overrides are
  resolved against the engine directory (make's CWD under `-C`).
- `TEXINPUTS` is derived as `$(abspath $(AWESOME_CV_DIR))/` — never `$(CURDIR)` —
  so XeLaTeX resolves `awesome-cv.cls` and fonts regardless of the invocation
  directory.
- The Python scripts already resolve their own module paths relative to the script
  (`scripts/lib/common.py`), so only the paths you pass as arguments (via the four
  variables above) determine where the engine reads and writes.

## Concrete external-consumer call

From a consumer repo that vendors the engine at `engine/` and keeps its own data:

```bash
ENGINE=engine                     # path to this pipeline package (submodule)
CVROOT="$(pwd)"                   # consumer repo root

# Render + build the master CV/CoverLetter from the consumer's own data,
# writing the artifacts into the consumer's root:
make -C "$ENGINE" all \
    DATA_DIR="$CVROOT/data" \
    APP_DIR="$CVROOT/applications" \
    AWESOME_CV_DIR="$ENGINE/awesome-cv" \
    OUT_DIR="$CVROOT"

# Build one tailored application (reads/writes the consumer's applications tree):
make -C "$ENGINE" app NAME=2026-07-acme \
    DATA_DIR="$CVROOT/data" \
    APP_DIR="$CVROOT/applications" \
    AWESOME_CV_DIR="$ENGINE/awesome-cv" \
    OUT_DIR="$CVROOT"
```

A thin wrapper `Makefile` in the consumer repo typically pins these once, e.g.:

```makefile
ENGINE := engine
export DATA_DIR       := $(CURDIR)/data
export APP_DIR        := $(CURDIR)/applications
export AWESOME_CV_DIR := $(CURDIR)/$(ENGINE)/awesome-cv
export OUT_DIR        := $(CURDIR)

%:
	@$(MAKE) -C $(ENGINE) $@
```

so `make all`, `make app NAME=…`, `make render LANG=fr`, etc. forward to the engine
with the consumer's paths already applied.

## awesome-cv submodule

The engine pins `awesome-cv` to **`jsoyer/Awesome-CV`** (a fork of `posquit0/Awesome-CV`
with font-portability fixes for TeX Live 2025 — fonts are resolved by filename via
`fontspec`, no hardcoded paths). Consumers should rely on the engine's submodule as
the single source of the LaTeX class rather than vendoring their own copy. Clone with
`--recurse-submodules` (or run `git submodule update --init --recursive`).

The class loads `SourceSansPro-*` and `Roboto-*` (`.otf`) plus `fontawesome6`; ensure
these are available to your TeX installation (`make -C "$ENGINE" install-deps` installs
them on common distros).

## Optional flags lifted for consumers

- `DEBUG=1` — enables verbose `LOG_LEVEL=DEBUG` across all Python scripts (default off,
  applies to every target, not just tailoring). A generic replacement for the
  per-target debug hack previously found in downstream forks.

Git-push automation (`AUTO_PUSH`) is intentionally **not** part of the engine: commit
and push semantics belong to the consumer's own workflow/wrapper, not to a shared
build engine.
