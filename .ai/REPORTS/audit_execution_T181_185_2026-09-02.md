# Audit d'exécution — T-181…T-185 (accélération du projet)

- **Date** : 2026-09-02
- **Demande** : « accélérer l'exécution des fonctionnalités, avec un plan
  non-régressif validé avant implémentation » (plan présenté, option
  « exécuter T-181 → T-185 en séquence » choisie par l'utilisateur).

## Baseline mesurée (avant — build T-180, prod locale)

| Cible | p50 |
|---|---|
| `/` | 22 ms |
| `/recherche` | 20 ms (84 ms à froid) |
| `/hebergement/[slug]` | 35–80 ms |
| `/connexion` | 11 ms |

Constats d'audit : DB déjà saine (index sur tous les prédicats chauds,
pool global drizzle) ; **60/60 routes dynamiques** (aucune page/couche de
données publiques cachée) ; `images.unoptimized` (requis ici : le sandbox
n'a **pas d'egress vers Unsplash** — probe 000) ; tri/pagination de la
recherche = 2 requêtes séquentielles ; fiche : rooms et avis séquentiels.

## Décisions prises en cours de route (honnêteté mesurée)

| Idée initiale | Mesure | Décision |
|---|---|---|
| Réactiver l'optimizer `/_next/image` | Sandbox sans accès sortant Unsplash (probe 000) → **toutes les images cassées** en preview | **REVERTÉ + documenté** (commentaire config : activation réservée à une prod avec egress) |
| `optimizePackageImports` (lucide-react/date-fns) | **0 octet de gagné** (1 483 688 o avant == après) : Turbopack tree-shake déjà les barils | **RETIRÉ** — pas de config sans effet mesurable |
| Cache de données catalogue/fiche (TTL 60 s) | Froid 84 ms → chaud p50 12–24 ms | **IMPLÉMENTÉ** (T-182) |
| Cache HTTP API catalogue | anonyme `s-maxage=30` / connecté `no-store` | **IMPLÉMENTÉ** (T-183) |
| Requêtes parallélisées (au lieu du streaming invasif) | 1 aller-retour DB de moins par page | **IMPLÉMENTÉ** (T-184) |
| Mesure pérenne | `scripts/perf-baseline.sh` + alias `npm run perf` | **IMPLÉMENTÉ** (T-185) |
