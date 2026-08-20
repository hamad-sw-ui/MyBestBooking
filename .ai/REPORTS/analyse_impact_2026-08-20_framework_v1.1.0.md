# Analyse d'impact — T-011 : Framework v1.1.0 (élargissement à la complétude produit)

- **Date** : 2026-08-20 (Session 5) · **Niveau** : **C** · **Ref** : §14

## 1. Quoi

Passage du framework `.ai/` de v1.0.3 → **v1.1.0** (bump mineur car
changement de portée). Ajout de :

- 2 nouveaux documents obligatoires : `FEATURES.md`,
  `PRODUCT_ACCEPTANCE.md`
- 4 nouvelles règles automatisées R14-R17 dans `check-ai.mjs`
- 1 nouveau tag §16 : 🎯 PROMISED
- 1 nouveau rituel (audit produit périodique tous les 5 VALIDÉ / 10 commits)
- ADR-006 qui acte le changement de portée
- Réécriture complète de `BACKLOG.md` et `KNOWN_LIMITATIONS.md`
- Installation de Playwright (préparation E2E, R18 futur)

## 2. Où

- **Nouveaux fichiers** : `.ai/FEATURES.md`, `.ai/PRODUCT_ACCEPTANCE.md`,
  `.ai/ADR/ADR-006_*.md`, `.ai/REPORTS/analyse_*_framework_v1.1.0.md`,
  `.ai/REPORTS/debat_technique_framework_v1.1.0.md`,
  `playwright.config.ts`, `tests/e2e/*.spec.ts`
- **Modifiés** : `.ai/framework.manifest.json`, `.ai/CODING_RULES.md`,
  `.ai/INDEX.md`, `.ai/BACKLOG.md`, `.ai/KNOWN_LIMITATIONS.md`,
  `.ai/STATE.md`, `.ai/PROGRESS.md`, `.ai/TRACEABILITY.md`,
  `.ai/PROCESS_IMPROVEMENTS.md`, `scripts/check-ai.mjs`, `package.json`

## 3. Pourquoi

L'audit demandé par le responsable en Session 5 a trouvé ~40 défauts
produit alors que `npm run ai:check` retournait 11 OK / 0 fail. Preuve
que le framework est aveugle à la complétude. À corriger, sinon les
prochaines sessions vont continuer d'itérer sur du vide en croyant
avancer.

## 4. Appelants

- Toute future session lit `INDEX.md` → doit lire `FEATURES.md` et
  `PRODUCT_ACCEPTANCE.md`.
- `check-ai.mjs` charge le nouveau manifest et exécute R14-R17 en plus.
- Aucun impact runtime applicatif (`src/` non touché).

## 5. Contrat public

- **Changement de règles opposables** (§15.0-bis) → **niveau C**.
- Les tâches à venir devront honorer 🎯 PROMISED, mettre à jour FEATURES,
  et laisser R14-R17 en vert (ou justifier les warns).
- Aucun contrat d'API changé, aucun schéma DB touché.

## 6. Migration

- **Une seule fois** au démarrage v1.1.0 : peuplement initial de
  `FEATURES.md` à partir du grep code + audit Session 5. Fait dans cette
  tâche.
- `BACKLOG.md` réécrit pour retirer les items déjà corrigés Sessions 3-4.
- `KNOWN_LIMITATIONS.md` nettoyé des mentions obsolètes.

## 7. Sécurité

Aucun impact sécurité runtime. Impact positif indirect : R14 va
notamment détecter que la table `users` a un endpoint (via `/api/auth/`)
mais pas d'endpoint admin `PATCH /api/users/[id]/suspend`, qui est un
défaut fonctionnel important pour un admin.

## 8. Test

- Après ajout des règles au script : `npm run ai:check` doit lister
  les warns/fails attendus (couverture DB incomplète, UI actions sans
  fetch, etc.) → ces fails **sont la nouvelle roadmap**.
- Le script ne doit pas retourner d'erreur JS (test 🔨 typecheck).
- Playwright installé mais aucun test bloquant ajouté à `npm test`
  (les E2E resteront `npm run e2e` à part pour ne pas gêner la CI
  courte).

## 9. Rollback

`git revert` du commit T-011 restaure le framework v1.0.3 tel qu'il
était. Aucun state DB, aucun code applicatif touché. Effort < 30s.
