# 🔗 TRACEABILITY — Matrice de traçabilité des preuves

Ce document lie chaque **tâche** ou **bug** clôturé à la **preuve** qui
justifie sa validation. C'est le pendant obligatoire de `CODING_RULES.md`
§13 et §22.

## Convention d'écriture

Chaque entrée porte :

- **ID** : identifiant de tâche (`B-xxx`) ou de bug (`B-xxx`).
- **Titre** : rappel court.
- **Niveau** : T / L / S / C.
- **Statut** : `PLANIFIÉ` | `EN COURS` | `CORRIGÉ (INSPECTION)` | `CORRIGÉ (VALIDÉ)` | `RÉGRESSION`.
- **Preuves** : liste horodatée, chaque preuve porte un **tag** §16
  (🔍/🔨/🧪/▶️/🧠/❓).
- **Commit(s)** : SHA courts.
- **Rapports** : liens vers les fichiers `REPORTS/` associés.

Un item `CORRIGÉ (VALIDÉ)` **sans** au moins une preuve 🔨, 🧪 ou ▶️ est
considéré comme non valide (audit §22) et repasse en `INSPECTION`.

---

## Registre

| ID | Titre | Niveau | Statut | Preuves | Commit(s) | Rapports |
|---|---|---|---|---|---|---|
| T-000 v1 | Mise en place du framework `.ai/` v1.0.0 | S | CORRIGÉ (VALIDÉ) | 🔍 tous les fichiers `.ai/` obligatoires existent · ▶️ `npm run ai:check` R1/R2/R4 tous verts sur HEAD post-consolidation | `4ad8884` + `455c121` | `REPORTS/analyse_impact_2026-08-20_governance_setup.md` · `REPORTS/analyse_conception_2026-08-20_governance_setup.md` · `ADR/ADR-001_Framework_de_gouvernance.md` |
| T-000 v1.1 | Auto-audit tour 1 + framework v1.0.1 | S (§15.0-bis exception maintenance) | CORRIGÉ (VALIDÉ) | 🔍 10 défauts détectés puis corrigés · ▶️ `npm run ai:check` retourne **9 OK · 0 warn · 0 fail** (v1.0.1 initial) puis **8 OK · 1 warn attendu R7 · 0 fail** (post-commit `cbb3b2e`) | `cbb3b2e` | `REPORTS/audit_2026-08-20_framework_v1.0.0.md` · `ADR/ADR-001_Framework_de_gouvernance.md` (section « Niveau assumé S ») · `ADR/ADR-002_Automatisation_hors_dossier_ai.md` |
| T-000 v1.2 | Auto-audit tour 2 + framework v1.0.2 | S (§15.0-bis exception maintenance) | CORRIGÉ (VALIDÉ) | 🔍 10 nouveaux défauts détectés dont 2 rouges (A collision IDs, B blocking_rules non implémentées) · 🔍 66 occurrences B-xxx renommées en BUG-xxx/T-xxx (16 fichiers, 0 résiduel) · ▶️ `npm run ai:check` retourne **11 OK · 2 warn · 0 fail · exit 0** avec R10/R11/R12/R13 ajoutées · 🔨 preuve reproductible via `npm run ai:check` | `fcfa9d0` | `REPORTS/audit_2026-08-20_framework_v1.0.1_tour2.md` |
| T-001 | JWT_SECRET obligatoire au boot (corrige BUG-001) | C | CORRIGÉ (VALIDÉ) | 🔍 fallback retiré · 🔨 typecheck + build OK · 🧪 26 tests passent (17 utils + 9 auth §13.5) · ▶️ `POST /api/auth/login` 200 post-changement · ▶️ `npm run ai:check` 11 OK / 2 warn / 0 fail | `8344fbf` | `REPORTS/analyse_impact_..._jwt_secret.md` · `REPORTS/analyse_conception_..._jwt_secret.md` · `REPORTS/debat_technique_..._jwt_secret.md` · `ADR/ADR-003_JWT_Secret_Obligatoire.md` |
| T-002 | Protection de POST /api/seed en prod (corrige BUG-002) | C | CORRIGÉ (VALIDÉ) | 🔍 garde `checkSeedAuthorization` ajoutée en tête du handler avec `timingSafeEqual` · 🔨 typecheck + build OK · 🧪 33 tests passent (17 utils + 9 auth + 7 seed §13.5) couvrant les 5 scénarios dev/prod × avec/sans token · ▶️ `curl POST /api/seed` en dev retourne 200 (non-régression) · ▶️ `npm run ai:check` 11 OK / 2 warn / 0 fail | commit T-002 | `REPORTS/analyse_impact_..._seed_protection.md` · `REPORTS/analyse_conception_..._seed_protection.md` · `REPORTS/debat_technique_..._seed_protection.md` · `ADR/ADR-004_Seed_Route_Protection.md` |

## Audits historiques

### 2026-08-20 — Audit de la mise en place initiale (auto-audit tour 1)
- Items audités : T-000 v1
- Commande rejouée : ▶️ `npm run ai:check` sur HEAD `455c121`
- Résultat : 10 défauts détectés (4 rouges, 3 orange, 3 jaunes)
- Action : ouverture de T-000 v1.1 pour corriger, aboutissant à framework v1.0.1 (commit `cbb3b2e`)
- Rapport : `REPORTS/audit_2026-08-20_framework_v1.0.0.md`

### 2026-08-20 — Audit du framework v1.0.1 (auto-audit tour 2)
- Items audités : T-000 v1 + T-000 v1.1 + le framework v1.0.1 lui-même
- Commande rejouée : ▶️ `npm run ai:check` + inventaire manuel des blocking_rules vs règles Rn
- Résultat : 10 nouveaux défauts détectés (2 rouges A/B, 3 orange C/D/E, 5 jaunes F-J)
- Action décidée par le responsable :
  - A → **préfixes distincts** BUG-xxx / T-xxx (formalisation §8.1)
  - B → **hybride** : implémenter R10/R11/R12/R13 dans le script, marquer `unchecked_pre_commit_checklist` et `obsolete_roadmap` comme `implemented: false` (aspirationnelles)
  - C-J → reportés Session 4 (voir `PROCESS_IMPROVEMENTS.md`)
- Résultat post-corrections : ▶️ `npm run ai:check` → **11 OK · 2 warn · 0 fail · exit 0**
  - 2 warn attendus et documentés : R7 (HEAD à mettre à jour en fin de session, motif toléré) et R11 (numéro 001 partagé entre BUG- et T-, informationnel)
- Rapport : `REPORTS/audit_2026-08-20_framework_v1.0.1_tour2.md`

### Format standard des audits à venir
```
### YYYY-MM-DD — Audit demandé par <responsable>
- Items audités : T-xxx, BUG-yyy
- Commande rejouée : ▶️ <commande>
- Résultat : conforme | RÉGRESSION
- Action : —
```

---

## Rappel §22

L'audit peut être demandé à tout moment. La responsabilité de fournir une
preuve **rejouable** (commande shell, requête curl, test qui passe)
incombe à celui qui a marqué l'item `VALIDÉ`. Si l'environnement a évolué
et que la preuve n'est plus rejouable, il faut le **dire** et proposer une
preuve équivalente à jour, pas prétendre que rien n'a changé.
