# Analyse de conception — T-155 (audit n°27, 2 findings produit)

**Date :** 2026-08-30 · **Niveau :** S · **Contrainte :** additif, pas de
changement de contrat API public, pas de migration, cas EUR inchangés.

## 1. Code promo inconnu → 400 (au lieu de 409)

**Décision.** Classe `PromoCodeNotFoundError` dédiée ; catch placé **avant**
`BookingRuleError` → `400`.

**Rationale sémantique.**
- 400 = entrée invalide : le code n'existe pas, aucun état métier à
  résoudre (la requête ne peut **jamais** réussir).
- 409 = conflit d'état applicable : promo existante mais non utilisable
  (expirée, épuisée, règles de séjour, wallet insuffisant…). Ces cas
  restent 409, comportement inchangé.

**Alternatives rejetées.**
- Valider l'existence du code dans le schéma Zod : dupliquerait la lecture
  DB (déjà faite dans le handler) et séparerait la règle de son message
  métier.
- Renvoyer 404 : sémantique « ressource », or le code promo est un champ
  de la requête, pas une ressource du chemin.

**Compatibilité.** Aucun appelant existant ne dépend du statut 409 d'un
code inconnu (les clients traitent `!r.ok`) ; l'UI affiche le message
d'erreur renvoyé (`promo-code-input`). Message inchangé.

## 2. Filtre `?amenity=` : amenities portées par les chambres

**Décision.** Condition SQL :
`properties.amenities @> '["x"]' OR EXISTS (SELECT 1 FROM rooms ra WHERE
ra.property_id = properties.id AND ra.amenities @> '["x"]')`.

**Rationale.**
- Le domaine distingue `properties.amenities` (équipements de la
  propriété) et `rooms.amenities` (équipements de la chambre — `tv`,
  `minibar`…). Le formulaire expose l'union depuis T-154e (source unique
  `src/lib/amenities.ts`), mais le filtre SQL ne lisait que la propriété →
  filtre muet pour une partie des options.
- `OR EXISTS` garde **une seule** requête (pas de jointure qui
  démultiplierait les lignes avant `DISTINCT`/agrégation) et préserve les
  résultats `pool`, `kitchen`, `sea_view`… (sémantique de la propriété).
- Chaque propriété reste **au plus une fois** dans les résultats (l'EXISTS
  est un prédicat, pas une jointure) ; le MIN des chambres **éligibles**
  (tous filtres) reste le calcul de prix — inchangé.

**Alternatives rejetées.**
- Joindre `rooms` puis `GROUP BY properties.id` : plus lourd, modifie
  l'assemblage de la requête (risque d'interférer avec les sous-requêtes
  MIN existantes), aucun bénéfice.
- Filtrer côté JS après le SELECT : ferait revenir les mauvais résultats
  + fausser la pagination/total.

**Paramétrage.** Le tableau JSON est sérialisé par `JSON.stringify` —
même pattern préexistant, la valeur provient d'un query param validé par
le formulaire (liste blanche d'ids côté UI).

## 3. Harnais (ressynchronisation + robustesse)

- Contrats vérifiés dans le code réel (guest mode T-109, 2FA password
  T-120 D4, uploads privés, mailer `console_<hash>`), jamais d'assertion
  affaiblie qui masquerait une régression : deep 73→80 assertions,
  paranoid stable 71, smoke stable 94.
- `sh()`/`_run()` : `TimeoutExpired` → stdout vide (le check suivant
  reporte un KO explicite au lieu d'un crash python) ; timeouts relevés
  (login 60 s — cold compile Turbopack).
- `db_query` runner : 3 essais espacés (Postgres occupé au stop de Next).
