# ADR-008 — Smoke HTTP obligatoire (R20) comme preuve runtime du framework

## Statut

**Accepté** — 2026-08-21 (Session 11, T-032, framework v1.1.3)

## Contexte

Les 19 règles précédentes (R1-R19) du framework `.ai/` vérifient
exclusivement des **artefacts statiques** : présence de fichiers,
cohérence de manifests, tags de preuve dans les rapports, IDs uniques,
liens non morts (`href="#"`), routes cibles existantes (`page.tsx`).

L'analyse de framework rédigée en Session 11
(`REPORTS/analyse_framework_2026-08-21_pourquoi_illusion.md`) a formalisé
ce que Sessions 8 → 10 avaient déjà démontré empiriquement : **une
suite de checks statiques verts n'implique pas qu'un utilisateur peut
utiliser le produit**. En Session 8, 7 features avaient été marquées
✅ VALIDÉ avec typecheck + tests passants, mais leur UI n'existait
tout simplement pas (composants clients manquants). L'utilisateur les
a trouvées en 30 secondes en naviguant.

Le tag `▶️ EXECUTED` défini par §16 n'était ni obligatoire ni
auto-vérifié : rien n'empêchait un agent de clôturer un item VALIDÉ
avec seulement une preuve 🔨 (typecheck).

## Décision

Ajouter au framework la règle bloquante **R20 `smoke_manifest_present`**
et un script versionné **`scripts/smoke.sh`** qui :

1. Démarre PostgreSQL embarqué (`npm run db:dev`) et Next dev
   (`npx next dev`) si aucun n'est en cours.
2. Applique le schéma DB (`npm run db:push`, idempotent).
3. Joue le seed (`POST /api/seed`).
4. Effectue login × 3 rôles (customer / host / admin) et vérifie le
   rôle renvoyé par `/api/auth/me`.
5. GET les ~40 pages du site avec chaque rôle attendu, exige HTTP 200
   ou 307 selon le contexte.
6. Vérifie **le body HTML** rendu (pas seulement le code HTTP) pour
   confirmer qu'un guard `redirect()` de Next 16 ne fuite pas le
   contenu du dashboard vers un customer (limitation Next 16 : le
   redirect Server Component renvoie 200 + instruction RSC, un test
   qui n'attend qu'un code HTTP donne un faux vert).
7. Exécute des scénarios métier critiques :
   `POST /api/wishlists` (item), `POST /api/price-alerts`,
   `GET /api/users/me/referral`, et le plus important :
   `POST /api/bookings` complet avec vérification du
   `bookingReference` et `status="confirmed"` dans la réponse.
8. Compte PASS / FAIL et sort en `exit 1` si un cas échoue.

R20 (contrôle statique dans `scripts/check-ai.mjs`) vérifie que
`scripts/smoke.sh` :

- existe et est un fichier régulier
- porte le bit exécutable
- contient un header `# @assertions: N` avec N ≥ 40
- contient les 5 patterns essentiels : `admin@`, `host@`, `customer@`,
  `/api/bookings`, `DashboardSidebar|Chargement` (guard body-check)

R20 est **bloquante** (`blocking: true` dans `framework.manifest.json`).

Le script fournit un `npm run smoke` (~25 s, ~90 assertions) à lancer
avant chaque clôture d'item S ou C touchant l'UI ou les API. Il devient
la **preuve rejouable** `▶️ EXECUTED` par défaut.

## Ce qui a été rejeté

- **Lancement live dans `ai:check`** : ferait passer `ai:check` de
  ~300 ms à ~30 s, l'agent l'éviterait. R20 reste statique
  (< 10 ms), le live est un `npm run smoke` explicite.
- **Playwright headless** : Chromium indisponible en sandbox
  (documenté sandbox-limited depuis Session 5). À réévaluer quand la
  CI hébergée sera activée.
- **Test noir en Vitest** : couple les tests unitaires (5 s) au
  runtime serveur (25 s + risque de non-démarrage). Sépare mieux les
  responsabilités.
- **Scripts individuels par feature** : lourd à maintenir, entrave
  la vue d'ensemble. Un seul `smoke.sh` traçable et diffable.

## Conséquences

### Positives

- Une régression HTTP visible bout-en-bout (page 500, guard fuite,
  endpoint métier cassé) est **détectée immédiatement** par
  `npm run smoke`, sans dépendre de la vigilance de l'agent.
- Le tag `▶️ EXECUTED` devient standardisé : « `npm run smoke` :
  90 PASS · 0 FAIL » est une preuve concrète, rejouable par tout
  auditeur (§22).
- Le contrat R20 (patterns essentiels) protège contre le vidage
  silencieux du script : quiconque retire le check de bookings ou
  d'un rôle voit `ai:check` échouer.
- Le body-check documenté (D3) évite le piège Next 16 des redirects
  RSC. Cas d'école versionné et réutilisable.

### Négatives / dettes

- R20 ne détecte pas un `smoke.sh` qui ment (fausse assertion
  toujours verte). L'anti-triche est structurel : le script bash est
  en clair, `git blame` détecte qui a affaibli un check.
- Le smoke live requiert que la sandbox ait Node + PostgreSQL
  fonctionnels. En sandbox Arena c'est le cas depuis T-004
  (embedded-postgres).
- Le smoke **ne remplace pas** Playwright pour les interactions JS
  (clic, focus, typage clavier, uploads). Complémentarité assumée.
  Noté dans `KNOWN_LIMITATIONS.md`.
- R21-R25 restent à livrer (roadmap analyse framework Session 11) :
  button_effect_trace, role_guard_effective_test (partiel via body-check),
  features_reality_check, evidence_freshness, test_covers_the_claim.

### Neutres

- `npm run smoke` ajouté au `package.json` (script `smoke`).
- Manifest bumped `1.1.2 → 1.1.3`.
- `CODING_RULES.md` mentionne R20 dans §13 (règle de clôture).

## Preuves

- 🔨 `npm run typecheck` : 0 erreur.
- 🧪 `npm run test` : 176/176 verts.
- 🔨 `npm run ai:check` : 18 OK · 2 warn · 0 fail (R20 vert).
- ▶️ `npm run smoke` : 91 assertions PASS · 0 FAIL — log capté dans
  `.ai/REPORTS/smoke_run_2026-08-21_session_11.log`.

## Alternatives futures

- Si un jour Chromium est activable en sandbox : ajouter
  `npm run smoke:e2e` qui joue Playwright en complément (pas en
  remplacement) — R20 devient un plancher partagé.
- Si CI GitHub Actions activable : intégrer `npm run smoke` dans un
  job séparé (rapide, ~30 s) qui bloque la PR.

## Liens

- `.ai/REPORTS/analyse_framework_2026-08-21_pourquoi_illusion.md`
- `.ai/REPORTS/analyse_impact_2026-08-21_T-032_smoke_r20.md`
- `.ai/REPORTS/analyse_conception_2026-08-21_T-032_smoke_r20.md`
- `scripts/smoke.sh`
- `scripts/check-ai.mjs` (bloc « Règle 20 »)
- `.ai/framework.manifest.json` (`blocking_rules.smoke_manifest_present`)
