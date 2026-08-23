# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a02dbb-mybestbooking`
- **HEAD validé T-104** : `54dcbb2`
- **Version Framework** : AI-DOS 3.0.0
- **Dernière tâche validée** : T-105 — pages, promesses et actions opérationnelles

## 🛠️ État technique T-102

- Règles transactionnelles : capacité voyageurs, stock par nuit, stop-sell et
  minStay sont évalués côté serveur dans `POST /api/bookings`.
- Cycle de vie : le voyageur annule uniquement ; clôture après départ par hôte,
  admin ou tâche planifiée ; avis après séjour terminé.
- Paiement : Stripe pending n’est pas présenté comme payé ; Stripe Elements est
  intégré conditionnellement ; mock limité dev/test ; remboursement/cancel
  tracés par migration `0008_booking-integrity-finance.sql`.
- Parcours : CTA de réservation unifié avec compatibilité legacy, checkout
  invité, reprise post-login sûre, navigation mobile authentifiée, conversation
  depuis réservation, pièces jointes visibles et wishlists partageables.
- Exploitation : cron idempotent prix + clôture des séjours, protégé par
  `CRON_SECRET` en production et planifié via `vercel.json`.
- Providers : coffre admin AES-256-GCM pour Stripe, Resend et S3, master key
  hors DB, métadonnées sans fuite, test explicite et fallback variables d’environnement.
- Messages : nouvelles pièces jointes privées, lisibles seulement par un
  participant ; rate plans snapshotés au booking et post-actions Stripe suivies.

## ✅ Preuves du cycle

- 🔨 `npm run typecheck` : succès.
- 🧪 `npm test` avec PostgreSQL embarqué et serveur : **215/215** tests réussis.
- 🔨 `npm run build` : succès ; route cron et checkout compilés.
- ▶️ Tests HTTP/API réels : stock journalier/minStay, capacité, transition
  voyageur, avis futur, conversation, pièce jointe, wishlist publique, cron
  idempotent, remboursement mock et clôture/fidélité cron validés.
- ❓ Stripe test-mode live reste à valider avec des clés fournisseur, non
  disponibles dans ce sandbox ; voir `KNOWN_LIMITATIONS.md`.

## Risques/limites résiduels

- Une facture légale et un vrai ledger de payout hôte restent à concevoir.
- Les tests E2E Chromium ne sont pas exécutables ici car le navigateur ne peut
  pas être téléchargé ; smoke HTTP et build production ont été exécutés.
- Quelques `<img>` natifs et l’amélioration responsive des tableaux dashboard
  restent des dettes P2.

## Documents de référence

- `REPORTS/audit_execution_fonctionnel_2026-08-23.md`
- `REPORTS/analyse_impact_2026-08-23_remediation_audit_runtime.md`
- `REPORTS/analyse_conception_2026-08-23_remediation_audit_runtime.md`
- `ADR/ADR-009_Integrite_reservation_paiement_et_cycle_de_vie.md`

---
*Mis à jour le 2026-08-23, T-102 validée.*
