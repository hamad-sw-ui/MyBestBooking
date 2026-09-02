# 🔍 Audit d'exécution — feedbacks des filtres de recherche & états silencieux (T-175)

- **Date** : 2026-09-01
- **Méthode** : exécution réelle (PostgreSQL embarqué + seed + dev :3000),
  sondes ciblées `/recherche` × 11 combinaisons de paramètres, `/reservation`
  (dates inversées/passées), register doublon email, revue du moteur
  (`validStay`, `priceBounds`, `eligibleRoomPredicate`, pagination).
- **Contexte** : passe complémentaire à l'audit T-172 (métadonnées/noindex)
  — ici : **ce que voit (ou ne voit pas) l'utilisateur** quand il saisit un
  critère que le moteur écarte.

## 1. Constat : la recherche « ment en silence » (corrigé)

| Sonde (avant) | Rendu | Diagnostic |
|---|---|---|
| `?minPrice=500&maxPrice=100` | « 0 résultat » générique | Bornes inversées → clause SQL `min ≤ p ≤ max` impossible ; l'utilisateur conclut « rien de disponible » au lieu de « ma fourchette est incohérente » |
| `?checkIn=2027-05-10&checkOut=2027-05-03` (inversées) | 8 résultats présentés normalement | `validStay` = faux → clause dispo **ignorée** : l'utilisateur croit ces dates disponibles |
| `?checkIn=2020-…&checkOut=2020-…` (passées) | 8 résultats idem | séjour passé : non réservable, pourtant présenté « à partir de … /nuit » |
| `?guests=abc` | ignoré, 8 résultats | NaN → filtre voyageurs abandonné sans mot |
| `?page=999`, `-3`, `abc` | clamp page 1 silencieux | comportement absorbant standard (inchangé, non bloquant) |

**Cause racine** : le moteur écarte proprement les valeurs invalides (bon
réflexe de robustesse), mais aucune information ne remonte à l'UI —
l'interface est un tunnel silencieux.

## 2. Solution appliquée — zéro régression par construction

- **Le moteur de filtrage n'est pas modifié** (requêtes SQL, conversion
  devise T-133, pagination, tris : intacts). Seule lecture des mêmes règles.
- Nouvelle brique pure `src/lib/search-warnings.ts` :
  `searchFilterWarnings(params)` → `datesIgnored | pastDates |
  priceInverted | guestsIgnored[]` (+ mapping type-safe vers clés)
  — 0 io, 100 % testable.
- Bandeau `role="alert"` localisé (FR/EN, 4 nouvelles clés → catalogue
  **1420**) rendu au-dessus des résultats **uniquement** quand un
  paramètre saisi a été écarté. Recherche saine : aucun changement visuel.
  Comparaison prix faite **en devise de stockage** (miroir du moteur).
- Plus : titre d'état du tunnel `/reservation` — « Informations de
  réservation manquantes » → « manquantes **ou invalides** » (couvre dates
  inversées/passées ; page déjà gracieuse, aucun crash).
- Vérifié conforme : register doublon email **409 + message explicite**

## 3. Éléments éprouvés sans reproche cette passe

- Pagination hors bornes : clamp doux (comportement absorbant acceptable).
- `/reservation` sans paramètres : état gracieux + CTA recherche.
- Register email déjà pris : 409 français/anglais corrects.
- Garde-fous framework (R15/R18/R19) : 0 violation.

## 4. Non-régression démontrée

`searchFilterWarnings()` est pure ; le rendu est conditionnel ; aucune clé
existante modifiée dans son sens métier (une seule reformulation de titre
d'état d'erreur reservation). Tous les résultats de recherche, la
conversion XAF et la pagination sont inchangés — preuves chiffrées dans le
rapport de validation.
