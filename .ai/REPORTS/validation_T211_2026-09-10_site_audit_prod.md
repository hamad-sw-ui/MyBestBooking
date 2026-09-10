# Validation T-211 — Wrapper `site:audit:prod`

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Niveau** : L
- **Auteur** : Agent Arena.ai
- **Statut** : CORRIGÉ (VALIDÉ)

## 1. Changements livrés

- Nouveau script : `scripts/site-audit-prod.mjs`.
- Nouveau script npm : `site:audit:prod` dans `package.json`.
- Documentation : `.ai/README.md`, `.ai/FEATURES.md`, `.ai/BACKLOG.md`, `.ai/CURRENT_TASK.md`, `.ai/PROGRESS.md`, `.ai/DEVLOG.md`, `.ai/TRACEABILITY.md`, `.ai/STATE.md`.

## 2. Contrat du wrapper

`npm run site:audit:prod` automatise le chemin de validation fiable observé en T-210 :

1. `npx next build` ;
2. choix d'un port production dédié (`3100` par défaut, `SITE_AUDIT_PROD_PORT` ou `--port` configurable) ;
3. `npx next start -H 0.0.0.0 -p <port>` ;
4. attente de `<base>/api/health` ;
5. exécution de `node scripts/site-audit.mjs <base>` ;
6. arrêt du groupe de processus lancé, même en cas d'erreur.

Options :

- `--skip-build` : réutilise le build existant ;
- `--port <n>` ou `SITE_AUDIT_PROD_PORT=<n>` : force le port.

## 3. Validations exécutées

| Commande | Résultat |
|---|---|
| `node --check scripts/site-audit-prod.mjs` | ✅ syntaxe OK |
| `npm run site:audit:prod` | ✅ build 65 pages, serveur `next start` sur `:3100`, 247 pages crawlées, 0 issue, serveur arrêté |
| `npm run lint` | ✅ 0 erreur |
| `npm run typecheck` | ✅ 0 erreur |
| `npm run i18n:check` | ✅ 0 candidat |
| `npm run test` | ✅ 100 fichiers passés / 2 skipped ; 577 tests passés / 17 skipped |
| Vérification process | ✅ aucun `next dev/start/next-server` restant après wrapper |
| `npm run ai:check` | ✅ 20 OK / 0 warn / 0 fail |
| `git diff --check` | ✅ OK |

## 4. Non-régression

- `npm run site:audit` reste inchangé et continue d'auditer une instance déjà servie.
- Aucun composant produit, route API, schéma DB ou logique métier n'est modifié.
- Le wrapper utilise un port dédié par défaut pour éviter de tuer ou perturber un serveur de preview utilisateur.
- Le cleanup ne vise que le PID/groupe de processus lancé par le wrapper.

## 5. Suites

T-211 clôt le finding QA F3 de T-210. Les autres suites non bloquantes restent au backlog :

- T-212 : carte optionnelle dans `/recherche` ;
- T-213 : pack Playwright navigateur ;
- T-214 : staging providers réels sans réactiver le paiement voyageur plateforme.
