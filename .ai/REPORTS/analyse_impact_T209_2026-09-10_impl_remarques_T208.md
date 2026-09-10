# Analyse d'impact — T-209 — Implémentation des remarques T-208

- **Date** : 2026-09-10
- **Niveau retenu** : C
- **Justification** : la tâche touche le schéma `bookings`, le cycle de vie de réservation, un cron, la sécurité d'accès aux comptes démo et le périmètre finance/payout legacy.

## Commandes d'observation exécutées

- `git branch --show-current && git status --short`
- `rg -n "bookings =|paymentExpiresAt|requestExpires|expires" src/db src/lib src/app/api/cron src/app/api/bookings scripts`
- `nl -ba src/db/schema.ts | sed -n '280,390p'`
- `ls drizzle && cat drizzle/meta/_journal.json | tail -40`
- `sed -n '1,220p' src/app/api/cron/price-alerts/route.ts`
- `sed -n '1,320p' src/app/api/bookings/route.ts`
- `sed -n '1,220p' src/lib/email-outbox.ts src/lib/mail/templates.ts src/lib/settings.ts src/lib/mail/strings.ts`
- `sed -n '1,240p' src/app/(auth)/connexion/login-client.tsx src/app/page.tsx src/app/api/seed/route.ts`
- `find src/app/api -path '*payout*' -type f -maxdepth 6 -print`
- `sed -n '1,260p' scripts/dashboards_sim.py`
- `sed -n '1,240p' src/components/maintenance-gate.tsx src/components/unread-messages-badge.tsx`

## 1. Fichiers utilisant directement les composants concernés

- Réservations : `src/app/api/bookings/route.ts`, `src/app/api/bookings/[id]/route.ts`, `src/app/api/cron/price-alerts/route.ts`, `src/db/schema.ts`, migrations `drizzle/*`.
- Emails : `src/lib/email-outbox.ts`, `src/lib/mail/templates.ts`, `src/lib/mail/strings.ts`, `src/lib/settings.ts`, callers existants d'emails booking/claim.
- Démo : `src/app/(auth)/connexion/login-client.tsx`, `src/app/api/auth/login/route.ts`, `src/app/page.tsx`, `src/app/api/seed/route.ts`, `.env.example`, `scripts/restore-env.sh`.
- Payout : `src/app/api/host/payouts/route.ts`, `src/app/api/host/payout-account/route.ts`, `src/app/api/cron/payouts/route.ts`, dashboard billing et tests T-195.
- QA/UX : `scripts/dashboards_sim.py`, `src/components/maintenance-gate.tsx`, `src/components/unread-messages-badge.tsx`.

## 2. Composants indirectement impactés

- Pages `/reservation`, `/mes-reservations`, `/dashboard/bookings`, `/dashboard/billing`, `/connexion`, `/`.
- Calcul de disponibilité sur fiche/recherche, car les `pending` non annulées continuent à compter jusqu'à expiration.
- Cron local `scripts/cron-runner.mjs` via `/api/cron/price-alerts`.
- Smoke/site-audit/simulations qui vérifient boutons démo, seed, dashboards et payouts.

## 3. ViewModels impactés

Non applicable à MyBestBooking (Next.js/React). Équivalents côté client : composants React listés ci-dessus.

## 4. Écrans impactés

- `/connexion` : bloc comptes démo conditionnel.
- `/` : bouton seed de l'état vide conditionnel.
- `/reservation` et listes de réservations : affichage du statut `pending` inchangé, ajout possible d'un champ expirant côté API.
- `/dashboard/billing` : lecture historique conservée, actions mutables déjà masquées par T-207 et renforcées côté API.

## 5. Workers/services impactés

- Cron `/api/cron/price-alerts` : ajouter expiration des demandes manuelles.
- Cron `/api/cron/payouts` : désactiver par défaut tant que `PLATFORM_PAYOUTS_ENABLED` n'est pas explicitement vrai.
- Outbox email : nouveaux événements idempotents pour demande créée.

## 6. Tests existants couvrant déjà le périmètre

- `src/app/api/bookings/route.t203.test.ts`, `route.t206.test.ts`, `route.test.ts`
- `src/lib/booking-confirmation.test.ts`
- `src/app/api/cron/price-alerts/route.test.ts`
- `src/app/api/host/payouts/route.test.ts`, `host/payout-account/route.test.ts`, `cron/payouts/route.test.ts`
- `src/lib/ui-strings.test.ts`
- `scripts/smoke.sh`, `scripts/run_all_sims.py`, `scripts/dashboards_sim.py`, `scripts/xtreme_sim.py`

## 7. Nouveaux tests à créer/adapter

- Test unitaire pur pour le TTL de demande (`requestExpiresAt`) et expiration.
- Test DB-backed booking : une demande manuelle reçoit `requestExpiresAt` et `paymentExpiresAt:null`.
- Test cron : une demande expirée sans paiement est annulée, une non expirée reste active, une réservation confirmée n'est pas touchée.
- Tests templates email demande créée FR/EN et/ou test outbox idempotente via POST booking.
- Tests login démo : flag prod off → refus compte démo ; flag on → comportement historique.
- Tests payout disabled : POST host payouts / payout-account / cron payout → 410 par défaut ; anciens tests legacy passent avec `PLATFORM_PAYOUTS_ENABLED=true`.

## 8. Risques de régression

- **Surbooking** : si les pending ne comptent plus immédiatement, deux voyageurs pourraient obtenir une demande concurrente. Mitigation : conserver le blocage jusqu'au TTL et expirer seulement après délai.
- **Confusion paiement** : réutiliser `paymentExpiresAt` réactiverait la sémantique paiement. Mitigation : champ `requestExpiresAt` dédié.
- **Emails doublons** : deux destinataires avec un seul eventKey peuvent se bloquer. Mitigation : eventKeys distinctes par destinataire.
- **Production demo** : flags `NEXT_PUBLIC_*` exposent volontairement l'état UI, pas de secret ; le refus serveur utilise un flag serveur.
- **Payout tests legacy** : désactivation par défaut casse les tests historiques si non flaggés. Mitigation : tests legacy opt-in explicite.
- **Smoke preview** : en production locale, les boutons démo doivent rester visibles si l'env de sandbox active les flags.

## 9. Composants à revérifier après correction

- `POST /api/bookings` no-payment, disponibilité, outbox.
- `GET /api/cron/price-alerts` avec expiration demande.
- `/connexion` SSR/CSR et `POST /api/auth/login`.
- `/` état vide seed.
- `/api/host/payouts`, `/api/host/payout-account`, `/api/cron/payouts`.
- `scripts/dashboards_sim.py`.
- `maintenance-gate` et `unread-messages-badge` dans l'audit statique.

## Conclusion

Le plan doit rester additif : migration nullable, flags désactivés par défaut en prod, lecture historique conservée, aucune suppression de flux existant hors actions explicitement dangereuses en payout legacy.
