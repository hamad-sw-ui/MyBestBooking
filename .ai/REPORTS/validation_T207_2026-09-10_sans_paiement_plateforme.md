# Validation — T-207 — Réservations sans paiement plateforme

- **Date** : 2026-09-10
- **Statut** : CORRIGÉ (VALIDÉ)
- **Niveau** : C

## Résultat produit

Le parcours voyageur MyBestBooking ne conduit plus à un paiement en ligne :

- `/reservation` envoie une demande de réservation à l'hôte, sans choix "payer en ligne", sans carte, sans Stripe, sans reprise payment.
- `POST /api/bookings` ignore les champs legacy `payOnline:true` et `useWalletCredits:true` ; aucun intent PSP n'est créé et le wallet n'est pas débité.
- `/api/bookings/[id]/payment` est neutralisé (`410 ONLINE_PAYMENT_DISABLED` après auth/propriété).
- Les CTA "Payer maintenant" ont été retirés.
- `/api/providers/stripe` n'expose plus de clé publique au navigateur.
- `StripePaymentForm` est un stub sans Stripe.js/Elements ; `shouldShowStripeForm()` retourne toujours `false`.
- Les textes aide/compte/légal/RGPD/billing/facture ont été alignés sur demande, montant de référence et règlement hors plateforme.
- Le billing pro n'affiche plus de setup ou bouton de versement plateforme ; settings admin masque Stripe comme provider de paiement voyageur.

## Problèmes traités

Voir l'audit détaillé : `.ai/REPORTS/audit_runtime_T207_2026-09-10_sans_paiement_plateforme.md`.

Résumé :

1. Tunnel réservation encore orienté paiement → remplacé par demande sans paiement.
2. Payloads forged `payOnline/useWalletCredits` → ignorés côté serveur.
3. Route reprise paiement → 410 défensif.
4. CTA paiement dans réservations → supprimé.
5. Stripe navigateur → clé non exposée + composant stub.
6. Confirmation d'anciens PSP impayés → neutralisation legacy puis confirmation possible.
7. Wallet → informatif, non débité.
8. Wording/légal/RGPD/facture → aligné sans promesse carte/Stripe.
9. Billing/payout/settings → surfaces de paiement plateforme masquées ou informatives.
10. QA → scripts adaptés au nouveau modèle.

## Validations exécutées

- 🔨 `npx tsc --noEmit --pretty false --incremental false` ✅ plusieurs passes intermédiaires pendant l'implémentation.
- 🔨 `npm run typecheck` ✅ 0 erreur.
- 🔨 `npm run lint` ✅ 0 erreur.
- 🔍 `npm run i18n:check` ✅ aucun candidat détecté.
- 🧪 Tests ciblés T-207/T-206/T-203 impactés ✅ `5 files`, `23 tests passed` :
  - `src/lib/ui-strings.test.ts`
  - `src/lib/booking-flow.test.ts`
  - `src/app/api/bookings/[id]/payment/route.test.ts`
  - `src/app/api/bookings/[id]/route.t206.test.ts`
  - `src/app/api/bookings/route.test.ts`
- 🧪 `npm test` ✅ `94 passed`, `2 skipped`, `558 passed`, `17 skipped`.
- 🔨 `npm run build` ✅ Next.js 16.2.6, `65/65` pages générées.
- ▶️ `SEED_TOKEN=dev-seed-token npm run smoke` ✅ `95 PASS / 0 FAIL`.
- ▶️ `npm run site:audit -- http://127.0.0.1:3000` ✅ `260 pages`, `0 issue` (relancé sous `next start`; un premier passage sous `next dev` a été interrompu par arrêt du serveur et n'a pas été retenu comme preuve finale).
- ▶️ `python3 scripts/run_all_sims.py` ✅ `5/5` simulations, `399 OK / 4 WARN / 0 KO`.
- ▶️ `node scripts/reset_test_db.mjs` ✅ DB locale nettoyée après smoke/simulations.
- ✅ `npm run ai:check && git diff --check` ✅ `20 OK / 0 warn / 0 fail`, aucune whitespace error.

## Observations

- Les modules PSP/Stripe historiques (`src/lib/payment-*`, webhook Stripe, colonnes `paymentStatus`/`paymentIntentId`) sont conservés pour compatibilité et tests legacy, mais ils ne sont plus exposés au parcours voyageur.
- Les versements hôtes/routes payout restent en compatibilité technique et tests existants, mais l'UI pro active affiche un état informatif "versements plateforme désactivés".
- Les warnings restants des simulations (`4 WARN`) sont ceux du harnais historique ; aucune simulation ne remonte de KO.

## Conclusion

T-207 est validé localement : le produit propose maintenant des demandes/réservations sans paiement dans la plateforme, avec garde UI + API contre les reprises ou payloads de paiement legacy, sans casser les parcours de recherche, devis, réservation, confirmation hôte, annulation, messagerie et QA.
