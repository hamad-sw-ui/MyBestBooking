# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-000 v1.3 (clôture de Session 4)
- **Titre** : Retrait §13.4-bis + README + CI + bump framework v1.0.3
- **Niveau** : **S** (§15.0-bis exception maintenance)
- **Ouverte le** : 2026-08-20 (Session 4, phase finale)

## Contexte

La Session 4 a livré 10 tâches applicatives (T-001 à T-010) qui ont
corrigé 14 bugs (BUG-001 → BUG-015 sauf BUG-003 déplacé en
KNOWN_LIMITATIONS). Cette tâche T-000 v1.3 consolide :

1. Retrait de la clause **§13.4-bis** (test manuel = preuve), désormais
   inutile puisque Vitest est installé (J1 TEST_PLAN livré par T-001).
2. Ajout du **README.md** racine (absent jusqu'ici).
3. Ajout d'une **CI GitHub Actions** (`.github/workflows/ci.yml`) qui
   exécute lint + typecheck + test + build + ai:check à chaque push.
4. Migration `drizzle.config.json` → `drizzle.config.ts` (lecture
   DATABASE_URL depuis env) pour supporter CI.
5. Bump framework `v1.0.2` → `v1.0.3` avec changelog complété.
6. Mise à jour de STATE, PROGRESS, TRACEABILITY, PROCESS_IMPROVEMENTS.

## Critères d'acceptation

- [x] 🔍 §13.4-bis retirée de CODING_RULES.md avec note explicative
- [x] 🔍 `framework.manifest.json → version = 1.0.3` + entrée changelog
- [x] 🔍 `README.md` racine créé, mentionne setup, comptes démo,
  scripts, docs `.ai/`
- [x] 🔍 `.github/workflows/ci.yml` créé (Node 22, PostgreSQL 16
  service, npm ci → db:push → ai:check → lint → typecheck → test → build)
- [x] 🔍 `drizzle.config.json` supprimé, `drizzle.config.ts` créé et
  lit DATABASE_URL depuis env
- [x] 🔍 `package.json` scripts db:* utilisent la nouvelle config
- [x] 🔨 `npm run typecheck` OK
- [x] 🔨 `npm run build` OK
- [x] 🧪 `npm test` → **43/43 passent**
- [x] ▶️ `npm run ai:check` → **11 OK · 2 warn · 0 fail**
- [x] ▶️ E2E manuel réussi : register → login → recherche → réservation
  (référence `MBB-2026-C5Y3VY` obtenue) → logout → 401 sur /me
- [x] ▶️ Toutes les URL publiques + 4 URL authentifiées répondent 200

## Statut

**CORRIGÉ (INSPECTION)** — sera basculé VALIDÉ dès la validation
finale du responsable après ce dernier commit.

## Bilan Session 4

- **13 tâches livrées** (T-000 v1.2 + v1.3 + T-001 à T-010) toutes
  passées en VALIDÉ (sauf v1.3 en INSPECTION en attente).
- **14 bugs corrigés** (BUG-001, 002, 004-015 ; BUG-003 déplacé en
  KNOWN_LIMITATIONS).
- **1 bug ouvert** en réalité : BUG-003 (paiement), déplacé
  légitimement.
- **43 tests automatisés** existent maintenant, tous verts.
- **Framework passe 3 versions** : v1.0.0 → v1.0.1 → v1.0.2 → v1.0.3.
- **6 commits** dans la session : `2c37021` (setup) → `8344fbf` (T-001)
  → `8555ee7` (T-002) → `a4d3acf` (T-003) → `3bc5d3a` (T-004→T-007)
  → `541658c` (T-008→T-010) → ce commit (T-000 v1.3).

Le projet a atteint un état où :

- ✅ **Aucun bug applicatif ouvert** hors dépendance externe
  (Stripe test key pour paiement).
- ✅ **Sécurité P1/P2 traitée** (JWT, seed, middleware, rate-limit,
  headers).
- ✅ **Base de données intégre** (contraintes CHECK et UNIQUE en place,
  migrations versionnées).
- ✅ **Tests automatisés** couvrant les invariants critiques (auth,
  rate-limit, seed protection, proxy, utils).
- ✅ **CI prête** à valider chaque commit.
- ✅ **Framework de gouvernance solide** avec 13 règles automatisées.

## Prochaine session

- **T-011** : intégration paiement (Stripe test) — dès que credentials
  disponibles. Cycle complet niveau C attendu.
- **Chantiers fonctionnels** : voir `BACKLOG.md` (éditeur calendrier
  hôte, i18n EN, dark mode, analytics réelles, etc.).
