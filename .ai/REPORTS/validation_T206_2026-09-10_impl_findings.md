# Validation — T-206 — Implémentation findings runtime post T-205

Date : 2026-09-10  
Niveau : C  
Statut : **CORRIGÉ (VALIDÉ)**

## 1. Périmètre validé

Correction des 13 findings listés dans `.ai/REPORTS/audit_fonctionnel_profond31_T206_2026-09-09.md` : finance booking/promo, lifecycle paiement, publication hôte, maintenance API, robustesse UUID, recherche/catalogue, capacité enfants, messagerie, suppression compte, facture unpaid, concurrence promo et harnais QA.

## 2. Tests ciblés ajoutés ou adaptés

- `src/app/api/bookings/route.t206.test.ts` : invité + rate plan + promo ; vérifie cumul des remises, absence de BestRewards invité et consommation promo.
- `src/app/api/bookings/[id]/route.t206.test.ts` : confirmation manuelle conservée, confirmation online unpaid refusée, `completed` unpaid refusé.
- `src/app/api/properties/[id]/route.t206.test.ts` : gate publication via PUT générique et UUID invalide DELETE.
- `src/app/api/users/me/route.t206.test.ts` : suppression compte bloquée si réservation active.
- `src/lib/future-stay.test.ts` : parsing/garde dates futures.
- `src/lib/invoice.test.ts` : facture légale impossible tant que paiement non soldé.
- Tests existants adaptés : `src/app/api/properties/[id]/route.test.ts` n’est plus dépendant d’un `Math.random()` du seed pour BestRewards ; `src/lib/ui-strings.test.ts` attend 1503 clés.
- Harnais adaptés : `scripts/simulate.py`, `scripts/deep_sim.py`, `scripts/paranoid_sim.py`, `scripts/run_all_sims.py`, `scripts/reset_test_db.mjs`.

## 3. Commandes de validation exécutées

| Commande | Résultat |
|---|---:|
| `npm ci` | OK — 470 packages installés ; 8 vulnérabilités npm existantes signalées, hors périmètre T-206 |
| `npm run typecheck` | OK — 0 erreur |
| `npm run lint` | OK — 0 erreur |
| `npm run i18n:check` | OK — aucun candidat FR détecté |
| `npm test -- src/lib/future-stay.test.ts src/lib/invoice.test.ts src/app/api/bookings/route.t206.test.ts src/app/api/bookings/[id]/route.t206.test.ts src/app/api/properties/[id]/route.t206.test.ts src/app/api/users/me/route.t206.test.ts` | OK — 6 fichiers, 12 tests passés |
| `npm test` | OK — 94 fichiers passés / 2 skipped ; 561 tests passés / 17 skipped |
| `npm run build` | OK — Next.js 16.2.6, 65 routes/pages |
| `SEED_TOKEN=dev-seed-token npm run smoke` | OK — 95/95 assertions |
| `npm run site:audit -- http://127.0.0.1:3000` | OK — 249 pages visitées, 0 issue |
| `python3 scripts/run_all_sims.py` | OK — 5/5 simulations ; 399 OK / 4 WARN / 0 KO |
| `npm run ai:check` | OK — 20 OK / 0 warn / 0 fail |

## 4. Probes runtime ciblées

- `/api/properties?checkIn=2020-01-01&checkOut=2020-01-03&guests=2` → `total=0`, `properties.length=0`.
- `/api/properties?amenity=tv` → `total=8`, aligné avec `/recherche?amenity=tv`.
- `/api/properties?maxPrice=50000&displayCurrency=XAF` → `total=0`, aligné avec la conversion XAF→EUR côté SSR.
- `/recherche?checkIn=2020-01-01&checkOut=2020-01-03&guests=2` → page 200 avec `0 résultats` et warning dates passées.
- Maintenance activée en DB + customer connecté + `POST /api/price-alerts` → HTTP 503 `{ code:"MAINTENANCE_MODE" }`, puis maintenance restaurée à false.

## 5. Conclusion

Les validations obligatoires demandées par l’utilisateur sont réussies. Les fonctionnalités existantes de T-205 sont préservées, et le runner de simulations ne contient plus de KO après actualisation des attentes fonctionnelles.
