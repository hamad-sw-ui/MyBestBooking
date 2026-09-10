# Tâche courante

- **ID** : T-211
- **Titre** : Wrapper `site:audit:prod` pour audit de site en serveur production
- **Statut** : CORRIGÉ (VALIDÉ)
- **Niveau** : **L** (outillage local, aucune modification produit)

## Contexte

T-210 a validé le site audit sur `next start`, mais a observé des faux rouges `EXC fetch failed` lorsque le long crawl multi-profils était lancé contre `next dev`/Turbopack. T-211 outille désormais ce mode de validation fiable.

## Livré

1. Nouvelle commande `npm run site:audit:prod`.
2. Wrapper `scripts/site-audit-prod.mjs` :
   - exécute `npx next build` par défaut ;
   - lance `npx next start -H 0.0.0.0 -p <port>` ;
   - attend `/api/health` ;
   - exécute `node scripts/site-audit.mjs <baseUrl>` ;
   - arrête le groupe de processus du serveur en `finally`.
3. Port configurable par `SITE_AUDIT_PROD_PORT` ou `--port`; défaut `3100` avec recherche de port libre si non explicite.
4. Option `--skip-build` pour réutiliser un build existant.
5. `npm run site:audit` reste inchangé pour auditer une instance déjà servie.

## Validation

- `node --check scripts/site-audit-prod.mjs` : ✅ OK.
- `npm run site:audit:prod` : ✅ build 65 pages, serveur production `http://127.0.0.1:3100`, crawl 247 pages / 0 issue, serveur arrêté.
- `npm run lint` : ✅ 0 erreur.
- `npm run typecheck` : ✅ 0 erreur.
- `npm run i18n:check` : ✅ 0 candidat.
- `npm run test` : ✅ 100 fichiers passés / 2 skipped ; 577 tests passés / 17 skipped.
- `npm run ai:check` : ✅ 20 OK / 0 warn / 0 fail.
- `git diff --check` : ✅ OK.
- Vérification process final : ✅ aucun `next dev/start/next-server` persistant.

## Rapports

- `.ai/REPORTS/analyse_impact_T211_2026-09-10_site_audit_prod.md`
- `.ai/REPORTS/validation_T211_2026-09-10_site_audit_prod.md`
