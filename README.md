# Mots fléchés

Jeu de mots fléchés en français, en PWA installable et jouable hors ligne.

- Grilles Facile, Moyen, Difficile, Expert + grille du jour avec série
- Aide : révèle la lettre de la case en cours (stock de 4 au départ, plafond 25, +3 par jour, gains en fin de grille)
- Erreurs signalées quand un mot est complet (ou en fin de grille en mode « sans filet »)
- Plusieurs grilles en cours, sauvegarde locale, statistiques par niveau
- Deux styles : Lumière et Papier

## Installer sur Android
Ouvrir l'adresse GitHub Pages du dépôt dans Chrome, menu ⋮ → « Ajouter à l'écran d'accueil ». Après la première ouverture, tout fonctionne sans réseau.

## Développement
```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run validate   # contrôle des grilles
npm run build
```
Voir `CLAUDE.md` pour l'architecture et le pipeline de génération des grilles.
