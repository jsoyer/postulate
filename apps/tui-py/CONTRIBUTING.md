# Contributing to cv-tui-py

Thank you for your interest in contributing to cv-tui-py. This document provides guidelines and instructions for getting started with development.

## Prerequisites

- **Python 3.12 or later**
- [uv](https://docs.astral.sh/uv/) package manager
- A running [cv-api](https://github.com/your-org/cv-api) instance (recommended for manual testing)

## Development Setup

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd cv-tui-py
uv sync --extra dev
```

The `uv sync` command installs all dependencies (runtime + dev) into a virtual environment managed by uv.

## Running Tests

Run the full test suite with coverage:

```bash
uv run pytest
```

To skip the coverage threshold during active development:

```bash
uv run pytest --no-cov
```

## Linting and Type Checking

### Linting
Check code style with Ruff:

```bash
uv run ruff check src/ tests/
```

Auto-fix style issues:

```bash
uv run ruff format src/ tests/
```

### Type Checking
Run mypy in strict mode:

```bash
uv run mypy src/ --strict
```

All public functions must be fully typed for strict mode to pass.

### All checks at once
```bash
uv run ruff check src/ tests/ && uv run ruff format src/ tests/ && uv run mypy src/ --strict && uv run pytest
```

## Commit Style

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to keep the commit history clear and machine-readable.

| Prefix | When to use | Example |
|--------|-------------|---------|
| `feat:` | New feature or screen | `feat: add audit screen for CV health metrics` |
| `fix:` | Bug fix | `fix: handle API timeouts gracefully` |
| `refactor:` | Code restructure without behavior change | `refactor: extract common loading pattern` |
| `test:` | Adding or updating tests | `test: add integration tests for health check` |
| `docs:` | Documentation only | `docs: update API reference` |
| `chore:` | Dependency updates, CI changes | `chore: upgrade Textual to 1.1` |
| `style:` | Formatting, whitespace, linting | `style: remove trailing whitespace` |

Use lowercase, imperative mood, and be specific: `feat: add health polling` not `feat: added health polling`.

## Pull Requests

1. **Fork the repo** and create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Keep PRs focused**: Each PR should address a single concern (one feature, one fix, or one documentation update).

3. **Run checks locally** before pushing:
   ```bash
   uv run ruff check src/
   uv run ruff format src/
   uv run mypy src/ --strict
   uv run pytest
   ```

4. **Open a PR against `main`** with a clear title following the commit style above (e.g., `feat: add theme selector modal`).

5. **CI must pass** before merge:
   - Linting (Ruff)
   - Type checking (mypy strict)
   - Tests (pytest with coverage)

## Code Style Guidelines

### Python

- **Language**: Python 3.12+ syntax
- **Imports**: Add `from __future__ import annotations` to every file for forward reference compatibility
- **Type hints**: All public function signatures must include type hints
- **Linting rules** (enforced by Ruff):
  - `E`: PEP 8 errors
  - `F`: PyFlakes (undefined names, unused imports)
  - `I`: isort (import sorting)
  - `UP`: pyupgrade (modern syntax)
  - `B`: flake8-bugbear (common bugs)
  - `SIM`: flake8-simplify (code simplification)
  - `ANN`: annotations (type hints required)

### Code Quality

- **Explicit over clever**: Prioritize readability
- **No trailing whitespace**
- **No commented-out code**: Remove it or use a TODO comment if deferring
- **Single responsibility**: Functions should do one thing
- **Async everywhere**: Use `async/await` for all I/O operations

### Documentation

- **Docstrings**: Use triple-quoted docstrings for modules, classes, and public functions
- **Type hints in docstrings**: Not required (mypy replaces this)
- **Examples**: Provide brief examples for complex APIs

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a detailed breakdown of the codebase, design patterns, and key decisions.

## Debugging Tips

### Enable verbose logging
```bash
# Set TEXTUAL logging environment variable
export TEXTUAL=debug
uv run python -m cv_tui --config /path/to/config.toml
```

### Connect to remote cv-api
```bash
CV_API_URL=https://cv-api.example.com \
CV_API_KEY=your-key \
uv run python -m cv_tui
```

### Run a single test
```bash
uv run pytest tests/test_config.py::test_load_config -v
```

## Questions?

If you have questions:

1. Check [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design explanations
2. Review existing issues and discussions
3. Open a new discussion or issue with context

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
