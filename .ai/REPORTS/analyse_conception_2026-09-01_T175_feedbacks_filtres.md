# Analyse de conception — T-175 bandeau d'avertissement des filtres

- **Date** : 2026-09-01
- **Tâche** : T-175 (S)

## Alternatives envisagées

1. **Corriger le moteur** (clamps/normalisation agressive, ex. inverser
   min/max automatiquement) — rejeté : changer les résultats sous les pieds
   de l'utilisateur serait une régression comportementale (un « 0 résultat
   expliqué » vaut mieux qu'un tri silencieusement modifié).
2. **Validation HTML5 côté formulaire** (`min`/`max` croisés via JS) —
   rejeté : nécessite du client hydraté pour un formulaire GET volontairement
   sans JS (robustesse), et ne couvre pas les URLs saisies/partagées.
3. **Bandeau serveur additif** (retenu) : lecture seule des paramètres par
   une fonction pure, rendu `role="alert"` localisé au-dessus des résultats.
   Rétrocompatible : URLs existantes strictement identiques, juste informées.

## Design

- `searchFilterWarnings(params)` renvoie une liste **ordonnée et bornée**
  (4 codes). Règles calquées sur le moteur : `validStay` (format
  YYYY-MM-DD + co>ci), `pastDates` (ci < aujourd'hui UTC), `priceInverted`
  (min>max **après** `priceBoundToStorage` — sinon un taux écrasant comme
  XAF pourrait fausser la comparaison), `guestsIgnored` (non entier ≤0).
- Mapping explicite `SEARCH_WARNING_KEY: Record<SearchWarning, UiStringKey>`
  → pas de clé dynamique non typée dans le JSX.
- Le rendu suit le style du bandeau wallet existant (ambre, list-disc)
  et n'apparaît jamais sur une recherche saine.
- Reformulation minimale du titre d'état réservation
  (« manquantes ou invalides ») : cas dates invalides couverts ; l'état est
  déjà gracieux (200 + CTA recherche) — aucun comportement ne change.

## Non-régression

Aucun déplacement de balise existante ; ajout conditionnel ; aucune clé
supprimée ; middleware/proxy non touchés ; pagination/tri/filtrage inchangés
(vérifié par rejoue des sondes T-172 + smoke 94/94).
