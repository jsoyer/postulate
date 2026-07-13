# cv-templates

Community template registry for the [jsoyer/CV](https://github.com/jsoyer/CV) pipeline system.

> **Private registry** — templates are curated and tested against the CV pipeline before listing.

---

## Available templates

| Template | Style | Pages | Tags |
|----------|-------|-------|------|
| `awesome-cv` | Sidebar header, colorful accents | 2 | professional, sidebar, colorful |
| `moderncv` | Classic/banking/casual styles | 1–2 | professional, classic, minimal |
| `deedy` | 2-column | 1 | tech, one-page, compact |

---

## Usage (from the CV repo)

### Browse

```bash
make market-list                      # list all templates
make market-search QUERY=minimal      # search by keyword
make market-installed                 # list locally installed
```

### Install a community template

```bash
make market-install NAME=template-name
```

Built-in templates (`awesome-cv`, `moderncv`, `deedy`) are already available — no install needed:

```bash
make render TEMPLATE=awesome-cv   # default
make render TEMPLATE=moderncv
make render TEMPLATE=deedy
```

### Use an installed template

```bash
make render TEMPLATE=your-template-name
make app NAME=2026-03-company
```

---

## Registry format

`registry.json` is the machine-readable index fetched by `scripts/template-market.py`:

```json
{
  "version": "1.0.0",
  "updated": "YYYY-MM-DD",
  "templates": [
    {
      "name": "template-name",
      "description": "Short description",
      "author": "Author Name",
      "version": "1.0.0",
      "built_in": false,
      "tags": ["tag1", "tag2"],
      "preview": "templates/template-name/preview.png",
      "repo": "https://github.com/author/repo",
      "install": "https://raw.githubusercontent.com/jsoyer/cv-templates/main/templates/template-name/"
    }
  ]
}
```

---

## Contributing a template

See [`templates/_example/README.md`](templates/_example/README.md) for the full submission guide.

**Quick steps:**

1. Fork this repo
2. Add `templates/your-template-name/` with `template.yml`, `.cls`, `preview.png`, `README.md`
3. Update `registry.json`
4. Open a PR — include a preview PDF or screenshot

---

## Offline mode

If the registry is unreachable, `template-market.py` falls back to listing only the 3 built-in templates with a warning. All pipeline functionality remains available.

---

## License

Each template retains its original license. See the individual `templates/*/README.md` for details.
The registry metadata and tooling in this repo are MIT licensed.
