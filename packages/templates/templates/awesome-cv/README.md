# Awesome-CV

**Built-in template** — included by default in the CV pipeline via the `awesome-cv/` submodule.

## Usage

```bash
make render                        # default (awesome-cv)
make render TEMPLATE=awesome-cv   # explicit
make preview                       # all theme variants
```

## Features

- 2-page professional layout with sidebar header
- FontAwesome icons for contact details
- 4 built-in theme presets: `tech-blue`, `startup-orange`, `executive-dark`, `cyber-red`
- Custom accent color via `theme.yml`
- `**bold**` markdown in YAML bullets → `\textbf{}` in LaTeX

## Theme customization

```yaml
# data/theme.yml
accent_color: "0E76A8"   # hex without #
header_color: "2C3E50"
```

## Source

Fork of [posquit0/Awesome-CV](https://github.com/posquit0/Awesome-CV) maintained at `jsoyer/Awesome-CV`.
