# Contribuer un template — Guide complet

Ce guide explique exactement ce qu'il faut déposer pour ajouter un template à la marketplace.

---

## Ce que le pipeline CV attend d'un template

Le pipeline génère du LaTeX à partir de `cv.yml`, puis compile avec XeLaTeX.
Un template fournit :

1. **Une classe LaTeX** (`.cls`) ou un **package/style** (`.sty`) — le cœur visuel du template
2. **Une fonction Python** dans `scripts/render.py` du repo principal — qui traduit `cv.yml` → LaTeX en utilisant ta classe
3. **Les métadonnées** (`template.yml`) — pour l'indexation dans la marketplace

---

## Structure à déposer

```
templates/
└── mon-template/
    ├── template.yml        # obligatoire — métadonnées
    ├── mon-template.cls    # obligatoire — classe LaTeX principale (voir ci-dessous)
    ├── README.md           # obligatoire — description, usage, screenshot
    ├── preview.png         # recommandé — capture du PDF rendu (800×1100 px)
    └── fonts/              # optionnel — polices non disponibles dans TeX Live
        └── MaPolice.ttf
```

---

## Le fichier `.cls` — qu'est-ce qu'on dépose ?

### Cas 1 — Template basé sur une classe existante (le plus simple)

Si ton template utilise une classe TeX Live intégrée (`article`, `moderncv`, `scrartcl`…),
tu n'as **pas besoin de déposer de `.cls`** — indique juste la classe dans `template.yml`.

Exemple : un template basé sur `moderncv` avec du CSS/layout personnalisé via `\moderncvstyle`.

```yaml
# template.yml
cls_source: moderncv          # classe TeX Live, pas de .cls à déposer
```

### Cas 2 — Classe custom (.cls maison)

Si tu as créé ta propre classe `.cls` (ou forké une existante) :

- Dépose le fichier `.cls` directement dans `templates/mon-template/`
- Il sera copié dans le répertoire de compilation par `make market-install`
- La classe doit être compilable avec **XeLaTeX** (le moteur utilisé par le pipeline)
- Évite les dépendances à des packages obscurs — préfère ce qui est dans TeX Live standard

```
templates/mon-template/
└── mon-template.cls    ← déposé ici, installé automatiquement
```

### Cas 3 — Fork d'une classe existante

Si tu pars d'Awesome-CV, Friggeri, AltaCV, etc. :

- Dépose le `.cls` modifié
- Mentionne la source et la licence dans `README.md` et `template.yml`
- Conserve les attributions originales dans l'en-tête du `.cls`

---

## template.yml — format complet

```yaml
# Identifiant unique, en minuscules, tirets uniquement
name: mon-template

# Description courte (affichée dans make market-list)
description: Template minimaliste 1 colonne pour CVs académiques

# Auteur
author: Prénom Nom

# Version sémantique
version: 1.0.0

# Tags pour make market-search (choisir parmi : professional, tech, academic,
# minimal, creative, one-page, two-page, two-column, sidebar, colorful, serif, sans-serif)
tags:
  - academic
  - minimal
  - one-page

# Moteur LaTeX requis (xelatex recommandé — c'est ce qu'utilise le pipeline)
engine: xelatex       # ou: pdflatex, lualatex

# Nombre de pages attendu
pages: 1              # 1 ou 2

# Classe LaTeX utilisée
cls_source: mon-template    # nom sans extension .cls
                            # ou: moderncv, article, scrartcl (si TeX Live intégré)

# Packages TeX Live supplémentaires requis (installés via tlmgr)
# Laisser vide si rien au-delà de TeX Live standard
requires:
  - fontawesome5
  - sourcesanspro

# Nom de la fonction Python à ajouter dans scripts/render.py du repo principal
render_function: render_cv_mon_template

# URL du repo source (si fork ou inspiration)
source_url: https://github.com/auteur/repo-original

# Licence du template
license: MIT           # ou: Apache-2.0, GPL-3.0, CC-BY-4.0, etc.
```

---

## La fonction Python `render_cv_*` — comment l'écrire

C'est la colle entre `cv.yml` et ton `.cls`. Elle reçoit le dict Python issu de `yaml.safe_load(cv.yml)`
et retourne une chaîne LaTeX.

### Signature

```python
def render_cv_mon_template(data: dict) -> str:
    out = []
    # ... construire le LaTeX ...
    return "\n".join(out)
```

### Structure typique

```python
def render_cv_mon_template(data: dict) -> str:
    personal = data.get("personal", {})
    name     = personal.get("name", "")
    email    = personal.get("email", "")
    profile  = data.get("profile", "")

    out = []

    # Préambule
    out.append(r"\documentclass[11pt,a4paper]{mon-template}")
    out.append(r"\usepackage[utf8]{inputenc}")
    out.append(r"\begin{document}")

    # En-tête
    out.append(f"\\name{{{_esc(name)}}}")
    out.append(f"\\email{{{_esc(email)}}}")
    out.append(r"\maketitle")

    # Sections
    out.append(r"\section{Profile}")
    out.append(_esc(profile))

    # Expérience
    out.append(r"\section{Experience}")
    for exp in data.get("experience", []):
        out.append(f"\\cventry{{{_esc(exp.get('dates',''))}}}")
        out.append(f"         {{{_esc(exp.get('title',''))}}}")
        out.append(f"         {{{_esc(exp.get('company',''))}}}{{}}{{}}")
        out.append(r"         {}")

    out.append(r"\end{document}")
    return "\n".join(out)
```

### Fonctions utilitaires disponibles

Dans `scripts/render.py`, tu peux réutiliser :

```python
from render import _esc        # échappe les caractères LaTeX spéciaux (& % $ # _ { } ~ ^ \)
from render import _bold       # convertit **texte** → \textbf{texte}
from render import _render_items  # gère les items string ou dict {label, text}
```

### Où ajouter la fonction

Dans `scripts/render.py` du repo principal, après `render_cv_deedy()`, avant `main()`.
Puis brancher dans `main()` :

```python
elif args.template == "mon-template":
    latex = render_cv_mon_template(data)
```

**Note :** inclure le diff de `render.py` dans ta PR ou le décrire dans le README.

---

## README.md du template

Le README doit contenir au minimum :

```markdown
# Nom du template

Description courte.

## Prérequis

- TeX Live 2024+ avec les packages : ...
- XeLaTeX

## Usage

make render TEMPLATE=mon-template

## Layout

Décris la structure visuelle (colonnes, sections, etc.)

## Personnalisation

Variables ou options disponibles.

## Capture

[screenshot ou lien preview.png]

## Licence

MIT — basé sur [Source](url) par Auteur Original.
```

---

## preview.png — comment générer

```bash
# Depuis le repo CV principal, après installation :
make render TEMPLATE=mon-template
make build  # génère le PDF
# Convertir la 1ère page en PNG (ImageMagick) :
convert -density 150 CV.pdf[0] -resize 800x1100 templates/mon-template/preview.png
```

Dimensions recommandées : **800 × 1100 px**, fond blanc, 150 dpi.

---

## Checklist avant PR

- [ ] `template.yml` complet et valide (tous les champs obligatoires)
- [ ] `.cls` déposé (ou `cls_source` pointe vers une classe TeX Live existante)
- [ ] `README.md` avec description, usage, layout, licence
- [ ] `preview.png` ajouté (800×1100 px)
- [ ] `registry.json` mis à jour avec les métadonnées du template
- [ ] Testé localement : `make market-install NAME=mon-template && make render TEMPLATE=mon-template && make build`
- [ ] PDF compilé sans erreur, tient en 1 ou 2 pages selon `pages:` dans `template.yml`
- [ ] Licence compatible (MIT, Apache, CC-BY) — pas de GPL si possible

---

## Tester localement avant de soumettre

```bash
# Dans le repo jsoyer/CV :
make market-install NAME=mon-template

# Vérifier que le template est bien installé :
make market-installed

# Générer le LaTeX :
make render TEMPLATE=mon-template

# Compiler le PDF :
make build

# Vérifier le nombre de pages :
make page-count
```

---

## Questions / support

Ouvre une issue dans ce repo avec le tag `template-submission`.
