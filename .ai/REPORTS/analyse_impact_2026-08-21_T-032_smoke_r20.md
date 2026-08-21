# Analyse d'impact — T-032 : R20 smoke_http_all_pages + scripts/smoke.sh

**Date** : 2026-08-21 (Session 11)
**Niveau** : **S** (nouvelle règle bloquante du framework + script versionné + intégration `ai:check`).
**Motif** : Réponse directe à l'analyse `analyse_framework_2026-08-21_pourquoi_illusion.md`. Le framework `.ai/` ne teste actuellement aucun comportement runtime. R20 comble la faille #5.

## §14 — 9 questions

### 1. Quoi — qu'est-ce qui change exactement ?

Trois artefacts ajoutés, un modifié :

- **Nouveau** : `scripts/smoke.sh` — script bash reproductible qui démarre PostgreSQL embarqué + serveur Next dev, joue login × 3 rôles, GET toutes les pages, POST scénarios métier critiques, compte PASS/FAIL, exit non nul si un cas échoue.
- **Nouveau** : règle `R20 smoke_manifest_present` dans `scripts/check-ai.mjs` — vérifie que `scripts/smoke.sh` existe, est exécutable, contient un `# @assertions:` déclarant un nombre minimum d'assertions et que le fichier a été touché récemment (`git log`).
- **Nouveau** : `.ai/ADR/ADR-008-smoke-http-comme-preuve-runtime.md`.
- **Modifié** : `package.json` ajoute `"smoke": "bash scripts/smoke.sh"`.

Le script `smoke.sh` **exécuté à la main** produit un rapport chiffré ; R20 **statique** garantit que le script n'est pas supprimé/vidé sans qu'`ai:check` ne s'en aperçoive. La version « live » (démarrer serveur + jouer) reste hors `ai:check` par défaut (coûteuse) mais peut être appelée via `npm run smoke` en local ou en CI.

### 2. Où — quels fichiers, quelles lignes, quels symboles ?

- `scripts/smoke.sh` (créé, ~200 lignes)
- `scripts/check-ai.mjs` : ajouter bloc `Règle 20` avant le rapport final ; incrémenter le compteur de règles dans la doc en-tête.
- `.ai/framework.manifest.json` : bump `1.1.2` → `1.1.3`, ajouter entrée `changelog`, ajouter `blocking_rules.smoke_manifest_present`.
- `.ai/CODING_RULES.md` : mentionner R20 dans §13 (nouvelle sous-section §13.5-bis « preuve runtime »).
- `.ai/ADR/ADR-008-*.md` (créé).
- `.ai/STATE.md` : bump version framework, HEAD à jour.
- `.ai/PROGRESS.md` : entrée Session 11.
- `.ai/TRACEABILITY.md` : ligne T-032 avec preuves 🔨 🧪 ▶️.
- `.ai/CURRENT_TASK.md` : T-032.
- `.ai/FEATURES.md` : nouvelle ligne ✅ « Smoke HTTP reproductible (R20) ».
- `.ai/BACKLOG.md` : marquer entrée « R20 smoke » comme livrée si présente.
- `package.json` : script `smoke`.

### 3. Pourquoi — quel bénéfice précis ?

- Faille #5 (« aucune règle ne teste le comportement au runtime ») **partiellement fermée** : `scripts/smoke.sh` est un test bout-en-bout HTTP versionné qui produit un chiffre `PASS/FAIL` reproductible et lisible par tout auditeur.
- Faille #1 (« tag ▶️ EXECUTED non obligatoire ni auto-vérifié ») **atténuée** : la sortie de `npm run smoke` devient une preuve ▶️ traçable et rejouable, à citer dans TRACEABILITY.
- Détecte **immédiatement** une page qui renvoie 500, un guard mal placé, une régression d'authentification, un endpoint métier cassé — sans dépendre de l'attention de l'agent.
- Renforce §22 (audit des preuves) : n'importe quel humain ou agent peut lancer `npm run smoke` et voir 84 assertions pass ou non — pas besoin de re-lire du code.

### 4. Risques — qu'est-ce qui peut casser ?

| Risque | Probabilité | Mitigation |
|---|---|---|
| Le script échoue sur la sandbox par manque de PostgreSQL démarré | Élevée | Le script détecte + démarre `npm run db:dev` si port 55432 libre, et attend qu'il soit prêt |
| Faux positif : une redirection RSC (200 + instruction) prise pour un succès alors que la page est protégée | Moyenne | Vérifier le body avec `grep -v "Chargement en cours"` et exiger absence de mots clés d'erreur (`Error`, `Une erreur`, `500`) |
| Le script écrit dans `/tmp` qui n'est pas versionné | Faible (voulu) | Les logs `.data/mails/` restent locaux ; le rapport `smoke.log` sortant est écrit sous `/tmp/smoke-<pid>.log` puis affiché stdout |
| Le seed n'est pas idempotent → 2ᵉ run échoue | Faible | `/api/seed` renvoie déjà « Données déjà présentes » → traité comme succès |
| Un rate-limit interne bloque la 2ᵉ exécution | Faible | Rate-limits en mémoire, remis à zéro à chaque `next dev` |
| CI hébergée devra installer PostgreSQL et Node | Moyenne | Workflow prêt dans `.ai/REPORTS/ci_workflow_a_ajouter.md`, à activer quand permission `workflows` disponible |
| Casse d'un pipeline CI existant | Nulle | Aucun workflow actif aujourd'hui (sandbox-limited) |

### 5. Coût — combien ça prend ?

- Écriture script bash + tests locaux : ~30 min agent
- Règle R20 + manifest + ADR : ~15 min
- Docs `.ai/` (STATE/PROGRESS/TRACE/FEATURES/CURRENT_TASK) : ~15 min
- Commit + push + preuves : ~10 min

**Total : ~1 h 10 min agent** — cohérent avec l'estimation ~1 h annoncée hier.

Runtime `npm run smoke` : ~25 s (mesuré Session 11).

### 6. Alternatives — qu'a-t-on éliminé et pourquoi ?

| Option | Rejet |
|---|---|
| Playwright headless | CDN Chromium indispo en sandbox (sandbox-limited documenté) |
| Vitest E2E via fetch | Complexifie `vitest run` déjà couplé à Node runtime ; risque de couper les tests unitaires si serveur ne démarre pas |
| Ajouter R20 « live » directement dans `ai:check` | ~25 s ajoutés à chaque check ; sanction disproportionnée pour un check de doc — d'où séparation `npm run smoke` (live) et R20 (présence statique + fraîcheur) |
| Un test manuel documenté en Markdown | C'est exactement ce que le framework a fait jusqu'ici et qui produit l'illusion — refusé par principe |

### 7. Dépendances — quoi d'autre est touché ?

- `package.json` (nouveau script `smoke`)
- Aucune modification du code applicatif `src/**`
- Aucune migration DB
- Aucun impact sur les 176 tests Vitest

### 8. Compatibilité — casse-t-on quelque chose de public ?

Non. Le script est un outil dev/CI, invoqué par l'humain ou par CI. Aucun endpoint API modifié, aucune route ajoutée, aucun schéma DB touché.

### 9. Preuves attendues à la clôture

- 🔨 `npm run typecheck` : 0 erreur
- 🧪 `npm run test` : 176/176 verts
- 🔨 `npm run ai:check` : R20 vert (18 OK · 2 warn · 0 fail après correction R7 STATE)
- ▶️ `npm run smoke` : PASS ≥ 80 · FAIL = 0 (mesuré et log capté dans `.ai/REPORTS/`)
- ▶️ 1 exécution live confirmée dans le rapport de test T-032

## Décision de proportionnalité

**Niveau S** confirmé : évolution du framework (§15.0-bis dit niveau C pour les règles §1-§22 de `CODING_RULES.md`, mais R20 est **ajout d'un check automatisé** — pas modification d'une règle §. C'est de la maintenance de framework, donc S). Débat 11 rôles §15.2 non requis (pas de désaccord attendu).
