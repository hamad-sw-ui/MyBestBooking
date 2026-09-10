# Validation T-210 — Audit runtime complémentaire + filtre accueil

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Auteur** : Agent Arena.ai
- **Statut** : validé après correction des échecs transitoires de validation

## 1. Changements livrés

### Code produit

- `src/app/page.tsx`
  - Le formulaire hero de l'accueil ne contient plus `checkIn`, `checkOut`, `guests` ni `home-guests`.
  - Le formulaire conserve `action="/recherche"` et `name="city"`.
  - Les filtres avancés restent sur `/recherche`, fiche hébergement et `/reservation`.

### Tests / QA

- `src/app/page.home-filter.test.ts` ajouté pour verrouiller le contrat accueil.
- `scripts/xtreme_sim.py` réaligné pour considérer `reportSilentFetchIssue` comme feedback discret volontaire, afin de ne plus signaler les fetchs fail-open T-209 comme lacunes UX.
- `src/app/api/cron/price-alerts/route.test.ts` isolé sur des dates 2020 pour ne pas expirer des réservations runtime partagées lors de la suite globale.

### Documentation `.ai`

- `CURRENT_TASK.md`
- `FEATURES.md`
- `BACKLOG.md`
- `PROGRESS.md`
- `DEVLOG.md`
- `TRACEABILITY.md`
- `REPORTS/analyse_impact_T210_2026-09-10_audit_home_filter.md`
- `REPORTS/analyse_conception_T210_2026-09-10_audit_home_filter.md`
- `REPORTS/audit_fonctionnel_profond33_T210_2026-09-10.md`

## 2. Validations exécutées

| Commande / preuve | Résultat |
|---|---|
| `npm run test -- src/app/page.home-filter.test.ts` | ✅ 2 tests passés |
| `npm run test -- src/app/api/cron/price-alerts/route.test.ts` | ✅ 1 test passé |
| `npm run test -- src/app/api/cron/price-alerts/route.test.ts src/app/page.home-filter.test.ts` | ✅ 3 tests passés |
| `npm run test` | ✅ 100 fichiers passés / 2 skipped ; 577 tests passés / 17 skipped |
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur |
| `python3 -m py_compile scripts/xtreme_sim.py scripts/run_all_sims.py` | ✅ OK |
| `npm run i18n:check` | ✅ 0 écart |
| `npm run build` | ✅ Next.js 16.2.6, 65 pages générées |
| `npm run smoke` | ✅ 95/95 assertions |
| `python3 scripts/run_all_sims.py` | ✅ 402 OK / 0 WARN / 0 KO |
| `node scripts/reset_test_db.mjs` | ✅ DB de validation nettoyée avant crawl prod |
| `npm run site:audit -- http://127.0.0.1:3000` sur `next start` | ✅ 247 pages visitées / 0 issue |
| Probe HTTP `/` vs `/recherche` | ✅ `/` contient `city` seul ; `/recherche` garde `city/checkIn/checkOut/guests` |
| `npm run ai:check` | ✅ 20 OK / 0 warn / 0 fail |
| `git diff --check` | ✅ 0 erreur whitespace |

## 3. Échecs transitoires analysés et corrigés

### Vitest global — échec initial corrigé

- **Symptôme** : `src/app/api/cron/price-alerts/route.test.ts` attendait `count=1`, reçu `8`.
- **Cause** : le test utilisait `now=2031`, ce qui expirait aussi des demandes `pending` présentes dans la base partagée par les validations runtime.
- **Correction** : dates du test déplacées en 2020 (`now=2020-01-02`, expiration `2020-01-01`, futur `2020-01-03`) pour ne cibler que les lignes créées par le test.
- **Preuve finale** : test isolé 1/1 puis `npm run test` global 577 pass / 17 skip.

### Site audit — échec en mode dev, validation finale en production

- **Symptôme** : `site:audit` sur `next dev` terminait avec `EXC fetch failed` en fin de crawl ; le serveur dev sortait proprement sans stacktrace applicative après de nombreux HTTP 200.
- **Analyse** : faux rouge de validation dev/Turbopack sur long crawl, non reproduit avec le serveur production buildé.
- **Correction de procédure** : exécution finale sur `npm run build` + `next start`.
- **Preuve finale** : 247 pages visitées / 0 issue.
- **Suite proposée** : T-211 (`site:audit:prod`) pour automatiser ce mode.

## 4. Contrats non régressés

- `/recherche` conserve dates/voyageurs/prix/type/pays/équipements/tri.
- La fiche hébergement conserve dates/adultes/enfants pour disponibilité et lien réservation.
- `/reservation` conserve le devis serveur, la demande manuelle, le TTL T-209 et les emails.
- T-207 reste respecté : aucun paiement voyageur plateforme, pas de formulaire carte, pas de Stripe public, pas de CTA « Payer maintenant ».
- Le soft-delete rooms reste inchangé : aucune transformation en hard-delete.

## 5. État final

La commande finale a été exécutée après écriture documentaire :

```bash
npm run ai:check      # 20 OK · 0 warn · 0 fail
git diff --check      # 0 erreur
```

T-210 est donc validée sur les preuves disponibles dans le sandbox.
