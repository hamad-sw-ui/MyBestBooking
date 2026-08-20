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
| T-002 | Protection de POST /api/seed en prod (corrige BUG-002) | C | CORRIGÉ (VALIDÉ) | 🔍 garde `checkSeedAuthorization` avec `timingSafeEqual` · 🔨 typecheck + build OK · 🧪 33 tests passent · ▶️ `curl POST /api/seed` en dev → 200 (non-régression) · ▶️ `npm run ai:check` 11 OK / 2 warn / 0 fail | `8555ee7` | `REPORTS/..._seed_protection.md` (impact/conception/débat) · `ADR/ADR-004_Seed_Route_Protection.md` |
| T-003 | Proxy d'auth (BUG-005) | S | CORRIGÉ (VALIDÉ) | 🔍 `src/proxy.ts` · 🧪 38 tests · ▶️ 307 sans cookie, 200 avec | `a4d3acf` | `REPORTS/..._middleware_auth.md` · `ADR-005` |
| T-004 | N+1 sur GET /api/properties (BUG-004) | S | CORRIGÉ (VALIDÉ) | 🔍 LEFT JOIN + GROUP BY + MIN/COUNT · 🔨 typecheck OK · ▶️ 5 filtres testés retournent les mêmes résultats qu'avant | `3bc5d3a` | commentaires inline dans src/app/api/properties/route.ts |
| T-005 | useSearchParams sans Suspense (BUG-007) | L | CORRIGÉ (VALIDÉ) | 🔍 `<Suspense fallback>` autour de ReservationPageInner · 🔨 typecheck OK · ▶️ /reservation → 200 | `3bc5d3a` | inline |
| T-006 | Contraintes DB : dates, uniques wishlist/availability (BUG-011/012/013) | S | CORRIGÉ (VALIDÉ) | 🔍 CHECK + UNIQUE INDEX ajoutés dans schema.ts · 🔍 migration drizzle/0001_lowly_argent.sql générée et poussée · 🔨 typecheck OK · ▶️ POST /api/bookings avec dates égales → 400 message français · ▶️ POST /api/wishlists doublon → 'déjà dans la liste' | `3bc5d3a` | inline |
| T-007 | Race averageRating (BUG-010) | S | CORRIGÉ (VALIDÉ) | 🔍 UPDATE atomique avec subquery AVG/COUNT au lieu du recalcul JS · 🔨 typecheck OK · 🧪 tests intacts | `3bc5d3a` | inline |
| T-008 | next/image + headers de sécurité + emailVerified=false (BUG-006, BUG-008) | S | CORRIGÉ (VALIDÉ) | 🔍 Image de next/image dans PropertyCard et destinations home · 🔍 next.config.ts avec remotePatterns unsplash + 5 headers de sécurité · 🔨 typecheck + build OK · ▶️ curl -I / retourne tous les headers · 🔍 register met emailVerified: false | commit T-008 | inline |
| T-009 | Rate-limit login/register (BUG-009) | S | CORRIGÉ (VALIDÉ) | 🔍 src/lib/rate-limit.ts (Map, fenêtre glissante) · 🧪 5 tests unitaires · 🔨 typecheck + build OK · ▶️ 6 mauvais logins → 5×401 + 1×429 avec Retry-After · ▶️ 43/43 tests | commit T-009 | inline |
| T-010 | lucide-react 1.33.0 (BUG-014) | T | CORRIGÉ (VALIDÉ) | 🔍 `npm ls lucide-react` → 1.33.0 · ▶️ `curl / \| grep 'lucide-'` retourne des `<svg class="lucide lucide-menu">` bien rendus | commit T-008 | — |
| T-000 v1.3 | Clôture Session 4 : retrait §13.4-bis, README, CI, drizzle.config.ts, framework v1.0.3 | S (§15.0-bis) | CORRIGÉ (VALIDÉ) | 🔍 §13.4-bis retirée de CODING_RULES · 🔍 README.md racine créé · 🔍 CI docs · 🔍 drizzle.config.ts remplace .json · 🔨 typecheck + build OK · 🧪 43/43 tests · ▶️ ai:check 11 OK · 2 warn · 0 fail · ▶️ E2E complet register→booking→logout · ▶️ 8 URL publiques + 4 privées → 200 | `5efca53` | ce PROGRESS.md |
| T-011 | Framework v1.1.0 : élargissement à la complétude produit (ADR-006) | C (§15.0-bis) | CORRIGÉ (VALIDÉ) | 🔍 20 documents obligatoires · 🔍 R14-R17 ajoutées · 🔨 typecheck OK · 🧪 43/43 tests · ▶️ ai:check 13 OK · 4 warn · 0 fail | `ae893ad` | `ADR-006` + 3 rapports |
| T-012 | Disponibilité + chevauchement bookings (S) | S | CORRIGÉ (VALIDÉ) | 🔍 `src/lib/availability.ts` · 🔍 index `idx_bookings_room_dates` (mig 0002) · 🔍 transaction FOR UPDATE dans POST /api/bookings · 🧪 54 tests · ▶️ 409 sur double booking, adjacent accepté | commit T-012 | `REPORTS/analyse_*_booking_availability.md` |
| T-013 | Emails transactionnels : verify email + forgot password + reset password + booking confirmations (S) | S | CORRIGÉ (VALIDÉ) | 🔍 `src/lib/mail/` (interface Mailer + ConsoleMailer + ResendMailer + 4 templates HTML) · 🔍 `src/lib/tokens.ts` (SHA-256 hash, TTL 24h/1h par purpose) · 🔍 table `verification_tokens` (mig 0003) · 🔍 3 endpoints : `GET /api/auth/verify`, `POST /api/auth/forgot-password` (anti-enum + rate-limit 5/h/email), `POST /api/auth/reset-password` (révoque toutes sessions) · 🔍 register + booking câblés best-effort · 🔍 3 pages : `/verifier-email` `/mot-de-passe-oublie` `/reinitialiser` · 🧪 66/66 tests (17+9+7+5+5+7+4+**3 tokens+9 mail+5 proxy** ; réel 66 total) · ▶️ E2E complet : register→mail écrit dans .data/mails/ ; forgot-password→mail reset ; reset→login nouveau mdp OK, ancien mdp 401 ; verify→emailVerified=true en base ; page /verifier-email?ok=1 rendue | commit T-013 | `REPORTS/analyse_*_emails.md` |

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
