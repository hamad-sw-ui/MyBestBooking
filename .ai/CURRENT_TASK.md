# 🎯 TÂCHE EN COURS

**ID** : Audit n°26 (rapport livré) — implémentation **en attente de validation**

**Niveau de proportionnalité** : S (analyse seule, aucun code)

**Titre** : Audit fonctionnel profond n°26 — scénarios et éléments
inachevés/mal pensés à l'exécution (pages, boutons, fonctionnalités).

**Statut** : RAPPORT LIVRÉ — 2026-08-30 (aucune implémentation, cycle
audit n°25 : rapport puis implémentation sur demande)

Rapport : `REPORTS/audit_fonctionnel_profond26_2026-08-30.md` (source).

## Synthèse des findings (14)

**P1 (3)**
1. Recherche : le prix « à partir de » n'est **jamais affiché**
   (« Prix indisponible » × 8) — sous-requêtes corrélées en SELECT rendues
   **non qualifiées** par Drizzle (`r2.property_id = "id"` → NULL) ; la même
   expression en WHERE/ORDER BY est correcte (tri/filtre max OK).
2. Recherche : filtre **prix min sémantiquement faux** (`∃ chambre ≥ min` au
   lieu du min de la propriété) — `min=107` → 8/8, `max=91` → 3.
3. Cashback BestRewards : le caller `PUT /api/bookings/[id]`
   (`status:"completed"`, bouton UI « Terminer le séjour ») n'a **pas** le 4ᵉ
   argument `currency` ajouté par T-153 C (seul le cron l'a).

**P2 (5)** : récap réservation (TVA `0.1` dur vs `billing.taxRate` éditable ;
réduction BestRewards 15 % jamais affichée : aperçu 261,07 € / facturé
221,91 €) ; « Annulation gratuite » en dur vs politique réelle ; favoris
add-only (`wishlists[0]`, aucun retrait unitaire — `DELETE ?propertyId`
jamais appelé) ; alerte prix morte si aucune chambre active dans la devise
de l'alerte ; `useToast` monté jamais utilisé.

**P3 (6)** : montants sans devise (`rate-plans-section`, `price-alerts-section`),
promo « € » durs, **XAF zéro-décimal Stripe → ×100**
(`payment-intents.ts`/`payment-events.ts`), dark mode partiel + toggle absent
dashboard mobile, calendrier valeurs par défaut non persistées, amenities
3 listes (5/12/12 vs 27 en base), help center (phrasing Stripe).

## Contraintes (inchangées)
- AUDIT SEUL tant que l'utilisateur ne valide pas l'implémentation.
- Solutions sans régression : additifs (pas de migration, pas de changement
  de contrat API public, cas EUR inchangés).
- Écarts invalidés documentés dans le rapport (users/me 405, perf 35,6 s =
  cold start, RBAC 307, ids amenities).

## Étape suivante (sur validation)
1. P1 recherche (findings 1+2, un seul chantier + tests) ; 2. P1 cashback
   (ligne + tests) ; 3. P2 5-7 (petits chantiers) ; 4. P2 4+8 ; 5. P3 au fil
   de l'eau. Détails fichier/fichier dans le rapport.
