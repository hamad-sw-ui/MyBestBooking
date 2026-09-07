# Validation T-202 — Validation hôte & paiement manuel

Date : 2026-09-07 · Statut : **VALIDÉ**

## Gates (tous ✅)
- 🔨 `tsc --noEmit` → **0 erreur**
- 🔨 `eslint src --max-warnings 0` → **0 erreur / 0 warning**
- 🔍 `i18n:check` → **0 candidat** (catalogue **1477** FR=EN)
- 🔨 `next build` → **Compiled successfully** (64 pages + routes `/api/admin/hosts` + `/api/admin/hosts/[id]`)
- 🧪 `vitest run` → **546/546** (82 fichiers, 0 skip). +10 tests (5 nouveaux `admin/hosts`, 5 `commission`).
- ▶️ `smoke` → **95/95**
- ✅ `ai:check` → 19 OK · 0 fail (R7 warn toléré en fin de session)

## Nouveaux tests
| Test | Fichier | Couvre |
|---|---|---|
| Commission pure (priorité) | `src/lib/commission.test.ts` | propriété > hôte > global, bornage [0,100], valeurs non-numériques |
| Bienvenue hôte | `src/lib/host-approval.ts` (helper) | state approuvé / pending / rejected / non-hôte |
| Admin approbation (intégration) | `src/app/api/admin/hosts/route.test.ts` | GET liste, PATCH approve+commission, 403 non-admin, gate validate→409 |

## Preuves runtime (serveur prod :3000, base seedée)
- **Paiement manuel** : `POST /api/bookings` (sans `payOnline`) → `status:"pending"`,
  `paymentStatus:"pending"`, `payment:null`, `manualConfirmation:true`. ✅
- **Confirmation manuelle par l'hôte** : `PUT /api/bookings/[id] {status:"confirmed"}`
  → `status:"confirmed"`, `confirmedBy:<hostId>`. ✅ (auparavant réservé à l'admin)
- **Hôte démo approuvé** : seed → `GET /api/admin/hosts?status=approved` → `host@mybestbooking.com` = `approved`, `commission:null`. ✅ (comportement historique préservé)
- **Gate de publication** : hébergement d'un hôte `pending` → `validate approve` → 409
  « compte hôte » (test automatique). ✅

## Récapitulatif des changements
- **Schema** : `users.approvalStatus`, `users.commissionRate`, `bookings.paymentMethodOffline`, `bookings.confirmedBy` (+ migration 0019).
- **Backend** : `host-approval.ts`, `commission.ts`, routes `/api/admin/hosts[/id]`, gate `validate`, paiement manuel dans `bookings/route.ts`, `payment-events.ts` (plus d'auto-confirm), `bookings/[id]` (confirmedBy).
- **UI** : `host-approve-actions.tsx`, colonne validation hôte dans `users-manager.tsx`, bouton « Confirmer la demande » dans `booking-row-actions.tsx`.
- **i18n** : +15 clés (FR/EN).
- **Seed** : hôte démo `approved`.

## Base restaurée
Après tests, la base est revenue à l'état seed (0 compte `host-t202*`, 0 réservation de test, hôte démo `approved` unique).
