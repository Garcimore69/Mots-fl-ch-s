# Mots fléchés — guide du dépôt

PWA de mots fléchés en français, hors ligne, pensée pour Android (OnePlus 10 Pro, Chrome).
Décisions produit : `claude/decisions.md` dans le projet claude.ai (à relire avant toute session, à mettre à jour à chaque décision).

## Commandes
- `npm run dev` — serveur de dev (Vite)
- `npm run build` — vérification TypeScript + build dans `dist/` (service worker inclus)
- `npm test` — tests unitaires (Vitest) du moteur de jeu
- `npm run validate` — validateur bloquant sur `public/grids/` (Python 3, sans dépendance)
- Déploiement : push sur `main` → GitHub Actions (validation, tests, build) → GitHub Pages

## Architecture
- `src/game/grid.ts` — géométrie : emplacements, case-définition propriétaire, flèches. **Miroir de `tools/grid.py`** : garder les deux identiques.
- `src/game/engine.ts` — moteur pur (sans DOM) : saisie, avance du curseur, aides, erreurs, fin de grille, sérialisation.
- `src/store/db.ts` — IndexedDB (`idb`) : parties en cours, résultats, réglages, aides, série.
- `src/data/` — chargement des grilles (`public/grids/index.json`), grille du jour, prochaine grille.
- `src/screens/` — Accueil, Jeu, Fin, Stats & réglages. DOM simple via `h()` (`src/ui/dom.ts`), pas de framework.
- `src/styles.css` — deux styles par variables CSS (`[data-theme=lumiere|papier]`), polices auto-hébergées (@fontsource).
- Routage par hash (`#/jeu/<clé>`, `#/fin/<clé>`, `#/reglages`). Clé de partie = id de grille ou `daily:AAAA-MM-JJ`.
- `vite.config.ts` — `base: './'` (fonctionne quel que soit le nom du dépôt), vite-plugin-pwa : tout est précaché, y compris les grilles.

## Pipeline des grilles (`tools/`)
1. `python3 tools/build_lexicon.py` — lexique `tools/data/lex.json` (wordfreq ∩ dictionnaire, filtres de `tools/wordlists.py`). Nécessite `pip install wordfreq` et `tools/data/dict-fr.json` (index.json du paquet npm `an-array-of-french-words`, non versionné).
2. `python3 tools/gen.py <niveau> <n> --seed S` — brouillons dans `tools/drafts/` (définitions vides). Évite les mots de 5+ lettres déjà utilisés.
3. Relecture des mots, rédaction des définitions dans `tools/defs/<id>.txt` (`RÉPONSE | définition`), puis `python3 tools/clues.py tools/drafts/<id>.json tools/defs/<id>.txt`. Mot inadapté → l'ajouter à `wordlists.py`, reconstruire le lexique, supprimer le brouillon et régénérer (les numéros libres sont réutilisés).
4. `python3 tools/validate.py tools/drafts/*.json` puis `python3 tools/publish.py` → `public/grids/` + `index.json`.

Niveaux : Facile 7×8, Moyen 9×10, Difficile 9×11, Expert 9×11 (colonnes × lignes). La difficulté vient du rang de fréquence maximal (`LEVELS` dans `gen.py`) et du style des définitions.

## Conventions
- Interface et textes en français ; code et identifiants en anglais, commentaires en français.
- Définitions : ≤ 34 caractères, ne contiennent ni la réponse, ni un mot de sa famille, ni un autre mot de 4+ lettres de la grille (contrôlé par le validateur).
- Ne jamais publier une grille qui ne passe pas `validate.py`.
- Pas de mode sombre, pas de pub, pas de classement (cf. « Écarté » dans decisions.md).
