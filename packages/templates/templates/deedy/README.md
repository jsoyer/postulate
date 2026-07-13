# Deedy-Resume

**Built-in template** — 1-page, 2-column layout, optimized for tech CVs.

## Usage

```bash
make render TEMPLATE=deedy
```

## Layout

```
┌─────────────────┬──────────────────────────┐
│  Profile        │  Experience (top 3)       │
│  Skills         │  Key Wins (top 3)         │
│  Education      │                           │
│  Languages      │                           │
└─────────────────┴──────────────────────────┘
```

Left column (~40%): profile summary, skills, education, languages.
Right column (~60%): experience (limited to 3 entries, 4 bullets each), key wins (3 items).

## Constraints

- **1 page only** — content is automatically truncated to fit
- Profile text capped at 500 characters
- Max 3 experience entries × 4 bullets
- Max 3 key wins

## Notes

- Does not support cover letters
- Requires `multicol` package (included in TeX Live)
- Best for tech roles where 1-page is expected
- Font size: 10pt, A4 paper
