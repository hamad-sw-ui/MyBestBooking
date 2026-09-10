# Validation — T-205 — Mise en œuvre des remarques de l’audit fonctionnel/runtime

- **Date** : 2026-09-09
- **Tâche** : T-205
- **Statut** : IMPLEMENTÉ (VALIDÉ) ✅
- **Niveau** : S

## Résumé

Les remarques fonctionnelles/runtime ont été implémentées par lots additifs : paiement manuel/en ligne explicite, disponibilité réelle, référentiels partagés, visibilité hôte, bulk sécurisé, motifs d’audit, messagerie admin, billing/payout setup, analytics avis approuvés, désactivation de chambres, calendrier borné et devis checkout aligné sur le serveur.

## Corrections livrées

| Zone | Résolution | Preuve principale |
|---|---|---|
| Réservation / paiement | Choix manuel par défaut vs paiement en ligne `payOnline`, wording adapté, reprise Stripe forcée online. | 🔨 typecheck/build · ▶️ smoke booking manuel 201 pending |
| Devis checkout | Nouveau `GET /api/bookings/quote`, récap UI basé sur prix calendrier et progression bloquée tant que le devis est stale. | 🧪 `bookings/quote/route.test.ts` 2/2 |
| Wallet | Ligne wallet affichée dès qu’une déduction est appliquée, même sans promo. | 🔨 lint/typecheck |
| Fiche hébergement | CTA/alerte prix fondés sur `evaluateBookingRules` : stock, stop-sell, min stay, chevauchements, dates passées neutralisées. | 🧪 `room-remaining.test.ts` |
| Hôte / publication | `approvalStatus` exposé/affiché, hôte rejeté ré-approuvable, bulk approve applique `requireApprovedHost`. | 🧪 `auth/me/route.test.ts` + tests bulk DB-gated existants |
| Modération / suspension | Motifs demandés côté UI et persistés en audit metadata. | 🔨 lint/typecheck |
| Messagerie admin | Admin liste/lit/répond aux conversations, sans consommer les unread host. | 🧪 `messages/route.test.ts` DB-gated |
| Billing / payouts | Setup compte de versement visible même sans payout projeté ; hôte sans propriété traité sans `IN ()`. | 🔨 build |
| Référentiels | Types d’hébergement et pays centralisés, réutilisés en recherche/profil/propriété/réservation. | 🧪 `property-types.test.ts`, `countries.test.ts` |
| Chambres / calendrier | Bulk room delete devient désactivation ; UI et API availability bornent les plages et dates passées. | 🔨 typecheck/lint · ▶️ smoke dashboards |
| Wishlists / analytics | Partage public filtre les propriétés actives ; moyenne dashboard sur avis approuvés uniquement. | 🧪 `wishlists/shared/[token]/route.test.ts` DB-gated |

## Gates exécutées

| Gate | Résultat |
|---|---|
| 🔨 `npm run typecheck` | 0 erreur |
| 🔨 `npm run lint` | 0 erreur |
| 🧪 `npm test -- src/app/api/bookings/quote/route.test.ts` | 1 fichier passé · 2 tests passés |
| 🧪 `npm test` | 62 fichiers passés · 29 skipped ; 455 tests passés · 113 skipped |
| 🔍 `npm run i18n:check` | 0 candidat détecté |
| 🔨 `npm run build` | Succès Next.js · 65 pages |
| ▶️ `npm run smoke` | 95/95 PASS |
| ✅ `npm run ai:check` | 19 OK · 1 warn R7 · 0 fail |

## Notes d’environnement

- `node_modules` a été restauré via `npm ci` après l’échec initial `tsc: not found`.
- Le build Next nécessite `DATABASE_URL`; une DB PostgreSQL embarquée locale a été démarrée avec `npm run db:dev` et synchronisée par `npm run db:push`.
- Le run global Vitest conserve les skips DB-gated lorsque PostgreSQL n’est pas joignable ; le nouveau test de devis checkout a été exécuté séparément avec DB locale disponible.
- Aucun serveur/background process n’est laissé actif après validation.
