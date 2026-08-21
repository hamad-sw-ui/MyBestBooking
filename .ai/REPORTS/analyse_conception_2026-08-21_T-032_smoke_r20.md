# Analyse de conception — T-032 : R20 smoke_http_all_pages + scripts/smoke.sh

**Date** : 2026-08-21 (Session 11)
**Niveau** : **S**
**Impact préalable** : `analyse_impact_2026-08-21_T-032_smoke_r20.md`

## 1. Architecture ciblée

```
┌────────────────────────────────────────────────────────────────┐
│  scripts/smoke.sh (nouveau)                                    │
│                                                                │
│  1. Prérequis                                                  │
│     - Détecte si port 55432 déjà occupé → réutilise            │
│     - Sinon lance `npm run db:dev` en arrière-plan             │
│     - Attend socket TCP 55432 prêt (max 30 s)                  │
│     - Applique `npm run db:push` (idempotent)                  │
│     - Détecte si port 3000 occupé → réutilise                  │
│     - Sinon lance `npx next dev -H 0.0.0.0 -p 3000` en bg      │
│     - Attend `curl /api/health` = 200                          │
│                                                                │
│  2. Seed                                                       │
│     - POST /api/seed (200 ou 409 « déjà présent » OK)          │
│                                                                │
│  3. Login × 3 rôles                                            │
│     - customer / host / admin → cookies dans /tmp/*.jar        │
│                                                                │
│  4. Assertions HTTP                                            │
│     - 11 pages publiques → 200                                 │
│     - 20 pages protégées sans cookie → 307 vers /connexion     │
│     - 9 pages customer authentifié → 200                       │
│     - 7 pages dashboard avec cookie customer → body sans       │
│       « DashboardSidebar » (guard effectif)                    │
│     - 11 pages host dashboard → 200                            │
│     - 9 pages admin dashboard → 200                            │
│     - /api/auth/me × 3 → rôle correct                          │
│     - 9 API protégées sans cookie → 401/403                    │
│     - GET /api/properties + filtres → 200                      │
│     - POST /api/wishlists (item) → 201                         │
│     - POST /api/price-alerts → 201                             │
│     - GET /api/users/me/referral → 200 + code présent          │
│     - POST /api/bookings (complet) → 201 + total < subtotal    │
│     - GET /api/admin/settings (customer) → 403                 │
│                                                                │
│  5. Rapport                                                    │
│     - Compte PASS/FAIL, affiche liste des FAIL avec URL+code   │
│     - exit 0 si FAIL=0, exit 1 sinon                           │
│                                                                │
│  6. Cleanup (trap EXIT)                                        │
│     - Ne stoppe QUE les processes qu'il a démarrés lui-même    │
│     - Laisse tourner un `next dev`/`db:dev` préexistant        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  scripts/check-ai.mjs — Règle R20 (nouveau bloc)               │
│                                                                │
│  Vérifications statiques (rapides, aucune exécution) :         │
│  a) scripts/smoke.sh existe et est un fichier régulier         │
│  b) Bit exécutable positionné (mode & 0o111)                   │
│  c) Contient un header « # @assertions: N » avec N ≥ 40        │
│  d) Contient au moins 3 patterns de test essentiels :          │
│     - login × 3 rôles (grep 'admin@' 'host@' 'customer@')      │
│     - POST /api/bookings (grep '/api/bookings')                │
│     - Guard body-check (grep 'DashboardSidebar\|Chargement')   │
│  e) Modification récente : dernier commit qui touche           │
│     scripts/smoke.sh ≤ 200 commits (sinon warn : « smoke       │
│     jamais mis à jour, la couverture peut être périmée »)      │
│                                                                │
│  Sortie : ok / warn / fail                                     │
│  Bloquant si (a) ou (b) ou (c) ou (d) manquent — fail.         │
│  Warn si (e) uniquement.                                       │
└────────────────────────────────────────────────────────────────┘
```

## 2. Contrats

### 2.1 Contrat `scripts/smoke.sh`

- **Entrée** : optionnellement `SMOKE_BASE_URL` (défaut `http://127.0.0.1:3000`) pour tester une instance déjà démarrée sans en lancer une nouvelle.
- **Sortie** :
  - stdout : rapport structuré avec `✅`/`❌` par assertion + résumé « X PASS · Y FAIL »
  - exit code : `0` si `Y=0`, `1` sinon
- **Idempotence** : rejouable N fois d'affilée sans faire échouer les runs suivants (les scénarios POST utilisent des identifiants existants du seed ou créent des nouveaux).
- **Isolation** : n'écrit **rien** dans le repo (les jars cookies sont sous `/tmp/`).

### 2.2 Contrat R20

- Bloquant si le fichier `scripts/smoke.sh` disparaît, devient non-exécutable, ou perd le marqueur `# @assertions: N ≥ 40`.
- Bloquant si l'un des 3 patterns essentiels (login × 3 rôles, POST bookings, guard body-check) est retiré → protège contre un smoke vidé silencieusement.
- Non-bloquant si le script est vieux (`warn`) — laisse la latitude d'en discuter.

## 3. Décisions notables

### D1 — Pourquoi bash et pas Node
Bash + curl couvre 100 % du besoin (login + JSON + HTTP), zéro dépendance, lisible pour tout auditeur qui rejoue. Un script Node nécessiterait `fetch` polyfill ou `undici`, plus de dépendances, moins de lisibilité pour ce qui reste un test noir HTTP.

### D2 — Pourquoi séparer `npm run smoke` (live) et R20 (statique)
`ai:check` doit rester **rapide** (< 2 s) sinon l'agent l'évitera. Lancer un serveur Next à chaque check ferait passer `ai:check` de ~300 ms à ~30 s. R20 statique = 5 ms, garantit la présence + intégrité du script. Le lancement live est un `npm run smoke` explicite (dev, CI, ou audit à la demande).

### D3 — Guard body-check plutôt que HTTP status
Découverte Session 11 : `redirect()` de Next 16 renvoie `200 + instruction RSC`, pas un `307`. Un smoke qui n'attendrait qu'un code HTTP donnerait un faux vert. Le smoke vérifie donc **le body** rendu (absence de `DashboardSidebar`, présence de `Chargement en cours…`).

### D4 — Pas de dépendance à un framework de test
Pas Jest, pas Mocha, pas Cypress. Un `if/else + exit code`. Rejouable en 2028 sur un ordinateur sans Node moderne, sans risque de dépendance obsolète.

### D5 — Cleanup respectueux
Si l'utilisateur a déjà `next dev` qui tourne, `smoke.sh` le réutilise et **ne le tue pas** à la sortie. Détection : port TCP déjà bindé avant le lancement.

## 4. Tests prévus

### 4.1 Tests unitaires (à écrire)
Aucun. `smoke.sh` **est** le test. Ajouter un test qui teste un test dilue.

### 4.2 Preuve d'exécution (à capturer)
- `bash scripts/smoke.sh` lancé une fois, sortie captée dans `.ai/REPORTS/smoke_run_2026-08-21_session_11.log`.
- Doit afficher **PASS ≥ 80 · FAIL = 0**.

### 4.3 Preuve statique
- `npm run ai:check` doit afficher `✅ R20 smoke_manifest_present`.

### 4.4 Test de régression
- Renommer temporairement `scripts/smoke.sh` en `smoke.sh.bak` → `ai:check` doit sortir `❌ R20`. Preuve dans le log de session.

## 5. Séquence d'exécution proposée

1. Créer `scripts/smoke.sh` avec header `# @assertions: 84`
2. `chmod +x scripts/smoke.sh`
3. Lancer `bash scripts/smoke.sh` une première fois → capter la sortie
4. Ajouter le bloc R20 dans `scripts/check-ai.mjs`
5. Bump manifest v1.1.3 + entrée changelog + `blocking_rules.smoke_manifest_present`
6. Ajouter script `smoke` dans `package.json`
7. Créer ADR-008
8. `npm run ai:check` → doit être vert (18 OK · 2 warn · 0 fail — après avoir aussi corrigé le R7 STATE si l'HEAD a bougé)
9. `npm test` → 176/176
10. Mettre à jour STATE / PROGRESS / TRACE / FEATURES / CURRENT_TASK
11. Commit `feat: T-032 R20 smoke_manifest_present + scripts/smoke.sh`
12. Push

## 6. Ce que R20 ne fera PAS (assumé)

- Ne détectera pas un `smoke.sh` qui ment (assertion « passe » alors que curl renverrait un 500). L'anti-triche est structurel : le script bash **est** en clair, `git blame` détecte qui a modifié un pattern.
- Ne remplace pas Playwright pour les interactions JS (clic, focus, typage). Complémentaire, pas substituable — noté KNOWN_LIMITATIONS.
- Ne teste pas la responsivité mobile ni le dark mode CSS. Idem, complément UI test à envisager quand Chromium disponible.

## 7. Débat multi-rôles (§15.2) — synthèse

Non requis (niveau S sans désaccord anticipé). Points passés en revue par les rôles concernés :

- **Architecte** : OK, découplage script/règle propre.
- **DevOps / SRE** : OK, réutilisation des processes en cours ; cleanup EXIT défensif.
- **Ingénieur QA** : demande le body-check (D3) — intégré.
- **Expert sécurité web** : OK, cookies sur `/tmp/` avec `umask 077` ; aucun secret loggé.
- **Advocatus diaboli** : « ton smoke passera vert et tu diras encore que tout marche » — reconnu ; c'est pourquoi R20 est un **plancher** (structurellement mieux que rien) pas un **plafond** (les 6 failles listées dans l'analyse framework restent à traiter par R21-R25).
