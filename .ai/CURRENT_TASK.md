# 🎯 TÂCHE EN COURS

**ID** : T-153

**Niveau de proportionnalité** : S

**Titre** : Implémentation des findings de l'audit fonctionnel n°25
(A→G) — véracité monétaire (wallet/promo/cashback × devises) + cohérence UI.

**Statut** : LIVRÉ (VALIDÉ) — 2026-08-30

Rapports (exigés §14/§15.1 pour un niveau S, avant tout code) :
- `REPORTS/analyse_impact_T-153_2026-08-30.md`
- `REPORTS/analyse_conception_T-153_2026-08-30.md`
- `REPORTS/opportunites_T-153_2026-08-30.md`
- `REPORTS/validation_T-153_2026-08-30.md` (rapport final, preuves complètes)

Source : `REPORTS/audit_fonctionnel_profond25_2026-08-30.md` (T-152).

## Périmètre retenu (décision)
- **A** 🟠 : wallet BestRewards (EUR) appliqué à un total non-EUR —
  conversion via `convertAmount` avant débit ; `walletCreditsUsed` stocké en
  EUR (restitution cohérente) ; garde explicite si devise inconnue.
- **B** 🟠 : promos `fixed_amount`/seuils (EUR) convertis vers la devise de
  la chambre (`normalizePromoForCurrency`) ; `GET /api/promotions/apply`
  accepte `currency` (défaut EUR) et renvoie `currency` (additif).
- **C** 🟡 : cashback BestRewards calculé sur le total **en EUR** avant
  crédit au wallet (cron) ; paramètre `currency` optionnel sur
  `calculateLoyaltyAward` (défaut EUR → appels existants identiques).
- **D** 🟡 : documenter la limite `notFound()` → 200 (noindex déjà émis par
  le not-found Next) dans `KNOWN_LIMITATIONS.md` — aucun changement de
  routage (aucune régression possible).
- **E** 🟡 : `€` durs restants → `formatPrice(…, devise)` :
  `dashboard/properties/[id]`, `mon-compte`, `bestrewards-status`,
  `promo-code-input` (+ `currency` de l'API).
- **F** ⚪ : « Utiliser mon solde » → `/recherche?wallet=1` + bandeau
  explicatif localisé.
- **G** ⚪ : badge « Avis bientôt disponible » pour séjour passé non
  `completed`.

## Contraintes de non-régression
- AUCUNE migration DB, AUCUNE colonne ajoutée ; conventions : wallet = EUR,
  promotions = EUR, bookings.currency = devise chambre.
- `applyPromoToTotal` et `calculateLoyaltyAward` (3 args) **inchangés** ;
  `GET /api/promotions/apply` sans `currency` → comportement historique
  (champ `currency` additif).
- Cas EUR : conversions ×1 → montants/rendus **identiques**.

## Preuves (détails dans `REPORTS/validation_T-153_2026-08-30.md`)
- tsc 0 · lint 0 erreur (3 warnings préexistants) · **vitest 340/340**
  (47 fichiers, +23) · smoke **94/94** · build OK · ai:check 19/1/0.
- Runtime : booking USD 137,67 $ / `walletCreditsUsed` 25,00 € / wallet
  débité 25,00 → 0,00 ; promo API USD 21,60 (historique 20,00 inchangé) ;
  cron cashback 200 $ → 9,26 € ; bandeau `?wallet=1` ; badge « Avis bientôt
  disponible ». Données de preuve nettoyées (DB = baseline).
