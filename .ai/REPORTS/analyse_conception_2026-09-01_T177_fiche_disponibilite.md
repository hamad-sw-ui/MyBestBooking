# Analyse de conception — T-177 calcul d'occupation en lecture serveur

- **Date** : 2026-09-01
- **Tâche** : T-177 (S)

## Alternatives envisagées

1. **Filtrer côté moteur de recherche existant** (`/api/properties`)
   — rejeté : la fiche est déjà server-rendue ; un aller-retour client
   ajouterait latence + flash de contenu pour un indicateur secondaire.
2. **Réutiliser `roomAvailability` (pré-compté hôte)** — rejeté comme source
   unique : cette table est remplie par l'hôte (stop-sell, prix/jour) et ne
   compte pas les « occupings » réels (`bookings`); la règle exacte du POST
   est sur `bookings` (T-157).
3. **Comptage `bookings` jumeau du POST** (retenu) : même source de vérité
   que la garde définitive, zéro divergence d'interprétation possible quant
   au seuil affiché.

## Design

- `room-remaining.ts` entièrement pur → comportement exploré par 6 tests
  sans DB.
- `stayDatesFromPropertyQuery` refuse **toute** incohérence (malformé,
  inversé, nuit nulle) → la fiche en rendu historique : « paranoïa en
  entrée, signal en sortie ».
- Condition d'affichage unique : `roomRemaining.get(id) === 0` → hors du
  périmètre (pas de dates), la `Map` est vide et `undefined !== 0` garde le
  CTA standard — zéro if supplémentaire dans le JSX nominal.
- Une seule requête groupée pour toutes les chambres (pas de N+1).

## Non-régression

- Toute page fiche sans paramètres : contenu octet-pour-octet équivalent
  (vérifié : 4 CTA « Réserver », 0 badge).
- Seuil compté EXACTEMENT comme le refus API (test runtime de synchronie :
  affichage « Complet » dès que le 409 arrive, jamais avant).
- Pas de nouvelle dépendance, clés i18n strictement additives, `?lang=en`
  vérifié.
