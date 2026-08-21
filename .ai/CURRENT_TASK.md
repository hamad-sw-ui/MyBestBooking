# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-032
- **Titre** : R20 smoke_manifest_present + scripts/smoke.sh (preuve runtime obligatoire)
- **Niveau** : **S**
- **Ouverte le** : 2026-08-21 (Session 11)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Réponse directe à l'analyse critique du framework rédigée en début de
Session 11 (`REPORTS/analyse_framework_2026-08-21_pourquoi_illusion.md`).
Le framework `.ai/` v1.1.2, malgré ses 19 règles vertes, ne teste
**aucun comportement runtime** — c'est ce qui a produit l'illusion en
Session 8 où 7 features avaient été marquées ✅ VALIDÉ alors que leur
UI n'existait pas.

Le tag §16 `▶️ EXECUTED` était défini mais ni obligatoire ni
auto-vérifié. R20 le rend structurel via un script versionné dont
l'intégrité est contrôlée.

## Livrables

### A. Framework (v1.1.3)

- **Nouvelle règle bloquante R20** dans `scripts/check-ai.mjs` : vérifie
  statiquement que `scripts/smoke.sh` existe, est exécutable, porte un
  header `# @assertions: N` avec N ≥ 40, et contient les 5 patterns
  essentiels (login × 3 rôles, POST /api/bookings, guard body-check).
  Bloquant en cas de disparition ou vidage silencieux.
- **manifest.blocking_rules.smoke_manifest_present** ajoutée
  (blocking=true, verified_by=R20).
- Manifest version bumped `1.1.2 → 1.1.3`.
- Entrée changelog manifest.

### B. Script versionné `scripts/smoke.sh`

- **91 assertions HTTP réelles** en ~30 s.
- Démarre PostgreSQL embarqué + Next dev si nécessaire, reprend
  l'existant sinon, cleanup respectueux (`trap EXIT`).
- Play : login × 3 rôles, 11 pages publiques, 20 pages protégées via
  proxy, 9 pages customer, 7 guards body-check dashboard, 11 pages
  host, 9 pages admin, 3 `/api/auth/me`, 8 API protégées, 2 RBAC
  admin, 7 scénarios métier (`POST /api/bookings` complet inclus).
- Exit code non nul si un cas échoue → intégrable CI.

### C. ADR-008

`.ai/ADR/ADR-008_Smoke_HTTP_Preuve_Runtime.md` — décision technique,
alternatives rejetées (Playwright / Vitest E2E / live dans ai:check),
conséquences positives et dettes assumées (R21-R25 à venir).

### D. `npm run smoke`

Ajouté dans `package.json` — commande unique pour lancer le smoke live.

### E. Docs `.ai/` à jour

STATE, PROGRESS, TRACEABILITY, FEATURES, BACKLOG, CURRENT_TASK,
CODING_RULES (§13.5-bis), 2 rapports impact/conception + 1 log
d'exécution capté.

## Preuves (§16)

- 🔨 `npm run typecheck` : 0 erreur.
- 🧪 `npm run test` : 176/176 verts (0 skip avec DB).
- 🔨 `npm run ai:check` : **17 OK · 2 warn attendus · R20 vert · fail cosmétique R7 (STATE HEAD)**.
- ▶️ `npm run smoke` : **91 PASS · 0 FAIL** — log capté dans
  `.ai/REPORTS/smoke_run_2026-08-21_session_11.log`.
- ▶️ Test anti-triche R20 : `mv scripts/smoke.sh /tmp/` → `ai:check`
  sort `❌ R20 scripts/smoke.sh est absent`. Restauration → `✅`.

## Rapports associés

- `REPORTS/analyse_framework_2026-08-21_pourquoi_illusion.md` (motif)
- `REPORTS/analyse_impact_2026-08-21_T-032_smoke_r20.md` (§14, 9 questions)
- `REPORTS/analyse_conception_2026-08-21_T-032_smoke_r20.md` (§15.1)
- `REPORTS/smoke_run_2026-08-21_session_11.log` (preuve ▶️)
- `.ai/ADR/ADR-008_Smoke_HTTP_Preuve_Runtime.md` (décision)

## Prochaines étapes proposées (hors T-032)

R21-R25 identifiées dans l'analyse framework restent à livrer si
l'utilisateur en décide (chaque règle = 1 tâche S) :

- **R21 button_effect_trace** : chaque `<Button>` visible doit
  prouver un effet (onClick référencé, submit ou Link non-#).
- **R22 role_guard_effective_test** : automatiser le body-check
  aujourd'hui dans le smoke via Vitest supertest.
- **R23 features_reality_check** : croiser chaque ✅ de FEATURES.md
  avec le rapport smoke.
- **R24 evidence_freshness** : preuves TRACEABILITY doivent citer un
  SHA, dégrader en RÉGRESSION_POTENTIELLE si le code touché depuis.
- **R25 test_covers_the_claim** : matcher lexical entre tests cités
  et fonctionnalité VALIDÉ.
