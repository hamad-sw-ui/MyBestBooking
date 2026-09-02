# Analyse d'impact — T-186 (visuels locaux + optimizer images)

- **Date** : 2026-09-02
- **Statut de la tâche** : EN COURS (étape 1/3) — impacts bornés par
  conception (bascule pilotée par la présence des fichiers).

## Changements (étape 1 livrée)

1. **`src/lib/seed-images.ts`** (+3 tests) : `seedImageUrl(key, legacy)`
   renvoie `/seed-images/<clé>.jpg` si le fichier existe dans `public/`,
   sinon l'URL Unsplash historique.
2. **`src/app/api/seed/route.ts`** : les 8 propriétés utilisent le
   résolveur (main + galerie ; la 3ᵉ image historique du Magnifique reste
   distante — affichée via `<img>` natif, jamais l'optimizer).
3. **`src/app/page.tsx`** : 5 destinations + fond d'écran hero passent par
   le résolveur.
4. **`public/seed-images/`** : 10 visuels générés (5 propriétés × 2).
5. **Données live** : UPDATE ciblé des 5 propriétés couvertes (seed
   idempotent, pas de ré-écriture).

## Impacts et maîtrise

| Surface | Impact | Maîtrise |
|---|---|---|
| Visiteurs (cartes/fiches/home) | 5 propriétés passent au local (statique Next, 200) ; les 3 autres restent sur le distant | Probes runtime : 200 `image/jpeg`, cartes locales servies ; quand fichiers absents → legacy (zéro 404) |
| Optimizer `/_next/image` | **Non activé** tant qu'une source `<Image>` peut être distante | Précondition documentée (étape 3) : TOUTES les sources locales d'abord |
| Tailles repo | +3,3 Mo de JPG (10 images) | Acceptable (assets produits démo ; `< 128 Mo/10 000 fichiers`) |
| Rollout multi-environnements | `public/seed-images/*` versionné (hors `.gitignore` uploads) | Rendu identique dev/preview/prod |
| Tests / gates étape 1 | vitest 479/479 (+3), tsc 0, eslint 0, build 60/60, smoke 94/94 | ✅ tous rejoués |

## Risque résiduel accepté

- Galerie « Hôtel Le Magnifique » : 3ᵉ vignette distante (legacy) tant que
  non régénérée — sans conséquence (img natif, egress navigateur OK).
