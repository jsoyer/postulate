## Template submission — `templates/NOM_DU_TEMPLATE/`

### Informations générales

- **Nom du template** :
- **Style** : (ex: 1 colonne, 2 colonnes, sidebar, minimaliste…)
- **Pages** : 1 / 2
- **Moteur LaTeX** : xelatex / pdflatex / lualatex
- **Licence** :

### Checklist

- [ ] `template.yml` complet (tous les champs obligatoires)
- [ ] `.cls` déposé dans `templates/NOM/` (ou `cls_source` pointe une classe TeX Live)
- [ ] `README.md` présent (description, usage, layout, licence)
- [ ] `preview.png` joint (800×1100 px, 1ère page du PDF)
- [ ] `registry.json` mis à jour avec les métadonnées
- [ ] Testé localement : `make market-install NAME=... && make render TEMPLATE=... && make build`
- [ ] PDF compilé sans erreur, tient en 1 ou 2 pages
- [ ] Licence compatible (MIT, Apache, CC-BY)
- [ ] Attributions originales conservées si fork

### Packages TeX Live requis

> Lister les packages nécessaires au-delà de TeX Live standard (ceux dans `requires:` de `template.yml`)

-

### Fonction Python `render_cv_*`

> Indiquer le nom de la fonction à ajouter dans `scripts/render.py` du repo principal,
> et joindre le diff ou décrire l'implémentation ci-dessous.

```python
# render_cv_mon_template(data: dict) -> str
```

### Preview

> Joindre une capture du PDF rendu (ou coller le lien vers l'artifact CI généré par compile-check.yml)

### Notes pour le reviewer

> Contexte, choix de design, inspirations, limitations connues.
