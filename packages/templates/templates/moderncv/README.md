# ModernCV

**Built-in template** — part of TeX Live, no installation required.

## Usage

```bash
make render TEMPLATE=moderncv
```

## Styles

ModernCV supports 5 built-in styles, selectable via `render.py`:

| Style | Description |
|-------|-------------|
| `classic` | Header left, timeline right (default) |
| `banking` | Compact header, ruled sections |
| `casual` | Photo header, relaxed layout |
| `oldstyle` | Traditional serif feel |
| `fancy` | Decorative ruled header |

To change style, edit `render.py`'s `render_cv_moderncv()` call or pass `--style` (if extended).

## Colors

`blue` (default), `orange`, `green`, `red`, `purple`, `grey`, `black`

## Notes

- Does not support cover letters (use `awesome-cv` for CL rendering)
- Generates a single-column layout — good for European-style CVs
- XeLaTeX compile: `make app` works unchanged with `TEMPLATE=moderncv`
